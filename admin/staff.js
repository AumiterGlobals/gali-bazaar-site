// update-89 · Staff roles on the website admin (the in-app admin stays owner-only).
// OWNER = profiles.role 'admin'. SUPPORT / KYC / ACCOUNTS / ACCOUNTANT_TAX come from the staff table (Settings → Team).
// The menu only shows the role's pages; every RPC / table behind them checks has_perm() on the server as well.

const STAFF_NAV = {   // permission → menu page
  complaints: "complaints", orders_lookup: "orders", customers: "customers", seller_chat: "support",
  kyc: "kyc", photo_review: "photos", shops_view: "sellers",
  payments: "payments", bills: "bank", books: "accounts", tds: "tax",
};
const STAFF_ROLES = { SUPPORT: "Support", KYC: "KYC", ACCOUNTS: "Accounts", ACCOUNTANT_TAX: "Tax accountant" };

/** Called from start() for a signed-in account that is not the owner. Returns true when it took over the page. */
async function staffStart(session) {
  const { data: st, error } = await db.rpc("my_staff_role");
  if (error) return false;                                  // update-89 not run yet: old behaviour
  if (!st) return false;                                    // not staff
  const out = (title, text) => { $("#root").innerHTML = `<div class="login">${LOGO}<h1>${title}</h1><p class="sub">${text}</p>
    <button class="btn ghost" onclick="db.auth.signOut().then(()=>location.reload())">Sign out</button></div>`; };
  if (st.removed) { await db.auth.signOut().catch(() => {}); out("Your access was removed", `${esc(session.user.email)} is no longer in the Gali Bazaar team. Ask the owner if this is a mistake.`); return true; }
  if (st.expired) { await db.auth.signOut().catch(() => {}); sessionStorage.setItem("gbExpired", "1"); location.reload(); return true; }
  window.STAFF = { role: st.role, perms: st.perms || [], email: st.email || session.user.email };
  if (st.role === "ACCOUNTANT_TAX") window.ACCOUNTANT = true;         // the existing tax-accountant view (read-only settings)
  const keep = new Set(window.STAFF.perms.map(p => STAFF_NAV[p]).filter(Boolean));
  NAV.splice(0, NAV.length, ...NAV.filter(([k]) => keep.has(k)), ...(keep.has("orders") && !NAV.some(n => n[0] === "orders") ? [["orders", "Orders lookup"]] : []));
  if (!NAV.length) { out("No pages for this role", "Ask the owner to check your role in Settings → Team."); return true; }
  document.body.classList.add("staff");
  if (!keep.has(page)) page = NAV[0][0];
  shell(); go(page);
  // the 12-hour sign-in: check again every 10 minutes and when the tab comes back
  const recheck = async () => { const { data } = await db.rpc("my_staff_role"); if (!data || data.removed || data.expired) location.reload(); };
  setInterval(recheck, 600000); document.addEventListener("visibilitychange", () => { if (!document.hidden) recheck(); });
  db.channel("staff-live").on("postgres_changes", { event: "*", schema: "public" }, () => { if (!$("#panel").classList.contains("open")) go(page, true); }).subscribe();
  return true;
}
const staffCan = p => !window.STAFF || window.STAFF.perms.includes(p);

// shop list for staff without "shops_view": names / city / GSTIN only (no PAN, Aadhaar or KYC files)
const _q0 = q;
q = async function (t, sel, mod) {
  if (t === "shops" && window.STAFF && !staffCan("shops_view")) {
    let x = db.rpc("staff_shops_basic").select(sel && sel !== "*" ? sel : "*"); if (mod) x = mod(x);
    const { data, error } = await x; if (error) throw error; return data || [];
  }
  return _q0(t, sel, mod);
};
// exports stay with the owner
if (typeof csvDl === "function") { const _dl = csvDl; csvDl = function () { if (window.STAFF) return alert("Only the owner can download exports."); return _dl.apply(this, arguments); }; }

