/* Admin — sales partners (update-52): applications, approve with %/type, KYC + bank check, pay commission (UTR + TDS preview), Form 16A, change terms.
 * All rules are enforced by the server functions; this file only shows and sends. */
const SPT = (t, m) => t === "one_time" ? "One-time" : t === "period" ? `First ${m} months` : "Permanent";
const mny2 = x => "₹" + Number(x || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const spErr = e => /function|schema cache|column .* does not exist/.test(e.message || "") ? "Run update-52-sales-partner.sql in Supabase first." : (e.message || "").replace(/^.*exception:\s*/i, "");
let SPC = { apps: 0, kyc: 0 };
if (typeof window.toast !== "function") window.toast = m => alert(m);
if (typeof window.niceErr !== "function") window.niceErr = e => spErr(e);
document.head.insertAdjacentHTML("beforeend", `<style>.fchip{border:1px solid #E6E1EF;background:#fff;border-radius:999px;padding:8px 14px;font:600 13px Poppins,sans-serif;color:#1D0F30;cursor:pointer}.fchip.on{background:#1D0F30;color:#fff;border-color:#1D0F30}</style>`);
function spTabs(on) {
  const t = [["team", "Team"], ["apps", `Applications${SPC.apps ? ` <span class="pill warn">${SPC.apps}</span>` : ""}`], ["kyc", `KYC${SPC.kyc ? ` <span class="pill warn">${SPC.kyc}</span>` : ""}`], ["pay", "Pay commission"], ["f16", "Form 16A"]];
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px">${t.map(([k, l]) => `<button class="fchip ${k === on ? "on" : ""}" onclick="salesTab('${k}')">${l}</button>`).join("")}</div>`;
}
let SALES_TAB = "team";
function salesTab(k) { SALES_TAB = k; sales(); }
async function sales() {
  const [a, k] = await Promise.all([db.from("sales_applications").select("id", { count: "exact", head: true }).eq("status", "applied"), db.from("sales_people").select("id", { count: "exact", head: true }).eq("kyc", "PENDING")]);
  SPC = { apps: a.count || 0, kyc: k.count || 0 };
  return ({ team: salesTeam, apps: spApps, kyc: spKycList, pay: spPay, f16: spF16 }[SALES_TAB] || salesTeam)();
}
function sheet(title, body) { const el = $("#panel"); el.classList.add("open"); document.body.classList.add("po"); el.innerHTML = `<h2><span>${title}</span><button class="x" onclick="closeForm()" aria-label="Close">×</button></h2>${body}`; return el; }
function termsFields(p, def) {
  const t = p?.commission_type || "permanent";
  return `<label>COMMISSION % (OF PLAN AMOUNT AFTER GST)</label><input class="in" id="tp" type="number" min="1" max="50" value="${p?.commission_pct ?? def}">
    <label>COMMISSION TYPE</label><div style="display:flex;gap:8px;flex-wrap:wrap">${[["one_time", "One-time"], ["permanent", "Permanent"], ["period", "For a period"]].map(([v, l]) => `<label style="display:flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0;font-size:13.5px;color:#1D0F30;border:1px solid #E6E1EF;border-radius:12px;padding:9px 12px;margin:0"><input type="radio" name="tt" value="${v}" ${t === v ? "checked" : ""} onchange="$('#tmw').style.display=this.value==='period'?'block':'none'"> ${l}</label>`).join("")}</div>
    <div id="tmw" style="display:${t === "period" ? "block" : "none"}"><label>MONTHS AFTER THE SHOP JOINS</label><input class="in" id="tm" type="number" min="1" max="60" value="${p?.commission_months || 12}"></div>
    <div class="sub" style="font-size:12px">One-time = only the shop's first approved plan payment · Permanent = every plan payment while subscribed · Period = every plan payment for N months after the shop joins.</div>
    <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:13px;color:#1D0F30;font-weight:500;margin-top:10px"><input type="checkbox" id="tk" ${p?.kyc_first === false ? "" : "checked"}> Code &amp; commission only after KYC (recommended)</label>`;
}
const termsVal = () => { const t = document.querySelector("input[name=tt]:checked").value; return { p_pct: +$("#tp").value, p_type: t, p_months: t === "period" ? +$("#tm").value : null, p_kyc_first: $("#tk").checked }; };

// ---------- applications ----------
let APPS = [];
async function spApps() {
  APPS = await q("sales_applications", "*", x => x.order("created_at", { ascending: false }).limit(200));
  const pill = s => `<span class="pill ${s === "applied" ? "warn" : s === "approved" ? "ok" : "bad"}">${s === "applied" ? "New" : s === "approved" ? "Approved" : "Rejected"}</span>`;
  $("#main").innerHTML = head("Sales team", "People who applied to become sales partners") + spTabs("apps") + `<div class="box">${APPS.length ? `<table><thead><tr><th>NAME</th><th class="hi">CITY</th><th class="hi">HOW</th><th>APPLIED</th><th>STATUS</th><th></th></tr></thead><tbody>${APPS.map(a => `<tr>
    <td><b>${esc(a.name)}</b><br><span class="sub">${esc(a.phone)} · ${esc(a.email)}</span></td><td class="hi">${esc(a.city)}</td><td class="hi">${esc(a.how || "—")}${a.occupation ? `<br><span class="sub">${esc(a.occupation)}</span>` : ""}</td>
    <td>${(a.created_at || "").slice(0, 10)}<br><span class="sub">${esc(a.platform)}</span></td><td>${pill(a.status)}${a.reject_reason ? `<br><span class="sub">${esc(a.reject_reason)}</span>` : ""}</td>
    <td>${a.status === "applied" ? `<button class="edit" onclick="spApprove('${a.id}')">Approve</button> <button class="edit" style="color:#BE185D" onclick="spReject('${a.id}')">Reject</button>` : ""}</td></tr>`).join("")}</tbody></table>` : `<div class="sub">No applications yet. The apply page is galibazaar.site/sales/apply/ (also in the app).</div>`}</div>`;
}
async function spApprove(id) {
  const a = APPS.find(x => x.id === id), { data: st } = await db.from("settings").select("sales_default_pct").eq("id", 1).single();
  sheet("Approve " + esc(a.name), `<div class="sub">${esc(a.phone)} · ${esc(a.email)} · ${esc(a.city)}</div>${termsFields(null, st?.sales_default_pct ?? 20)}
    <div class="note">They get an email, set up their login, then complete KYC. Their code works only after you approve the KYC.</div>
    <div class="msg" id="am"></div><button class="btn pink full" id="ago">Approve</button>`);
  $("#ago").onclick = async () => {
    const v = termsVal(); if (!(v.p_pct >= 1 && v.p_pct <= 50)) { $("#am").className = "msg err"; $("#am").textContent = "Commission must be 1–50%"; return; }
    const { error } = await db.rpc("admin_decide_sales_application", { p_id: id, p_approve: true, p_pct: v.p_pct, p_type: v.p_type, p_months: v.p_months, p_kyc_first: v.p_kyc_first, p_reason: null });
    if (error) { $("#am").className = "msg err"; $("#am").textContent = spErr(error); return; }
    closeForm(); sales();
  };
}
function spReject(id) {
  const a = APPS.find(x => x.id === id);
  sheet("Reject " + esc(a.name), `<label>REASON (SENT TO THEM)</label><select class="in" id="rr"><option>We already have enough partners in your area</option><option>Details could not be verified</option><option>Under 18 / not eligible</option><option value="">Other…</option></select>
    <input class="in" id="ro" placeholder="Write the reason" style="margin-top:8px"><div class="sub">They can apply again after 30 days.</div><div class="msg" id="rm"></div><button class="btn dark full" id="rgo">Reject</button>`);
  $("#rgo").onclick = async () => {
    const r = ($("#rr").value || $("#ro").value).trim(); if (!r) { $("#rm").className = "msg err"; $("#rm").textContent = "Write a reason"; return; }
    const { error } = await db.rpc("admin_decide_sales_application", { p_id: id, p_approve: false, p_reason: r });
    if (error) { $("#rm").className = "msg err"; $("#rm").textContent = spErr(error); return; }
    closeForm(); sales();
  };
}
// change % / type for an existing partner — applies to future payments, they see the popup again
async function spTerms(id) {
  const p = SP.find(x => x.id === id); if (!p) return;
  sheet("Commission — " + esc(p.name), termsFields(p, 20) + `<div class="note">Applies only to future plan payments. ${esc(p.name)} sees the “How your commission works” screen again and must accept.</div>
    <div class="msg" id="tmm"></div><button class="btn pink full" id="tgo">Save commission</button>
    <div style="border-top:1px solid #F0EAF7;margin-top:16px;padding-top:12px"><button class="mini" style="color:${p.status === "blocked" ? "#15803D" : "#BE185D"}" onclick="spBlockAll('${id}',${p.status !== "blocked"})">${p.status === "blocked" ? "Unblock sales partner" : "Block sales partner (code stops, payouts stop)"}</button></div>`);
  $("#tgo").onclick = async () => {
    const v = termsVal();
    const { error } = await db.rpc("admin_set_sales_terms", { p_sales: id, ...v });
    if (error) { $("#tmm").className = "msg err"; $("#tmm").textContent = spErr(error); return; }
    $("#tmm").className = "msg ok"; $("#tmm").textContent = "✓ Saved — they'll accept the new terms at next sign-in"; SP = await q("sales_people", "*", x => x.order("created_at"));
  };
}
async function spBlockAll(id, block) {
  if (block && !confirm("Block this sales partner? Their code stops working and no payouts can be made.")) return;
  const { error } = await db.rpc("admin_block_sales", { p_sales: id, p_block: block }); if (error) return alert(spErr(error));
  closeForm(); sales();
}

// ---------- KYC: documents, selfie, bank + name match ----------
async function signed(bucket, path) { if (!path) return null; const { data } = await db.storage.from(bucket).createSignedUrl(path, 900); return data?.signedUrl || null; }
async function spKycList() {
  const list = await q("sales_people", "*", x => x.in("kyc", ["PENDING", "REJECTED", "APPROVED"]).order("kyc_submitted_at", { ascending: false }));
  const hold = list.filter(p => p.bank_hold);
  $("#main").innerHTML = head("Sales team", "Check PAN, Aadhaar, selfie and bank before the code goes live") + spTabs("kyc") + `<div class="box"><table><thead><tr><th>NAME</th><th>PAN</th><th class="hi">SUBMITTED</th><th>KYC</th><th></th></tr></thead><tbody>${list.map(p => `<tr>
    <td><b>${esc(p.name)}</b><br><span class="sub">${esc(p.code)} · ${esc(p.city || "")}</span></td><td>${esc(p.pan || "—")}<br><span class="sub">${esc(p.pan_name || "")}</span></td><td class="hi">${(p.kyc_submitted_at || "").slice(0, 10)}</td>
    <td><span class="pill ${p.kyc === "APPROVED" ? "ok" : p.kyc === "PENDING" ? "warn" : "bad"}">${p.kyc}</span>${p.bank_hold ? `<br><span class="pill warn">Bank changed</span>` : ""}</td>
    <td><button class="edit" onclick="spKyc('${p.id}')">${p.kyc === "PENDING" || p.bank_hold ? "Check" : "View"}</button></td></tr>`).join("") || `<tr><td colspan="5" class="sub">No KYC submitted yet.</td></tr>`}</tbody></table>
    ${hold.length ? `<div class="sub">${hold.length} partner(s) changed bank details — payouts wait until you approve.</div>` : ""}</div>`;
}
async function spKyc(id) {
  const { data: p } = await db.from("sales_people").select("*").eq("id", id).single();
  const { data: b, error } = await db.rpc("admin_sales_bank", { p_sales: id, p_full: false }); if (error) return alert(spErr(error));
  const f = p.kyc_files || {}, urls = {};
  for (const k of ["pan", "aadhaar_front", "aadhaar_back", "selfie"]) urls[k] = await signed("kyc", f[k]);
  if (b?.proof) urls.cheque = await signed("kyc", b.proof);
  const norm = s => String(s || "").toUpperCase().replace(/[^A-Z]/g, ""), match = b && norm(b.holder) === norm(p.pan_name);
  const pic = (k, l) => `<div style="flex:1;min-width:130px"><div class="sub" style="font-size:11.5px;margin:0 0 4px">${l}</div>${urls[k] ? `<a href="${urls[k]}" target="_blank"><img src="${urls[k]}" style="width:100%;height:110px;object-fit:cover;border-radius:10px;border:1px solid #EEE7F6"></a>` : `<div class="sub">—</div>`}</div>`;
  const row = (k, v) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #F4F0FA"><span class="sub" style="margin:0">${k}</span><b style="text-align:right">${v}</b></div>`;
  sheet("KYC — " + esc(p.name), `<div class="sub">${esc(p.email || "")} · ${esc(p.phone || "")} · code ${esc(p.code)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${pic("pan", "PAN")}${pic("selfie", "Live selfie")}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${pic("aadhaar_front", "Aadhaar front")}${pic("aadhaar_back", "Aadhaar back")}</div>
    <h3 style="margin:14px 0 4px">Identity</h3>${row("Name on PAN", esc(p.pan_name || "—"))}${row("PAN", esc(p.pan || "—"))}${row("Aadhaar", "XXXX XXXX " + esc(p.aadhaar_last4 || "—"))}
    ${row("Address", esc([p.house, p.area, p.city, p.state, p.pin].filter(Boolean).join(", ")))}${row("UPI", esc(p.upi || "—"))}${p.gstin ? row("GSTIN", esc(p.gstin)) : ""}
    <h3 style="margin:14px 0 4px">Bank ${b ? `<span class="pill ${b.status === "approved" ? "ok" : b.status === "pending" ? "warn" : "bad"}">${b.status}</span>` : ""}</h3>
    ${b ? row("Holder", esc(b.holder) + (match ? ` <span class="pill ok">matches PAN</span>` : ` <span class="pill bad">doesn't match PAN</span>`)) + row("Account", `<span id="acc">${esc(b.masked)}</span> <a href="#" style="color:#6A1BB0;font-size:12px" onclick="spShowAcc('${id}');return false">Show</a>`)
      + row("IFSC", esc(b.ifsc) + (b.bank_name ? `<br><span class="sub" style="margin:0">${esc(b.bank_name)} · ${esc(b.branch || "")}</span>` : "")) + row("Type", esc(b.acct_type)) + `<div style="margin-top:8px">${pic("cheque", "Cancelled cheque / passbook — check name, account no. and IFSC")}</div>` : `<div class="sub">No bank details.</div>`}
    ${p.kyc === "APPROVED" && !p.bank_hold ? `<div class="okline" style="margin-top:12px">✓ KYC approved</div>` : `
    <label style="margin-top:14px">REASON (ONLY IF REJECTING)</label><select class="in" id="kr"><option value="">—</option><option>PAN photo is not clear</option><option>Selfie doesn't match the PAN photo</option><option>Bank account name doesn't match PAN</option><option>Cheque / passbook doesn't show the account number or IFSC</option><option>Aadhaar shows the full number — please mask the first 8 digits</option></select>
    <div class="msg" id="km"></div><div style="display:flex;gap:8px"><button class="btn pink" style="flex:1" onclick="spKycDo('${id}',true)">Approve${p.bank_hold && p.kyc === "APPROVED" ? " new bank" : " KYC"}</button><button class="btn ghost" style="flex:1;color:#BE185D" onclick="spKycDo('${id}',false)">Reject</button></div>`}`);
}
async function spShowAcc(id) { const { data, error } = await db.rpc("admin_sales_bank", { p_sales: id, p_full: true }); if (error) return alert(spErr(error)); $("#acc").textContent = data.account; }
async function spKycDo(id, ok) {
  const r = $("#kr").value; if (!ok && !r) { $("#km").className = "msg err"; $("#km").textContent = "Pick a reason"; return; }
  const { error } = await db.rpc("admin_sales_kyc", { p_sales: id, p_approve: ok, p_reason: ok ? null : r });
  if (error) { $("#km").className = "msg err"; $("#km").textContent = spErr(error); return; }
  closeForm(); sales();
}

// ---------- pay commission: tick dues → TDS preview → mode, UTR, date, screenshot ----------
async function spPay() {
  const [sp, due] = await Promise.all([q("sales_people", "id,name,code,kyc,bank_hold,status,upi"), q("commissions", "*", x => x.eq("status", "DUE").order("created_at"))]);
  const by = sp.map(p => ({ p, list: due.filter(c => c.sales === p.id) })).filter(x => x.list.length);
  $("#main").innerHTML = head("Sales team", "Pay due commission — every payout needs the bank UTR") + spTabs("pay") + (by.length ? by.map(({ p, list }) => {
    const sum = list.reduce((a, c) => a + Number(c.amount), 0), blocked = p.kyc !== "APPROVED" ? "KYC not approved" : p.bank_hold ? "Bank change waiting for approval" : p.status === "blocked" ? "Blocked" : "";
    return `<div class="box"><div style="display:flex;align-items:center;gap:10px"><div style="flex:1"><b>${esc(p.name)}</b> <span class="sub" style="margin:0">${esc(p.code)}</span></div><b style="color:#6D28D9">${mny2(sum)} due</b>
      ${blocked ? `<span class="pill bad">${blocked}</span>` : `<button class="btn pink" style="padding:9px 14px" onclick="spPayOpen('${p.id}')">Pay</button>`}</div>
      <div class="sub" style="margin-top:4px">${list.length} entr${list.length === 1 ? "y" : "ies"}${list.some(c => c.kind === "ADJUST") ? " · includes refund adjustment" : ""}</div></div>`;
  }).join("") : `<div class="box"><div class="sub">Nothing due right now.</div></div>`);
  window._SPP = { sp, due };
}
async function spPayOpen(id) {
  const { sp, due } = window._SPP, p = sp.find(x => x.id === id), list = due.filter(c => c.sales === id), shops = await q("shops", "id,name");
  const { data: b } = await db.rpc("admin_sales_bank", { p_sales: id, p_full: false });
  sheet("Pay " + esc(p.name), `<div class="sub">${b ? `${esc(b.holder)} · ${esc(b.masked)} · ${esc(b.ifsc)}` : ""} ${p.upi ? " · UPI " + esc(p.upi) : ""}</div>
    <div style="margin-top:10px">${list.map(c => `<label style="display:flex;gap:10px;align-items:center;text-transform:none;letter-spacing:0;font-size:13px;color:#1D0F30;font-weight:500;border-bottom:1px solid #F4F0FA;padding:7px 0;margin:0">
      <input type="checkbox" class="pc" value="${c.id}" ${c.kind === "ADJUST" ? "checked disabled" : "checked"}><span style="flex:1">${esc(shops.find(s => s.id === c.shop)?.name || "Shop")}${c.kind === "ADJUST" ? " · refund adjustment" : ""}<br><span class="sub" style="margin:0">${(c.created_at || "").slice(0, 10)} · ${c.plan_amount != null ? `plan ${mny2(c.plan_amount)} → after GST ${mny2(c.taxable)}` : ""} · ${c.pct}%</span></span><b>${mny2(c.amount)}</b></label>`).join("")}</div>
    <div id="tdsv" style="background:#F6F2FB;border-radius:14px;padding:12px 14px;margin:12px 0"></div>
    <label>MODE</label><select class="in" id="pm"><option>IMPS</option><option>NEFT</option><option>RTGS</option><option>UPI</option></select>
    <label>UTR / UPI REFERENCE (FROM YOUR BANK)</label><input class="in" id="pu" style="text-transform:uppercase" autocomplete="off">
    <label>PAYMENT DATE</label><input class="in" id="pd" type="date" value="${new Date(Date.now() + 19800000).toISOString().slice(0, 10)}">
    <label>BANK SCREENSHOT (OPTIONAL)</label><input class="in" id="ps" type="file" accept="image/*">
    <div class="msg" id="pmm"></div><button class="btn pink full" id="pgo">Record payout &amp; send advice</button>
    <div class="sub" style="font-size:11.5px">Pay from your bank app first, then record it here. The partner gets a notification, an email and a PDF advice.</div>`);
  const ids = () => [...document.querySelectorAll(".pc")].filter(i => i.checked).map(i => i.value);
  const prev = async () => {
    const { data, error } = await db.rpc("admin_tds_preview", { p_sales: id, p_ids: ids() });
    $("#tdsv").innerHTML = error ? `<span class="err">${esc(spErr(error))}</span>` : `<div style="display:flex;justify-content:space-between"><span>Gross</span><b>${mny2(data.gross)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>TDS u/s 194H ${data.tds > 0 ? `@ ${data.rate}%` : `(FY total ${mny2(data.fy_credited)} — below ${mny2(data.threshold)})`}</span><b>− ${mny2(data.tds)}</b></div>
      <div style="display:flex;justify-content:space-between;font-size:16px;margin-top:4px"><span><b>Pay this</b></span><b style="color:#16A34A">${mny2(data.net)}</b></div>${data.has_pan ? "" : `<div class="warnline">No PAN — higher TDS rate</div>`}`;
  };
  document.querySelectorAll(".pc").forEach(i => i.onchange = prev); prev();
  $("#pgo").onclick = async () => {
    const m = $("#pmm"), utr = $("#pu").value.replace(/\s/g, "").toUpperCase();
    if (!ids().length) { m.className = "msg err"; m.textContent = "Tick at least one entry"; return; }
    if (!/^[A-Z0-9]{6,30}$/.test(utr)) { m.className = "msg err"; m.textContent = "Enter the UTR / reference from your bank (6–30 letters or numbers)"; return; }
    $("#pgo").disabled = true; let shot = null;
    const file = $("#ps").files[0];
    if (file) { const { data: { session } } = await db.auth.getSession(); shot = `${session.user.id}/payout_${id}_${Date.now()}.jpg`; const up = await db.storage.from("proofs").upload(shot, file, { contentType: file.type || "image/jpeg" }); if (up.error) shot = null; }
    const { data, error } = await db.rpc("pay_commissions_v2", { p_sales: id, p_ids: ids(), p_mode: $("#pm").value, p_utr: utr, p_date: $("#pd").value, p_screenshot: shot });
    $("#pgo").disabled = false;
    if (error) { m.className = "msg err"; m.textContent = spErr(error); return; }
    m.className = "msg ok"; m.innerHTML = `✓ Recorded ${esc(data.advice_no || "")} · net ${mny2(data.net)}. <a href="#" onclick="advicePdfAdmin('${data.payout || data.id}');return false" style="color:#6A1BB0">Download advice PDF</a>`;
    window._SPP.due = window._SPP.due.filter(c => !ids().includes(c.id)); setTimeout(spPay, 50);
  };
}
async function advicePdfAdmin(pid) { if (!window.advicePdf) await new Promise(ok => { const s = document.createElement("script"); s.src = "/sales/partner.js?v=1795480000"; s.onload = ok; document.head.appendChild(s); }); advicePdf(pid, db); }

// ---------- Form 16A upload (per partner, per quarter) ----------
async function spF16() {
  const [sp, list] = await Promise.all([q("sales_people", "id,name,code,pan", x => x.not("pan", "is", null).order("name")), q("form16a", "*", x => x.order("uploaded_at", { ascending: false }))]);
  const d0 = new Date(Date.now() + 19800000), y0 = d0.getUTCMonth() < 3 ? d0.getUTCFullYear() - 1 : d0.getUTCFullYear(), fy = `${y0}-${String(y0 + 1).slice(2)}`;
  $("#main").innerHTML = head("Sales team", "Upload Form 16A each quarter after TDS is filed — partners download it from their Payouts page") + spTabs("f16") + `<div class="box" style="max-width:640px">
    <label>SALES PARTNER</label><select class="in" id="fs">${sp.map(p => `<option value="${p.id}">${esc(p.name)} · ${esc(p.code)} · ${esc(p.pan)}</option>`).join("")}</select>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px"><div><label>FINANCIAL YEAR</label><input class="in" id="ff" value="${esc(fy)}" placeholder="2026-27"></div><div><label>QUARTER</label><select class="in" id="fq"><option value="1">Q1 (Apr–Jun)</option><option value="2">Q2 (Jul–Sep)</option><option value="3">Q3 (Oct–Dec)</option><option value="4">Q4 (Jan–Mar)</option></select></div></div>
    <label>FORM 16A (PDF)</label><input class="in" id="fp" type="file" accept="application/pdf"><div class="msg" id="fm"></div><button class="btn pink full" id="fgo">Upload</button></div>
    <div class="box"><h3>Uploaded</h3>${list.map(f => `<div class="row"><div><b>${esc(sp.find(p => p.id === f.sales)?.name || "—")}</b><span>Q${f.quarter} FY ${esc(f.fy)} · ${(f.uploaded_at || "").slice(0, 10)}</span></div></div>`).join("") || `<div class="sub">None yet.</div>`}</div>`;
  $("#fgo").onclick = async () => {
    const m = $("#fm"), file = $("#fp").files[0], s = $("#fs").value, fyv = $("#ff").value.trim(), qv = +$("#fq").value;
    if (!s || !file || !/^\d{4}-\d{2}$/.test(fyv)) { m.className = "msg err"; m.textContent = "Pick the partner, year like 2026-27, and the PDF"; return; }
    const path = `${s}/16A_${fyv}_Q${qv}.pdf`;
    const up = await db.storage.from("form16a").upload(path, file, { contentType: "application/pdf", upsert: true }); if (up.error) { m.className = "msg err"; m.textContent = spErr(up.error); return; }
    const { error } = await db.from("form16a").upsert({ sales: s, fy: fyv, quarter: qv, path }, { onConflict: "sales,fy,quarter" });
    if (error) { m.className = "msg err"; m.textContent = spErr(error); return; }
    spF16();
  };
}