/** KYC document link: the owner opens the file; staff see it on screen only, watermarked with their email and the time. */
async function docLink(label, path, target) {
  if (!window.STAFF) { const { data } = await db.storage.from("kyc").createSignedUrl(path, 600); return `<a href="${data?.signedUrl}" target="_blank">${esc(label)}</a>`; }
  return `<a onclick="kycViewDoc('${esc(path)}','${esc(label)}','${esc(target || "")}')">${esc(label)}</a>`;
}
async function kycViewDoc(path, label, target) {
  const { data, error } = await db.functions.invoke("push", { body: { action: "kyc_view", path, target } });
  if (error || !data?.ok) return alert(data?.error || error?.message || "Couldn't open");
  if (!/^image\//.test(data.mime)) return alert("This file can only be opened by the owner.");
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;inset:0;z-index:99;background:rgba(29,15,48,.85);display:flex;align-items:center;justify-content:center;padding:20px";
  box.innerHTML = `<div style="position:relative;max-width:100%;max-height:100%"><canvas style="max-width:92vw;max-height:86vh;border-radius:10px;background:#fff"></canvas>
    <div style="color:#fff;font-size:12px;margin-top:6px">${esc(label)} · view only · <a style="color:#FFC21A;cursor:pointer" id="kvx">Close</a></div></div>`;
  box.oncontextmenu = e => e.preventDefault();
  box.onclick = e => { if (e.target === box || e.target.id === "kvx") box.remove(); };
  document.body.appendChild(box);
  const img = new Image();
  img.onload = () => {
    const c = box.querySelector("canvas"), w = img.naturalWidth, h = img.naturalHeight; c.width = w; c.height = h;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 6);
    const fs = Math.max(14, Math.round(Math.min(w, h) / 22)); g.font = `600 ${fs}px sans-serif`; g.fillStyle = "rgba(190,24,93,.35)"; g.textAlign = "center";
    for (let y = -h; y < h; y += fs * 4) for (let x = -w; x < w; x += g.measureText(data.mark).width + fs * 3) g.fillText(data.mark, x, y);
    g.restore(); img.src = "";   // nothing downloadable left on the page
  };
  img.src = `data:${data.mime};base64,${data.b64}`;
}

// ---------- Orders lookup (owner + SUPPORT) ----------
async function ordersPage() {
  $("#main").innerHTML = head("Orders lookup", "By order no., bill no. or the customer's 10-digit phone") + `<div class="box">
    <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="in" id="olq" placeholder="Order no. / bill no. / phone" style="min-width:260px" onkeydown="if(event.key==='Enter')olFind()">
    <button class="btn pink" onclick="olFind()">Find</button></div><div id="olr" style="margin-top:12px"></div></div>`;
}
async function olFind() {
  const v = $("#olq").value.trim(); if (v.length < 4) return;
  $("#olr").innerHTML = `<div class="sub">Searching…</div>`;
  const { data, error } = await db.rpc("admin_find_orders", { p_q: v });
  if (error) return $("#olr").innerHTML = `<div class="sub err">${esc(error.message)}</div>`;
  if (!data.length) return $("#olr").innerHTML = `<div class="sub">No order found.</div>`;
  const t = s => s ? new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
  $("#olr").innerHTML = data.map(o => `<div style="padding:12px 0;border-top:1px solid #F0EAF7">
    <b>#${esc(o.short_id || String(o.id).slice(0, 8))}</b> <span class="pill ${o.status === "DELIVERED" ? "ok" : /CANCEL|DECLIN/.test(o.status) ? "bad" : "warn"}">${esc(o.status)}</span>
    <div class="sub" style="margin:4px 0 0">${esc(o.shop)} · ₹${esc(o.total)} · ${esc(o.pay_mode || "cash")} · ${esc(o.delivery_type)} · ${esc(o.slot || "")}</div>
    <div class="sub" style="margin:2px 0 0">${esc(o.customer)} · ${esc(o.customer_phone || "—")} · ${esc(o.addr || "")}</div>
    ${o.courier ? `<div class="sub" style="margin:2px 0 0">${esc(o.courier)} · AWB ${esc(o.awb || "—")}</div>` : ""}
    ${o.cancel_reason || o.refuse_reason ? `<div class="sub" style="margin:2px 0 0;color:#BE185D">${esc(o.cancel_reason || "Refused: " + o.refuse_reason)}</div>` : ""}
    <details style="margin-top:4px"><summary class="sub" style="cursor:pointer">Timeline</summary>${(o.log || []).map(l => `<div class="sub" style="margin:2px 0">${esc(t(l.t || l.at))} · ${esc(l.s || "")}${l.by ? " · " + esc(l.by) : ""}${l.note ? " — " + esc(l.note) : ""}</div>`).join("")}</details></div>`).join("");
}

// ---------- Team (owner only) ----------
async function teamPage() {
  if (window.STAFF) return go(NAV[0][0]);
  const { data, error } = await db.rpc("admin_staff_list"); if (error) throw error;
  const day = s => s ? new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "never";
  const opts = sel => Object.entries(STAFF_ROLES).map(([k, n]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${n}</option>`).join("");
  $("#main").innerHTML = head("Team", "Staff sign in at galibazaar.site/admin with their email and see only their role's pages. A sign-in lasts 12 hours.") + `
    <div class="box"><h3>Invite</h3><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
      <input class="in" id="tmE" type="email" placeholder="name@…" style="min-width:240px"><select class="in" id="tmR">${opts("SUPPORT")}</select>
      <button class="btn pink" onclick="teamInvite()">Invite</button><span id="tmM" class="msg"></span></div>
      <div class="sub" style="margin-top:8px"><b>Support</b>: complaints, orders lookup, customers, seller chat · <b>KYC</b>: KYC queue (documents view-only, watermarked), photo review, shops · <b>Accounts</b>: payments, bank statement, books, tax &amp; TDS · <b>Tax accountant</b>: tax &amp; TDS only. Settings, UPI / bank, sales payouts, exports and this page stay with you.</div></div>
    <div class="box"><h3>People <span>• ${data.filter(s => s.active).length} active</span></h3>${data.length ? `<table><thead><tr><th>Email</th><th>Role</th><th>Last active</th><th></th></tr></thead><tbody>${data.map(s => `<tr>
      <td><b>${esc(s.email)}</b>${s.active ? "" : ` <span class="pill grey">removed ${esc(day(s.removed_at))}</span>`}</td>
      <td><select class="in" style="padding:6px" onchange="teamRole('${s.user_id}',this.value)">${opts(s.role)}</select></td>
      <td>${esc(day(s.last_seen_at))}</td>
      <td style="white-space:nowrap">${s.active ? `<button class="mini" onclick="teamRemove('${s.user_id}','${esc(s.email)}')">Remove</button>` : ""} <a class="mini" href="#activity" onclick="window.ACT_EMAIL='${esc(s.email)}'">Activity</a></td></tr>`).join("")}</tbody></table>` : `<div class="sub">Nobody yet.</div>`}</div>`;
}
async function teamInvite() {
  const email = $("#tmE").value.trim().toLowerCase(), role = $("#tmR").value, m = $("#tmM");
  m.className = "msg"; m.textContent = "Inviting…";
  const { data, error } = await db.functions.invoke("push", { body: { action: "staff_invite", email, role } });
  if (error || !data?.ok) { m.className = "msg err"; m.textContent = data?.error || error?.message || "Couldn't invite"; return; }
  m.className = "msg ok"; m.textContent = data.mailed ? "Added · invite email sent" : "Added · the email didn't go — tell them to sign in at galibazaar.site/admin";
  setTimeout(teamPage, 1200);
}
async function teamRole(u, r) { const { error } = await db.rpc("admin_staff_set_role", { p_user: u, p_role: r }); if (error) alert(error.message); teamPage(); }
async function teamRemove(u, e) {
  if (!confirm(`Remove ${e}? They lose access right now and are signed out.`)) return;
  const { error } = await db.rpc("admin_staff_remove", { p_user: u }); if (error) alert(error.message); teamPage();
}

// ---------- Activity log (owner only) ----------
async function activityPage() {
  if (window.STAFF) return go(NAV[0][0]);
  const who = window.ACT_EMAIL || ""; window.ACT_EMAIL = "";
  const [{ data: team }, { data, error }] = await Promise.all([db.rpc("admin_staff_list"), db.rpc("admin_activity", { p_email: who || null, p_limit: 300 })]);
  if (error) throw error;
  const t = s => new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const short = v => v == null ? "—" : esc(JSON.stringify(v).slice(0, 140));
  $("#main").innerHTML = head("Activity log", "Every action by you and the team: who, role, what, old → new") + `<div class="box">
    <select class="in" onchange="window.ACT_EMAIL=this.value;activityPage()"><option value="">Everyone</option>${(team || []).map(s => `<option ${s.email === who ? "selected" : ""}>${esc(s.email)}</option>`).join("")}</select>
    ${(data || []).length ? `<table style="margin-top:10px"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Old → new</th></tr></thead><tbody>${data.map(l => `<tr>
      <td style="white-space:nowrap">${esc(t(l.at))}</td><td>${esc(l.email || "system")}<div class="sub" style="margin:0">${esc(l.role || "")}</div></td>
      <td>${esc(l.action)}${l.note ? `<div class="sub" style="margin:0">${esc(l.note)}</div>` : ""}</td><td>${esc(l.target_kind || "")} ${esc(String(l.target || "").slice(0, 36))}</td>
      <td style="font-size:12px;overflow-wrap:anywhere">${short(l.old_value)} → ${short(l.new_value)}</td></tr>`).join("")}</tbody></table>` : `<div class="sub" style="margin-top:10px">Nothing yet.</div>`}</div>`;
}
