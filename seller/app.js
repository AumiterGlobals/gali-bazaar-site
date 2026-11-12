// Gali Bazaar — Seller panel on the web (same shop + data as the seller app; RLS = only your shop).
// Routes: /seller/login/  /seller/  /seller/orders/  /seller/catalog/  /seller/catalog/bulk/  /seller/returns/
//         /seller/complaints/  /seller/staff/  /seller/slots/  /seller/bills/  /seller/shop/
const db = makeClient("gb-seller-auth");
const BANNED = /(cigar|cigarette|bidi|beedi|gutkha|gutka|tobacco|tambaku|khaini|zarda|pan masala|paan masala|hookah|vape|e-cig|nicotine|snuff|beer|whisky|whiskey|vodka|\brum\b|wine|liquor|daru|sharab|सिगरेट|बीड़ी|बीडी|गुटखा|तंबाकू|तम्बाकू|खैनी|ज़र्दा|जर्दा|शराब|दारू)/i;
const banWord = (...s) => { for (const x of s) { const m = x && String(x).match(BANNED); if (m) return /cig|bidi|beedi|gutk|tobac|tamba|khain|zard|masala|hookah|vape|nicot|snuff|सिग|बीड़|बीडी|गुट|तंब|तम्ब|खैन|ज़र्द|जर्द/i.test(m[0]) ? "tobacco" : "alcohol"; } return null; };
const ICON = {
  dash: "M3 11 12 4l9 7v9h-6v-6H9v6H3z", orders: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01", cat: "M4 9h16l-1.5-5h-13zM5 9v11h14V9M9 20v-6h6v6",
  ret: "M6 6l12 12M18 6 6 18", comp: "M3 6h18v12H3zM3 7l9 6 9-6", staff: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 7M22 21c0-3-2-5-4-5.6",
  slots: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2", bills: "M6 3h9l4 4v14H6zM14 3v5h5", books: "M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h6M8 11h6", shop: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4",
};
const NAV = [["", "Dashboard", "dash"], ["orders", "Orders", "orders"], ["catalog", "Catalog", "cat"], ["returns", "Returns & cancelled", "ret"], ["complaints", "Complaints", "comp"],
  ["staff", "Delivery staff", "staff"], ["slots", "Slots & areas", "slots"], ["bills", "Bills & GST", "bills"], ["books", "Books & expenses", "books"], ["shop", "Shop & KYC", "shop"]];
const ico = (k, s = 19) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[k] || k}"/></svg>`;
let S = null, me = null, D = { items: [], orders: [], riders: [], complaints: [], cns: [], slots: [], cov: [], festivals: [] };
let catF = "all", catQ = "", ordTab = "new", retTab = "coming", drawerOpen = false;
const route = () => location.pathname.replace(/^\/seller\/?/, "").replace(/\/$/, "");
const go = p => { history.pushState({}, "", "/seller/" + (p ? p + "/" : "")); page(); };
window.onpopstate = () => page();
const localDay = x => { const d = new Date(x); return isNaN(d) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const short = o => "#" + (o.short_id || String(o.id).slice(0, 6).toUpperCase());
const payable = o => { const kept = (o.items || []).filter(l => !(o.returned || []).includes(l.n)); return kept.length ? kept.reduce((a, l) => a + l.p * l.q, 0) + Number(o.fee || 0) : 0; };
const saleOf = o => o.status === "DELIVERED" ? payable(o) : 0;
const comingBack = o => (o.status === "DELIVERED" && (o.returned || []).length) || (o.status === "CANCELLED" && o.picked_at);
const backItems = o => o.status === "CANCELLED" ? (o.items || []) : (o.items || []).filter(l => (o.returned || []).includes(l.n));
const photos = i => (i.images && i.images.length ? i.images : [i.img_url]).filter(Boolean);
const STATUS = { PLACED: ["New", "bad"], ACCEPTED: ["Packing", "warn"], OUT: ["On the way", "grey"], DELIVERED: ["Delivered", "ok"], CANCELLED: ["Cancelled", "grey"], DECLINED: ["Rejected", "grey"] };
const pill = o => { const [l, c] = STATUS[o.status] || [o.status, "grey"]; return `<span class="pill ${c}">${l}</span>`; };
const retLabel = i => i.ret_policy === "replace" && i.ret_days ? `Replacement • ${i.ret_days} days` : i.ret_policy === "return" && i.ret_days ? `Return & refund • ${i.ret_days} days` : "At door only";
const daysLeft = () => S.sub_until ? Math.round((new Date(S.sub_until) - new Date(todayStr())) / 864e5) : null;
const live = () => S.kyc === "APPROVED" && !S.quality_hold && (S.sub_until || "") >= todayStr();

// ================= boot =================
async function boot() {
  if (route() === "login") return loginView();
  const { data: { session } } = await db.auth.getSession();
  if (!session) { location.replace("/seller/login/"); return; }
  me = session.user;
  const { data: shop, error } = await db.from("shops").select("*").eq("owner", me.id).maybeSingle();
  if (error) { document.body.innerHTML = `<div class="login">${LOGO}<h1>Couldn't open</h1><p class="sub">${esc(niceErr(error))}</p></div>`; return; }
  if (!shop) return notSeller(me.email);
  S = shop;
  await loadAll();
  shell(); page();
  liveSync(db, "seller", [["orders", `shop=eq.${S.id}`], ["items", `shop=eq.${S.id}`], ["riders", `shop=eq.${S.id}`], ["complaints", `shop=eq.${S.id}`],
    ["credit_notes", `shop=eq.${S.id}`], ["shops", `id=eq.${S.id}`], ["shop_slots", `shop=eq.${S.id}`], ["shop_coverage", `shop=eq.${S.id}`], "festivals"],
    async () => { const before = D.orders.filter(o => o.status === "PLACED").length; await loadAll(); refreshChrome(); if (!drawerOpen) page(); const now = D.orders.filter(o => o.status === "PLACED").length; if (now > before) { toast("🔔 New order"); beep(); } });
}
async function notSeller(email) {
  await db.auth.signOut();
  document.body.innerHTML = `<div class="login">${LOGO}<h1>This account isn't a seller account</h1><p class="sub">${esc(email || "")} doesn't own a shop on Gali Bazaar, so it can't open the seller panel. You've been signed out.<br><br>New shop? Download the app and tap <b>Register your shop</b> — KYC is done in the app.</p><a class="btn pink" href="/seller/login/">Sign in again</a> <a class="btn ghost" href="/#install">Download app</a></div>`;
}
function beep() { try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = .08; o.start(); setTimeout(() => { o.frequency.value = 1180; }, 150); setTimeout(() => { o.stop(); a.close(); }, 320); } catch (e) {} }

async function loadAll() {
  const since3 = new Date(Date.now() - 3 * 864e5).toISOString(), since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [shop, items, ords, rid, comp, cns, slots, cov, fest] = await Promise.all([
    db.from("shops").select("*").eq("id", S.id).single(),
    db.from("items").select("*").eq("shop", S.id).order("name"),
    db.from("orders").select("*").eq("shop", S.id).or(`created_at.gte.${since30},status.in.(PLACED,ACCEPTED,OUT)`).order("created_at", { ascending: false }).limit(600),
    db.from("riders").select("*").eq("shop", S.id).order("created_at"),
    db.from("complaints").select("*").eq("shop", S.id).order("created_at", { ascending: false }).limit(200),
    db.from("credit_notes").select("*").eq("shop", S.id).order("created_at", { ascending: false }).limit(300),
    db.from("shop_slots").select("*").eq("shop", S.id).order("from_t"),
    db.from("shop_coverage").select("*").eq("shop", S.id),
    db.from("festivals").select("*").gte("day", todayStr()).order("day").limit(3),
  ]);
  if (shop.data) S = shop.data;
  D = { items: items.data || [], orders: ords.data || [], riders: rid.data || [], complaints: comp.data || [], cns: cns.data || [], slots: slots.data || [], cov: cov.data || [], festivals: fest.data || [] };
  D.recent = D.orders.filter(o => o.created_at >= since3 || ["PLACED", "ACCEPTED", "OUT"].includes(o.status));
}

// ================= sign in (email code) =================
function loginView() {
  let email = "", stopCd = null;
  document.body.innerHTML = `<div class="auth"><div class="hero green"><div>${LOGO}<span class="pill2 g">SELLER PANEL</span></div>
      <h1>Run your shop<br>from your <em>laptop.</em></h1>
      <p>Same shop as the app. Upload your whole catalogue from Excel, add photos, see orders, returns, complaints and bills on a big screen.</p>
      <div class="feat"><div>📦<b>Bulk catalogue</b><span>Excel + photos</span></div><div>🧾<b>Orders &amp; bills</b><span>Accept, print</span></div><div>↩️<b>Returns</b><span>Check items in</span></div></div></div>
    <div class="form"><div class="card2"><h2>Seller sign in</h2><div class="sub">Use the <b>same email as your shop account</b> in the app.</div>
      <label>SHOP EMAIL</label><div class="inwrap"><input class="in" id="em" type="email" autocomplete="email" placeholder="yourshop@gmail.com"><span id="emok"></span></div>
      <div id="cw" style="display:none"><label>${OTP_LEN}-DIGIT CODE SENT TO YOUR EMAIL</label><div id="cb"></div><div class="sub" style="font-size:12px"><a href="#" id="rs" style="color:#7C3AED;pointer-events:none"></a></div></div>
      <div class="msg" id="lm"></div><button class="btn dark full" id="lb" style="padding:14px;border-radius:14px;font-size:14px;margin-top:6px">Send code</button>
      <div class="warnline" style="font-weight:500;margin-top:16px">Only shop owners can sign in here. New shop? Download the app and tap <b>Register your shop</b> — KYC is done in the app.</div>
      <p class="sub" style="font-size:12px"><a href="/" style="color:#7C3AED">← galibazaar.site</a></p></div></div></div>`;
  const boxes = codeBoxes($("#cb"), () => verify());
  const resendOn = () => { const a = $("#rs"); a.textContent = "Resend code"; a.style.pointerEvents = "auto"; };
  async function send() {
    const m = $("#lm"); email = $("#em").value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { m.className = "msg err"; m.textContent = "Enter your shop email"; return; }
    $("#lb").disabled = true; m.textContent = "";
    const ok = await db.rpc("seller_email_ok", { p_email: email });
    if (ok.error || ok.data !== true) {
      m.className = "msg err"; m.innerHTML = ok.error && /function|schema cache/.test(ok.error.message) ? "Seller panel isn't switched on yet — ask the Gali Bazaar admin." : "No shop is registered with this email. Use the email of your shop account in the app — or download the app and tap <b>Register your shop</b>.";
      $("#lb").disabled = false; return;
    }
    $("#emok").innerHTML = '<span class="ok2">✓ Shop found</span>';
    const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    $("#lb").disabled = false;
    if (error) { m.className = "msg err"; m.textContent = niceErr(error); return; }
    $("#cw").style.display = "block"; $("#em").disabled = true; $("#lb").textContent = "Sign in to my shop"; $("#lb").onclick = () => verify();
    m.className = "msg ok"; m.textContent = "Code sent. Check Inbox / Spam."; boxes.focus();
    const a = $("#rs"); a.style.pointerEvents = "none"; stopCd && stopCd(); stopCd = countdown(a, 45, resendOn);
  }
  async function verify() {
    const m = $("#lm"), v = boxes.value();
    if (v.length < 6) { m.className = "msg err"; m.textContent = "Enter the code from your email"; return; }
    $("#lb").disabled = true;
    const { error } = await db.auth.verifyOtp({ email, token: v, type: "email" });
    if (error) { $("#lb").disabled = false; m.className = "msg err"; m.textContent = "Wrong or expired code."; return; }
    location.href = "/seller/";
  }
  $("#lb").onclick = send; $("#em").onkeydown = e => { if (e.key === "Enter") send(); };
  $("#rs").onclick = e => { e.preventDefault(); $("#em").disabled = false; $("#lb").textContent = "Send code"; $("#lb").onclick = send; send(); };
  $("#em").focus();
}

// ================= layout =================
function counts() {
  return { neworders: D.orders.filter(o => o.status === "PLACED").length, ret: D.orders.filter(o => comingBack(o) && !o.return_checked_at).length, comp: D.complaints.filter(c => !c.reply).length };
}
function shell() {
  document.body.innerHTML = `<div class="app"><aside class="side">${LOGO}<div class="tagline g">SELLER PANEL</div><nav class="nav" id="snav"></nav>
    <div class="who"><div class="r"><span class="av" style="background:linear-gradient(135deg,#FFC93C,#FF8A1F)">${S.logo_url ? `<img src="${esc(S.logo_url)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">` : "🏪"}</span><div><b>${esc(S.name)}</b><small>${esc(me.email || "")}</small></div></div>
    <a href="/">← Website</a><a id="so">✕ Sign out</a></div></aside><main class="main" id="main"></main></div><div class="panel" id="panel"></div><div class="scrim" id="scrim"></div>`;
  document.querySelector(".app").insertAdjacentHTML("afterbegin", `<div class="mtop"><button id="mb" aria-label="Menu">☰</button>${LOGO}<small>Seller panel</small></div>`);
  $("#so").onclick = async () => { await db.auth.signOut(); location.href = "/seller/login/"; };
  $("#mb").onclick = () => menu(true); $("#scrim").onclick = () => { menu(false); };
  refreshChrome();
}
function refreshChrome() {
  const c = counts(), r = route().split("/")[0];
  $("#snav").innerHTML = NAV.map(([k, l, i]) => { const n = k === "orders" ? c.neworders : k === "returns" ? c.ret : k === "complaints" ? c.comp : 0;
    return `<a data-k="${k}" href="/seller/${k ? k + "/" : ""}" class="${k === r ? "on" : ""}">${ico(i)}<span>${l}</span>${n ? `<span class="badge">${n}</span>` : ""}</a>`; }).join("");
  $$("#snav a").forEach(a => a.onclick = e => { e.preventDefault(); menu(false); go(a.dataset.k); });
}
function menu(o) { $(".side").classList.toggle("open", o); $("#scrim").classList.toggle("open", o); }
// is the shop visible to customers? KYC approved + plan/trial running (+ not on hold)
function shopStatusPill() {
  const t = todayStr(), on = S.kyc === "APPROVED" && S.sub_until && S.sub_until >= t && !S.quality_hold;
  const why = S.kyc !== "APPROVED" ? (S.kyc === "PENDING" ? "KYC being checked" : "KYC not done") : !S.sub_until || S.sub_until < t ? "plan ended" : S.quality_hold ? "on hold" : "";
  return `<span class="pill ${on ? "ok" : "bad"}" style="margin-left:6px" title="Customers ${on ? "can" : "can't"} see your shop">${on ? "● Shop live on app" : "● Not live — " + why}</span>`;
}
function topRight(extra = "") {
  return `${extra}<button class="btn" style="background:${S.closed ? "#F0EEF4" : "#E6F8EE"};color:${S.closed ? "#6B6380" : "#15803D"};padding:9px 14px" onclick="toggleOpen()" title="Tap to ${S.closed ? "open" : "close"} the shop">● ${S.closed ? "Shop closed" : "Shop open"}</button>
    <div style="position:relative"><button class="btn ghost" style="padding:9px 12px" onclick="bell(event)">🔔${counts().neworders + counts().comp ? `<span class="badge" style="position:absolute;top:-6px;right:-6px">${counts().neworders + counts().comp}</span>` : ""}</button><div id="bellbox"></div></div>`;
}
function head(t, sub, extra = "") { return `<div class="top"><div><h1>${t}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div><div class="sp"></div><span class="live" id="livepill" title="Data updates by itself — this is not your shop's status">Synced</span>${shopStatusPill()}<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${topRight(extra)}</div></div>`; }
async function toggleOpen() {
  const to = !S.closed;
  if (to && !confirm("Close the shop now? Customers can't order until you open it again.")) return;
  const { error } = await db.from("shops").update({ closed: to }).eq("id", S.id);
  if (error) return toast(niceErr(error));
  S.closed = to; toast(to ? "Shop closed" : "Shop open"); page();
}
function bell(e) {
  e.stopPropagation(); const b = $("#bellbox");
  if (b.innerHTML) { b.innerHTML = ""; return; }
  const ev = [...D.orders.filter(o => o.status === "PLACED").map(o => ({ t: o.created_at, h: `New order ${short(o)} · ${inr(o.total)}`, go: "orders" })),
    ...D.complaints.filter(c => !c.reply).map(c => ({ t: c.created_at, h: `Complaint: ${c.reason}`, go: "complaints" })),
    ...D.orders.filter(o => comingBack(o) && !o.return_checked_at).map(o => ({ t: o.delivered_at || o.created_at, h: `${short(o)} items coming back`, go: "returns" }))].sort((a, b) => b.t > a.t ? 1 : -1).slice(0, 8);
  b.innerHTML = `<div class="sidrop" style="display:block;right:0;width:320px">${ev.length ? ev.map(x => `<a href="#" onclick="event.preventDefault();go('${x.go}')"><span><b style="font-size:13.5px">${esc(x.h)}</b><small>${ago(x.t)}</small></span></a>`).join("") : `<div class="sub" style="padding:14px">Nothing new.</div>`}</div>`;
  document.addEventListener("click", () => { b.innerHTML = ""; }, { once: true });
}
function page() {
  if (!S) return;
  closeDrawer(true); refreshChrome();
  const r = route();
  if (r === "catalog/bulk") return bulk();
  if (r === "catalog/new") { catalog(); return editItem(null); }
  ({ "": dash, orders, catalog, returns, complaints, staff, slots, bills, books, shop }[r.split("/")[0]] || dash)();
}
function drawer(html, wide) {
  const el = $("#panel"); el.innerHTML = html; el.classList.add("open"); el.style.width = wide ? "520px" : ""; document.body.classList.add("po"); drawerOpen = true;
}
function closeDrawer(silent) { const el = $("#panel"); if (!el) return; el.classList.remove("open"); document.body.classList.remove("po"); drawerOpen = false; if (!silent && route() === "catalog/new") history.replaceState({}, "", "/seller/catalog/"); }

// ================= Dashboard =================
function dash() {
  const t = todayStr(), hr = new Date().getHours();
  const todayDone = D.orders.filter(o => o.status === "DELIVERED" && localDay(o.delivered_at || o.created_at) === t);
  const sales = todayDone.reduce((a, o) => a + saleOf(o), 0), news = D.orders.filter(o => o.status === "PLACED");
  const cashO = D.orders.filter(o => o.status === "DELIVERED" && o.pay_mode === "CASH" && o.delivered_by && o.delivered_by !== "Shop" && !o.cash_settled_at && o.rider);
  const cash = cashO.reduce((a, o) => a + payable(o), 0), who = [...new Set(cashO.map(o => D.riders.find(r => r.id === o.rider)?.name).filter(Boolean))];
  const back = D.orders.filter(o => comingBack(o) && !o.return_checked_at), backV = back.reduce((a, o) => a + backItems(o).reduce((x, l) => x + l.p * l.q, 0), 0);
  const miss = D.items.filter(i => photos(i).length < 3).length, oos = D.items.filter(i => !i.in_stock).length, liveI = D.items.filter(i => photos(i).length >= 3 && i.in_stock).length;
  const dl = daysLeft(), paid = D.orders.length >= 0 && S.trial_used;
  const plan = S.kyc !== "APPROVED" ? (S.kyc === "PENDING" ? "KYC under verification" : "Finish KYC in the app") : dl == null ? "Plan not started" : dl < 0 ? "Plan ended — shop is offline" : `${S.trial_used ? "Plan" : "Free trial"} • ${dl} day${dl === 1 ? "" : "s"} left`;
  const fest = D.festivals.find(f => f.active !== false && (new Date(f.day) - new Date(t)) / 864e5 <= 7);
  const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  $("#main").innerHTML = head(`${greet}${S.pan_name ? ", " + esc(S.pan_name.split(" ")[0][0] + S.pan_name.split(" ")[0].slice(1).toLowerCase()) : ""}`,
      `${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} • ${esc(S.name)}${S.locality ? ", " + esc(S.locality) : ""}`,
      `<button class="btn pink" onclick="editItem(null)">＋ Add item</button>`) + `
    <div class="kpis k4">
      <div class="kpi"><span>Today's sales</span><b>${inr(sales)}</b><small>${todayDone.length} order${todayDone.length === 1 ? "" : "s"} delivered</small></div>
      <div class="kpi"><span>New orders</span><b class="pk">${news.length}</b><small>waiting for you</small></div>
      <div class="kpi"><span>Cash with staff</span><b class="or">${inr(cash)}</b><small>${who.length ? esc(who.join(", ")) + " • not handed over" : "All cash received"}</small></div>
      <div class="kpi"><span>Returns coming back</span><b class="pu">${back.length}</b><small>${inr(backV)} • check in</small></div>
    </div>
    ${!live() ? `<div class="warnline" style="margin:0 0 16px">Your shop is hidden from customers: ${S.kyc !== "APPROVED" ? (S.kyc === "PENDING" ? "KYC is being checked." : "finish KYC in the app.") : S.quality_hold ? "paused for quality — reply to your complaints." : "plan ended — send yourself the renewal link below."}</div>` : ""}
    <div class="grid2">
      <div class="box"><h3>New orders <a href="/seller/orders/" onclick="event.preventDefault();go('orders')" style="float:right;color:#7C3AED;font-size:13px;text-decoration:none">All orders →</a></h3>
        ${news.length ? orderTable(news.slice(0, 8), true) : `<div class="sub" style="padding:18px 0">No new orders right now. New orders appear here by themselves.</div>`}</div>
      <div>
        <div class="box"><h3>Quick actions</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn" style="background:#F3EDFF;text-align:left" onclick="editItem(null)">＋ Add item</button>
          <button class="btn" style="background:#FFE4EC;text-align:left" onclick="go('catalog/bulk')">⇪ Bulk upload</button>
          <button class="btn" style="background:#FFF3E2;text-align:left" onclick="go('slots')">◷ Slots</button>
          <button class="btn" style="background:#E6F8EE;text-align:left" onclick="go('staff')">👥 Delivery staff</button></div></div>
        ${fest ? `<div class="box" style="background:linear-gradient(135deg,#FF8A1F,#EF287B);color:#fff"><b style="font-size:16px">${esc(fest.name)} ${(new Date(fest.day) - new Date(t)) / 864e5 < 1 ? "is today" : "in " + Math.round((new Date(fest.day) - new Date(t)) / 864e5) + " days"}</b>
          <div style="font-size:12.5px;opacity:.9;margin:4px 0 10px">${D.items.filter(i => i.fest === fest.id).length} items tagged. Tag your festival items in the app (Dashboard → Festival items) — they show in the festival banner for customers near you.</div></div>` : ""}
        <div class="box"><h3>Catalogue health <span style="float:right">${D.items.length} items</span></h3>
          <div class="fu"><div><b style="font-weight:500">Missing photos (need all 3)</b></div><a class="pill bad" href="#" onclick="event.preventDefault();catF='missing';go('catalog')">${miss} items</a></div>
          <div class="fu"><div><b style="font-weight:500">Out of stock</b></div><a class="pill warn" href="#" onclick="event.preventDefault();catF='oos';go('catalog')">${oos} items</a></div>
          <div class="fu"><div><b style="font-weight:500">Live with 3 photos</b></div><span class="pill ok">${liveI} items</span></div></div>
        <div class="box" style="background:#1D0F30;color:#fff;display:flex;align-items:center;gap:12px"><div style="flex:1"><b style="font-size:15px">${esc(plan)}</b><div style="font-size:12px;color:#CFC6E3">Renewal link goes to your email</div></div>
          <button class="btn" style="background:#fff;color:#1D0F30;padding:9px 14px" onclick="sendLink(this)">Send link</button></div>
      </div></div>`;
}
async function sendLink(b) {
  b.disabled = true; b.textContent = "Sending…";
  const { data, error } = await db.functions.invoke("push", { body: { action: "renewal_link", shop: S.id } });
  b.disabled = false; b.textContent = "Send link";
  if (error || !data?.ok) return toast("Couldn't send the link. Try again.");
  toast(`Renewal link sent to ${data.email || "your email"}`);
}

// ================= Orders =================
function orderTable(list, compact) {
  const riderName = id => D.riders.find(r => r.id === id)?.name;
  return `<table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th class="hm">ITEMS</th><th>TOTAL</th><th class="hm">SLOT</th><th>STATUS</th><th></th></tr></thead><tbody>${list.map(o => `<tr style="cursor:pointer" onclick="if(event.target.closest('button'))return;openOrder('${o.id}')">
    <td><b>${short(o)}</b><br><span class="sub">${ago(o.created_at)}</span></td><td><b>${esc(o.cust_name)}</b>${o.outside ? `<br><span class="pill warn">Outside area • ${Number(o.outside_km || 0).toFixed(1)} km</span>` : ""}</td>
    <td class="hm">${(o.items || []).length} item${(o.items || []).length === 1 ? "" : "s"}</td><td><b>${inr(o.total)}</b></td><td class="hm">${esc(o.slot_label || "")}${o.slot_date && o.slot_date !== todayStr() ? `<br><span class="sub">${dmy(o.slot_date)}</span>` : ""}</td>
    <td>${pill(o)}${o.pin_locked ? `<br><span class="pill bad">PIN locked</span>` : ""}${o.rider && !compact ? `<br><span class="sub">🛵 ${esc(riderName(o.rider) || "")}</span>` : ""}</td>
    <td style="white-space:nowrap">${actions(o)}</td></tr>`).join("")}</tbody></table>`;
}
function actions(o) {
  if (o.status === "PLACED") return `<button class="mini" onclick="rejectOrder('${o.id}')">Reject</button><button class="mini" style="background:#16A34A;color:#fff;border-color:#16A34A" onclick="acceptOrder('${o.id}')">Accept</button>`;
  if (o.status === "ACCEPTED") return `<button class="mini" onclick="assign('${o.id}','ACCEPTED')">${o.rider ? "Change partner" : "Assign partner"}</button><button class="mini dk" onclick="dispatchOrder('${o.id}')">Out for delivery</button>`;
  if (o.status === "OUT") return `${o.pin_locked ? `<button class="mini" onclick="unlockPin('${o.id}')">Unlock PIN</button>` : ""}<button class="mini" onclick="openOrder('${o.id}')">View</button>`;
  if (comingBack(o) && !o.return_checked_at) return `<button class="mini dk" onclick="checkIn('${o.id}')">Check in</button>`;
  return `<button class="mini" onclick="printBill('${o.id}')">Bill</button>`;
}
function orders() {
  const T = [["new", "New", o => o.status === "PLACED"], ["packing", "Packing", o => o.status === "ACCEPTED"], ["out", "On the way", o => o.status === "OUT"],
    ["done", "Done (3 days)", o => ["DELIVERED", "CANCELLED", "DECLINED"].includes(o.status)]];
  const cur = T.find(t => t[0] === ordTab) || T[0], list = D.recent.filter(cur[2]);
  $("#main").innerHTML = head("Orders", "Running orders and the last 3 days • older ones are in Bills & GST") + `
    <div class="bar2"><div class="fchips">${T.map(([k, l, f]) => `<button class="fchip ${ordTab === k ? "on" : ""}" onclick="ordTab='${k}';orders()">${l} ${D.recent.filter(f).length}</button>`).join("")}</div></div>
    <div class="box">${list.length ? orderTable(list) : `<div class="sub" style="padding:18px 0">Nothing here.</div>`}</div>`;
}
const findO = id => D.orders.find(o => o.id === id);
async function setStatus(o, status, rider) {
  const log = [...(o.log || []), { s: status, t: new Date().toISOString() }];
  const patch = { status, log }; if (rider !== undefined) patch.rider = rider;
  const { data, error } = await db.from("orders").update(patch).eq("id", o.id).eq("status", o.status).select("id");
  if (error || !data || !data.length) { toast(error ? niceErr(error) : "This order was just changed on another screen — showing the latest."); await loadAll(); page(); return false; }
  Object.assign(o, patch); return true;
}
async function rejectOrder(id) { const o = findO(id); if (!o || !confirm(`Reject order ${short(o)}? The customer is told at once.`)) return; if (await setStatus(o, "DECLINED")) { toast("Order rejected"); page(); } }
async function acceptOrder(id) { assign(id, "PLACED"); }
function assign(id, from) {
  const o = findO(id), ok = D.riders.filter(r => r.active !== false && (!r.join_status || r.join_status === "ACTIVE"));
  drawer(`<h2><span>${from === "PLACED" ? "Accept" : "Delivery partner for"} ${short(o)}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <div class="sub">${esc(o.cust_name)} • ${inr(o.total)} • ${esc(o.slot_label || "")}</div>
    ${o.outside ? `<div class="warnline">Customer is ${Number(o.outside_km || 0).toFixed(1)} km outside your areas. Accept only if you can deliver.</div>` : ""}
    <label>WHO WILL DELIVER?</label>
    ${ok.map(r => `<div class="row" style="cursor:pointer" onclick="doAssign('${id}','${from}','${r.id}')"><div><b>🛵 ${esc(r.name)}</b><span>${esc(r.phone || "")}${r.kyc !== "APPROVED" ? " • KYC " + esc(String(r.kyc).toLowerCase()) : ""}</span></div><span class="mini dk">Choose</span></div>`).join("") || `<div class="sub">No delivery partners yet — add them in Delivery staff.</div>`}
    <div class="row" style="cursor:pointer" onclick="doAssign('${id}','${from}','self')"><div><b>🙋 I'll deliver myself</b><span>You'll use the app's delivery screen (PIN check)</span></div><span class="mini">Choose</span></div>
    ${from === "PLACED" ? `<button class="btn ghost full" style="margin-top:12px" onclick="doAssign('${id}','PLACED','')">Accept now, choose partner later</button>` : ""}`);
}
async function doAssign(id, from, rider) {
  const o = findO(id);
  if (rider === "self") { const { data, error } = await db.rpc("owner_as_rider"); if (error) return toast(niceErr(error)); rider = String(data).replace(/"/g, ""); }
  const ok = from === "PLACED" ? await setStatus(o, "ACCEPTED", rider || null) : await (async () => { const { error } = await db.from("orders").update({ rider: rider || null }).eq("id", o.id); if (error) { toast(niceErr(error)); return false; } o.rider = rider; return true; })();
  if (ok) { closeDrawer(); toast(from === "PLACED" ? `Accepted ${short(o)}` : "Partner set"); page(); }
}
async function dispatchOrder(id) {
  const o = findO(id);
  if (!o.rider) return assign(id, "ACCEPTED");
  const r = D.riders.find(x => x.id === o.rider);
  if (r && r.profile && r.profile === me.id) return toast("You're delivering this one — open the order in the app's delivery screen (PIN check).");
  if (await setStatus(o, "OUT")) { toast(`${short(o)} is out for delivery with ${r?.name || "your partner"}`); page(); }
}
async function unlockPin(id) {
  if (!confirm("Unlock the delivery PIN? The partner can try again (5 tries).")) return;
  const { error } = await db.rpc("shop_unlock_pin", { p_order: id }); if (error) return toast(niceErr(error));
  toast("PIN unlocked"); await loadAll(); page();
}
async function openOrder(id) {
  const o = findO(id); if (!o) return;
  const cn = D.cns.filter(c => c.order_id === id), r = D.riders.find(x => x.id === o.rider);
  drawer(`<h2><span>Order ${short(o)}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${pill(o)}<span class="sub" style="margin:0">${dt(o.created_at)}</span></div>
    <div class="box" style="background:#F6F2FB;margin-top:12px"><b>${esc(o.cust_name)}</b>${o.cust_phone ? ` • <a href="${phoneLink(o.cust_phone)}" style="color:#7C3AED">${esc(o.cust_phone)}</a>` : ""}<div class="sub">${esc(o.addr)}</div>
      <div class="sub">Slot: ${esc(o.slot_label || "")} ${o.slot_date ? "• " + dmy(o.slot_date) : ""}${r ? ` • 🛵 ${esc(r.name)}` : ""}</div>${o.note ? `<div class="note" style="margin:8px 0 0">Note: ${esc(o.note)}</div>` : ""}</div>
    <table><thead><tr><th>ITEM</th><th>QTY</th><th>AMOUNT</th></tr></thead><tbody>${(o.items || []).map(l => `<tr><td>${esc(l.n)}${l.u ? ` <span class="sub">${esc(l.u)}</span>` : ""}${(o.returned || []).includes(l.n) ? ` <span class="pill bad">Returned</span>` : ""}</td><td>${l.q}</td><td>${inr(l.p * l.q)}</td></tr>`).join("")}
      ${Number(o.fee) ? `<tr><td>Delivery fee</td><td></td><td>${inr(o.fee)}</td></tr>` : ""}<tr><td><b>Total</b></td><td></td><td><b>${inr(o.total)}</b></td></tr>
      ${o.status === "DELIVERED" && (o.returned || []).length ? `<tr><td><b>Paid (kept items)</b></td><td></td><td><b style="color:#16A34A">${inr(payable(o))}</b></td></tr>` : ""}</tbody></table>
    ${o.return_reason ? `<div class="note">Return reason: ${esc(o.return_reason)}</div>` : ""}
    ${cn.length ? `<div class="sub" style="margin-top:8px">Credit note${cn.length > 1 ? "s" : ""}: ${cn.map(c => `<b>${esc(c.cn_no || "")}</b> ${inr(c.amount)}${c.auto ? " (auto)" : ""}`).join(", ")}</div>` : ""}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${actions(o)} ${o.status === "DELIVERED" || o.status === "OUT" || o.status === "ACCEPTED" ? `<button class="mini" onclick="printBill('${o.id}')">Print</button>` : ""}
      ${["PLACED", "ACCEPTED"].includes(o.status) ? `<button class="mini" style="color:#BE185D" onclick="cancelOrder('${o.id}')">Cancel order</button>` : ""}</div>
    <h3 style="font-size:14px;margin:18px 0 6px">Timeline</h3>${(o.log || []).map(l => `<div class="sub" style="margin:2px 0">${dt(l.t)} · ${esc((STATUS[l.s] || [l.s])[0])}</div>`).join("")}`, true);
}
async function cancelOrder(id) { const o = findO(id); if (!confirm(`Cancel order ${short(o)}?`)) return; if (await setStatus(o, "CANCELLED")) { closeDrawer(); toast("Order cancelled"); page(); } }
function printBill(id) {
  const o = findO(id), w = window.open("", "_blank"); if (!w) return;
  const cn = D.cns.filter(c => c.order_id === id);
  w.document.write(`<html><head><title>${esc(o.bill_no || short(o))}</title><style>body{font-family:system-ui;padding:24px;max-width:640px}table{width:100%;border-collapse:collapse}td,th{padding:6px;border-bottom:1px solid #ddd;text-align:left}h2{margin:0}</style></head><body>
    <h2>${esc(S.name)}</h2><div>${esc([S.addr, S.locality, S.city].filter(Boolean).join(", "))}${S.gstin ? `<br>GSTIN ${esc(S.gstin)}` : ""}${S.fssai ? `<br>FSSAI ${esc(S.fssai)}` : ""}</div><hr>
    <div><b>Bill ${esc(o.bill_no || short(o))}</b> • ${dmyy(o.delivered_at || o.created_at)}<br>${esc(o.cust_name)} • ${esc(o.addr)}</div><br>
    <table><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>${(o.items || []).map(l => `<tr><td>${esc(l.n)} ${esc(l.u || "")}${l.h && S.gst_billing ? ` <small>HSN ${esc(l.h)}</small>` : ""}</td><td>${l.q}</td><td>${inr2(l.p)}</td><td>${inr2(l.p * l.q)}</td></tr>`).join("")}
    ${Number(o.fee) ? `<tr><td>Delivery fee</td><td></td><td></td><td>${inr2(o.fee)}</td></tr>` : ""}<tr><td colspan=3><b>Total</b></td><td><b>${inr2(o.total)}</b></td></tr>
    ${(o.returned || []).length && o.status === "DELIVERED" ? `<tr><td colspan=3>Less: returned at the door${cn[0] ? ` (credit note ${esc(cn[0].cn_no || "")})` : ""}</td><td>− ${inr2(o.total - payable(o))}</td></tr><tr><td colspan=3><b>Paid</b></td><td><b>${inr2(payable(o))}</b></td></tr>` : ""}</table>
    <p style="font-size:12px;color:#666">Gali Bazaar is only a platform connecting customers and local shops.</p><script>print()<\/script></body></html>`);
  w.document.close();
}

// ================= Catalog =================
function catalog() {
  const groups = [...new Set(D.items.map(i => (i.grp || "").trim()).filter(Boolean))].sort().slice(0, 8);
  const liveN = D.items.filter(i => photos(i).length >= 3 && i.in_stock).length;
  const F = [["all", `All ${D.items.length}`], ["missing", `Missing photos ${D.items.filter(i => photos(i).length < 3).length}`], ["oos", `Out of stock ${D.items.filter(i => !i.in_stock).length}`], ...groups.map(g => ["g:" + g, g])];
  $("#main").innerHTML = head(`${D.items.length} items • ${liveN} live`, "Every item needs 3 photos: F = front (name &amp; brand), E = expiry, I = ingredients",
      `<button class="btn ghost" onclick="go('catalog/bulk')">⇪ Bulk upload</button><button class="btn pink" onclick="editItem(null)">＋ Add item</button>`) + `
    <div class="bar2"><div class="fchips">${F.map(([k, l]) => `<button class="fchip ${catF === k ? "on" : ""}" data-f="${esc(k)}">${esc(l)}</button>`).join("")}</div><div class="sp"></div>
      <input class="search" id="q" placeholder="🔍 Search items" value="${esc(catQ)}"></div>
    <div class="box" id="ct"></div><div class="sub">Items with fewer than 3 photos are hidden from customers until all 3 are added.</div>`;
  $$(".fchip").forEach(b => b.onclick = () => { catF = b.dataset.f; catalog(); });
  $("#q").oninput = e => { catQ = e.target.value; drawCat(); };
  drawCat();
}
function drawCat() {
  const q = catQ.toLowerCase().trim();
  const list = D.items.filter(i => (catF === "all" || (catF === "missing" && photos(i).length < 3) || (catF === "oos" && !i.in_stock) || (catF.startsWith("g:") && (i.grp || "").trim() === catF.slice(2)))
    && (!q || (i.name + " " + (i.grp || "")).toLowerCase().includes(q)));
  const fei = i => { const p = photos(i); return ["F", "E", "I"].map((l, k) => `<span class="pill ${p[k] ? "ok" : "bad"}" style="padding:2px 6px;margin-right:2px">${l}</span>`).join(""); };
  $("#ct").innerHTML = list.length ? `<table><thead><tr><th>ITEM</th><th class="hm">CATEGORY</th><th class="hm">UNIT</th><th class="hm">MRP</th><th>YOUR PRICE</th><th>PHOTOS</th><th>IN STOCK</th><th class="hm">RETURN</th><th></th></tr></thead><tbody>${list.map(i => `<tr>
    <td><div style="display:flex;align-items:center;gap:10px">${photos(i)[0] ? `<img src="${esc(thumbUrl(photos(i)[0]))}" onerror="this.onerror=null;this.src='${esc(photos(i)[0])}'" style="width:40px;height:40px;border-radius:10px;object-fit:cover;background:#F6F2FB" loading="lazy">` : `<span style="width:40px;height:40px;border-radius:10px;background:#F6F2FB;display:inline-flex;align-items:center;justify-content:center">📦</span>`}<b>${esc(i.name)}</b></div></td>
    <td class="hm">${esc(i.grp || "—")}</td><td class="hm">${esc(i.unit || (i.variants || []).map(v => v.n).join(", ") || "—")}</td>
    <td class="hm">${i.mrp ? `<s style="color:#8E84A8">${inr(i.mrp)}</s>` : "—"}</td><td><b>${(i.variants || []).length ? i.variants.map(v => `${esc(v.n)} ${inr(v.p)}`).join("<br>") : inr(i.price)}</b></td>
    <td style="white-space:nowrap">${fei(i)}</td><td><button class="tog ${i.in_stock ? "on" : ""}" onclick="stock('${i.id}',${!i.in_stock})" aria-label="In stock"></button></td>
    <td class="hm">${retLabel(i)}</td><td><button class="edit" onclick="editItem('${i.id}')">Edit</button></td></tr>`).join("")}</tbody></table>`
    : `<div class="sub" style="padding:18px 0">${D.items.length ? "No items match." : "No items yet. Add one, or upload your whole catalogue from Excel."}</div>`;
}
async function stock(id, on) {
  const i = D.items.find(x => x.id === id); i.in_stock = on; drawCat();
  const { error } = await db.from("items").update({ in_stock: on }).eq("id", id);
  if (error) { i.in_stock = !on; drawCat(); toast(niceErr(error)); }
}
// ---- item photos: resize to 900px WebP and upload to the same storage as the app ----
// Same look, small file: WebP; lower quality step by step (not below .45), then shrink a little, until ≤ maxKb.
async function loadImg(file) { return await new Promise((ok, bad) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = u; }); }
async function squeeze(img, max, maxKb, q = .74) {
  let s = Math.min(1, max / Math.max(img.width, img.height)), blob;
  const c = document.createElement("canvas");
  for (let i = 0; i < 12; i++) {
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, c.width, c.height);
    blob = await new Promise(ok => c.toBlob(ok, "image/webp", q));
    if (blob.size <= maxKb * 1024) break;
    if (q > .46) q -= .07; else { s *= .85; q = .6; }
  }
  return blob;
}
async function uploadPhoto(file, k) {
  const img = await loadImg(file), name = `${me.id}/items/${Date.now()}_${k}_${Math.random().toString(36).slice(2, 6)}`;
  const [big, th] = await Promise.all([squeeze(img, 900, 75), squeeze(img, 320, 22, .65)]);
  await db.storage.from("public").upload(name + "_t.webp", th, { upsert: false, contentType: "image/webp" }).catch(() => {});
  const { error } = await db.storage.from("public").upload(name + ".webp", big, { upsert: false, contentType: "image/webp" });
  if (error) throw error;
  return db.storage.from("public").getPublicUrl(name + ".webp").data.publicUrl;
}
const thumbUrl = u => u && /\/items\/.*\.webp$/.test(u) && !/_t\.webp$/.test(u) ? u.replace(/\.webp$/, "_t.webp") : u;
let F_ = null;   // item form state
function editItem(id) {
  const i = id ? D.items.find(x => x.id === id) : null;
  if (!id && route() !== "catalog/new" && route().startsWith("catalog")) history.replaceState({}, "", "/seller/catalog/new/");
  const p = i ? photos(i) : [];
  F_ = { id, ph: [p[0] || null, p[1] || null, p[2] || null], pol: i ? (i.ret_policy === "replace" ? 1 : i.ret_policy === "return" ? 2 : 0) : 0, stock: i ? i.in_stock : true };
  const groups = [...new Set(D.items.map(x => (x.grp || "").trim()).filter(Boolean))].sort();
  drawer(`<h2><span>${i ? "Edit item" : "Add item"}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <div style="display:flex;align-items:center"><b>Item photos</b><span class="sub" style="margin:0 0 0 6px">• all 3 required</span><span class="sp" style="flex:1"></span><b id="phc" style="color:#EF287B;font-size:12.5px"></b></div>
    <div id="phs" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px"></div>
    <label>ITEM NAME</label><input class="in" id="fn" value="${esc(i?.name || "")}" placeholder="e.g. Aashirvaad Whole Wheat Atta">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>CATEGORY</label><input class="in" id="fg" list="grps" value="${esc(i?.grp || "")}" placeholder="Atta &amp; Rice"><datalist id="grps">${groups.map(g => `<option value="${esc(g)}">`).join("")}</datalist></div>
      <div><label>UNIT</label><input class="in" id="fu" value="${esc(i?.unit || "")}" placeholder="5 kg"></div>
      <div><label>MRP ₹</label><input class="in" id="fm" inputmode="decimal" value="${i?.mrp ?? ""}"></div><div><label>YOUR PRICE ₹${S.gst_billing ? " (incl. GST)" : ""}</label><input class="in" id="fp" inputmode="decimal" value="${i ? i.price : ""}"></div></div>
    <div id="off"></div>
    <label style="margin-top:14px;font-size:13px;letter-spacing:0;color:#1D0F30;text-transform:none">Return / replacement</label>
    <div class="fchips" id="pol" style="background:#F6F2FB;border-radius:14px;padding:4px;gap:4px">${["At door only", "Replacement", "Return & refund"].map((l, k) => `<button class="fchip" style="flex:1;border:0" data-k="${k}">${l}</button>`).join("")}</div>
    <div id="dw" style="display:none"><label>WITHIN HOW MANY DAYS OF DELIVERY? (1–30)</label><input class="in" id="fd" inputmode="numeric" value="${i?.ret_days || 7}"></div>
    <div class="row" style="border:1px solid #EEE7F6;border-radius:16px;padding:12px 14px"><div><b>In stock</b><span>On = customers can order • Off = out of stock (hidden)</span></div><button class="tog ${F_.stock ? "on" : ""}" id="fs"></button></div>
    <details style="margin-top:10px" ${i && (i.descr || i.gst_rate || (i.variants || []).length) ? "open" : ""}><summary class="sub" style="cursor:pointer">More: product details${S.gst_billing ? ", GST %" : ""}, multiple sizes</summary>
      <label>PRODUCT DETAILS</label><textarea class="in" id="fx" rows="2">${esc(i?.descr || "")}</textarea>
      ${S.gst_billing ? `<label>GST %</label><select class="in" id="fgst">${["", 0, 5, 12, 18, 28, 40].map(v => `<option value="${v}" ${String(i?.gst_rate ?? "") === String(v) ? "selected" : ""}>${v === "" ? "—" : v + "%"}</option>`).join("")}</select>
        <label>HSN CODE (OPTIONAL — printed on the tax invoice)</label><input class="in" id="fh" inputmode="numeric" maxlength="8" value="${esc(i?.hsn || "")}" placeholder="e.g. 11010000">` : ""}
      <label>SIZES (OPTIONAL) — e.g. Half=140; Full=260</label><input class="in" id="fv" value="${esc((i?.variants || []).map(v => `${v.n}=${v.p}`).join("; "))}" placeholder="250g=12; 500g=22; 1kg=40"></details>
    <div class="msg" id="fe"></div>
    <button class="btn pink full" id="fsave" style="margin-top:10px;padding:15px">Save item</button>
    ${i ? `<button class="btn ghost full" style="margin-top:8px;color:#BE185D" onclick="delItem('${i.id}')">Delete item</button>` : ""}`);
  drawPhotos(); paintPol();
  // HSN + GST % fill in by themselves from the item name (GST shops); seller can still change them
  if (S.gst_billing && $("#fh") && typeof hsnSuggest === "function") {
    let auto = !(i && i.hsn);
    $("#fh").addEventListener("input", () => auto = false); $("#fgst").addEventListener("change", () => auto = false);
    $("#fn").addEventListener("input", () => { if (!auto) return; const h = hsnSuggest($("#fn").value); if (h) { $("#fh").value = h.hsn; $("#fgst").value = String(h.rate); } });
  }
  $$("#pol .fchip").forEach(b => b.onclick = () => { F_.pol = +b.dataset.k; paintPol(); });
  $("#fs").onclick = () => { F_.stock = !F_.stock; $("#fs").classList.toggle("on", F_.stock); };
  ["#fm", "#fp"].forEach(s => $(s).oninput = offLine); offLine();
  $("#fsave").onclick = saveItem;
}
function paintPol() { $$("#pol .fchip").forEach(b => { const on = +b.dataset.k === F_.pol; b.classList.toggle("on", on); }); $("#dw").style.display = F_.pol ? "block" : "none"; }
function offLine() { const m = +$("#fm").value, p = +$("#fp").value; $("#off").innerHTML = m > p && p > 0 ? `<div class="okline">⚡ ${Math.round((m - p) / m * 100)}% off shown to customers automatically</div>` : ""; }
const PH = ["1. Front", "2. Expiry", "3. Ingredients"];
function drawPhotos() {
  const n = F_.ph.filter(Boolean).length;
  $("#phc").textContent = `${n} of 3`;
  $("#phs").innerHTML = F_.ph.map((v, k) => `<div><div class="drop" data-k="${k}" style="height:104px;border-radius:16px;border:${v ? "1px solid #EEE7F6" : "1.5px dashed #EF287B"};background:${v ? "#FFF7E6" : "#FFF5F8"};display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;position:relative">
      ${v ? `<img src="${esc(typeof v === "string" ? v : v.url)}" style="width:100%;height:100%;object-fit:cover"><button onclick="event.stopPropagation();F_.ph[${k}]=null;drawPhotos()" style="position:absolute;top:4px;right:4px;border:0;border-radius:50%;width:22px;height:22px;background:#fff;cursor:pointer">×</button>`
        : `<span style="color:#EF287B;font-size:12px;font-weight:600;text-align:center">⇪<br>Drop or browse</span>`}</div>
      <div style="font-size:12px;font-weight:600;margin-top:4px">${PH[k]} <span style="color:#EF287B">*</span></div></div>`).join("");
  $$("#phs .drop").forEach(d => {
    const k = +d.dataset.k, pick = f => { if (!f || !/^image\//.test(f.type)) return; F_.ph[k] = { file: f, url: URL.createObjectURL(f) }; drawPhotos(); };
    d.onclick = () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => pick(inp.files[0]); inp.click(); };
    d.ondragover = e => { e.preventDefault(); d.style.background = "#F3EDFF"; }; d.ondragleave = () => { d.style.background = ""; drawPhotos(); };
    d.ondrop = e => { e.preventDefault(); const fs = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type)); fs.forEach((f, j) => { if (k + j < 3) F_.ph[k + j] = { file: f, url: URL.createObjectURL(f) }; }); drawPhotos(); };
  });
  const miss = F_.ph.map((v, k) => v ? null : ["front", "expiry", "ingredients"][k]).filter(Boolean), b = $("#fsave");
  if (b) { b.disabled = miss.length > 0; b.textContent = miss.length ? `Add ${miss.join(" & ")} photo to save` : "Save item"; b.style.opacity = miss.length ? .5 : 1; }
}
async function saveItem() {
  const e = $("#fe"), name = $("#fn").value.trim(), grp = $("#fg").value.trim(), desc = $("#fx").value.trim();
  const vs = $("#fv").value.split(";").map(x => x.split("=")).filter(kv => kv.length === 2 && kv[0].trim()).map(([n, p]) => ({ n: n.trim(), p: +p.trim() || 0 }));
  const price = +$("#fp").value || (vs.length ? Math.min(...vs.map(v => v.p)) : 0), days = Math.max(0, Math.min(30, +$("#fd").value || 0));
  const err = !name ? "Enter the item name" : banWord(name, grp, desc) ? "Tobacco, cigarettes and alcohol can't be sold on Gali Bazaar." : F_.ph.some(x => !x) ? "Add all 3 photos: front, expiry date and ingredients label"
    : vs.some(v => v.p <= 0) ? "Every size needs a price above ₹0" : price <= 0 ? "Price must be above ₹0" : null;
  if (err) { e.className = "msg err"; e.textContent = err; return; }
  const b = $("#fsave"); b.disabled = true; b.textContent = "Saving…";
  try {
    const imgs = [];
    for (let k = 0; k < 3; k++) { const v = F_.ph[k]; imgs.push(typeof v === "string" ? v : await uploadPhoto(v.file, k)); }
    const row = { shop: S.id, name, price, unit: vs.length ? "" : $("#fu").value.trim(), in_stock: F_.stock, mrp: +$("#fm").value || null, grp: grp || null, descr: desc || null,
      img_url: imgs[0], images: imgs, variants: vs, ret_policy: F_.pol === 0 || days === 0 ? "none" : F_.pol === 1 ? "replace" : "return", ret_days: F_.pol === 0 ? 0 : days };
    if (S.gst_billing && $("#fgst")) row.gst_rate = $("#fgst").value === "" ? null : +$("#fgst").value;
    if (S.gst_billing && $("#fh")) row.hsn = $("#fh").value.replace(/\D/g, "") || null;
    const r = F_.id ? await db.from("items").update(row).eq("id", F_.id) : await db.from("items").insert(row);
    if (r.error) throw r.error;
    toast(F_.id ? "Item saved" : "Item added"); closeDrawer(); await loadAll(); history.replaceState({}, "", "/seller/catalog/"); page();
  } catch (x) { e.className = "msg err"; e.textContent = niceErr(x); b.disabled = false; b.textContent = "Save item"; }
}
async function delItem(id) {
  if (!confirm("Delete this item?")) return;
  const { error } = await db.from("items").delete().eq("id", id); if (error) return toast(niceErr(error));
  closeDrawer(); await loadAll(); page();
}

// ================= Bulk upload =================
const TPL_HEAD = ["Item name*", "MRP (Rs)", "Selling price (Rs)", "Pack / unit", "In stock (Yes/No)", "Group (optional)", "Sizes (optional)", "Description",
  "HSN code", "GST type (Inclusive / Exclusive / Nil - blank = no GST)", "GST %", "Doorstep return only (Yes)", "Return / exchange days (blank = doorstep only)"];
const TPL_ROWS = [
  ["Aashirvaad atta", 285, 265, "5 kg", "Yes", "Atta & rice", "", "Whole wheat", "11010000", "Inclusive", 5, "Yes", ""],
  ["Toor dal", 185, 170, "1 kg", "Yes", "Dal", "", "", "07136000", "Exclusive", 5, "", 7],
  ["Tamatar", "", "", "", "Yes", "Vegetables", "250g=12; 500g=22; 1kg=40", "Fresh", "07020000", "Nil", "", "Yes", ""],
  ["Classmate notebook", 60, 55, "1 pc", "Yes", "Notebooks", "", "200 pages", "48202000", "", "", "", "3 exchange"],
  ["Paneer butter masala", "", "", "", "Yes", "Main course", "Half=140; Full=260", "", "", "", "", "Yes", ""]];
/** column positions from the header row; old 8-column files still work */
function bulkCols(head) {
  const h = head && head.map(x => String(x).toLowerCase());
  if (!h || !h.some(c => c.includes("hsn") || c.includes("selling"))) return { name: 0, price: 1, unit: 2, stock: 3, mrp: 4, grp: 5, sizes: 6, desc: 7 };
  const f = (...k) => h.findIndex(c => k.some(x => c.includes(x)));
  const m = { name: f("item"), mrp: f("mrp"), price: f("selling", "price"), unit: f("pack", "unit"), stock: f("stock"), grp: f("group"), sizes: f("size"), desc: f("desc"),
    hsn: f("hsn"), gtype: f("gst type"), grate: f("gst %", "gst%", "gst rate"), door: f("doorstep"), ret: f("return /", "return/", "exchange") };
  Object.keys(m).forEach(k => m[k] < 0 && delete m[k]); return m;
}
let BU = { rows: [], file: "", photos: {} };
const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9ऀ-ॿ]+/g, "-").replace(/^-|-$/g, "");
function bulk() {
  $("#main").innerHTML = head("Bulk upload", "Excel or CSV • up to 500 items at once • then add 3 photos per item") + `
    <div class="grid2" style="grid-template-columns:1fr 1.25fr">
      <div>
        <div class="box"><h3>✓ 1. Download the template</h3><div class="sub">${TPL_HEAD.join(", ")}</div>
          <div class="sub" style="margin-top:8px;line-height:1.5"><b>GST type</b>: Inclusive (price has GST) / Exclusive (GST added on top) / Nil — put the % in GST %. Blank = no GST.<br><b>Returns</b>: “Yes” in Doorstep = return only at the door. Days 1–30 = return &amp; refund (“3 exchange” = exchange). Blank = doorstep only.</div>
          <button class="btn ghost full" style="margin-top:10px" onclick="dlTemplate()">⇩ Download Excel template</button></div>
        <div class="box"><h3>2. Upload the filled file</h3>
          <div id="fdrop" style="border:1.5px dashed #16A34A;border-radius:16px;padding:22px;text-align:center;cursor:pointer;background:#F7FFF9">${BU.file ? `📊<br><b>${esc(BU.file)}</b><div class="sub">${BU.rows.length} rows read • Drop another file to replace</div>` : `📊<br><b>Drop your .xlsx or .csv here</b><div class="sub">or click to browse</div>`}</div></div>
        <div class="box" style="border:2px solid #8B5CF6"><h3>3. Add photos in bulk</h3>
          <div class="sub">Drop a folder of photos named like <code>atta-front.jpg</code>, <code>atta-expiry.jpg</code>, <code>atta-ingredients.jpg</code> — we match them to items by name. Or add them item by item later.</div>
          <div id="pdrop" style="border:1.5px dashed #C4B5FD;border-radius:16px;padding:20px;text-align:center;cursor:pointer;margin-top:10px;color:#7C3AED;font-weight:600">⇪ Drop photos folder <div class="sub" style="font-weight:400">or click to choose a folder</div></div>
          <div class="msg" id="pm"></div></div>
      </div>
      <div class="box"><h3>Preview <span id="bsum" style="float:right"></span></h3><div id="bprev"></div></div>
    </div>`;
  const fd = $("#fdrop"), pd = $("#pdrop");
  fd.onclick = () => { const i = document.createElement("input"); i.type = "file"; i.accept = ".xlsx,.xls,.csv"; i.onchange = () => readFile(i.files[0]); i.click(); };
  fd.ondragover = e => e.preventDefault(); fd.ondrop = e => { e.preventDefault(); readFile(e.dataTransfer.files[0]); };
  pd.onclick = () => { const i = document.createElement("input"); i.type = "file"; i.multiple = true; i.webkitdirectory = true; i.onchange = () => bulkPhotos([...i.files]); i.click(); };
  pd.ondragover = e => e.preventDefault();
  pd.ondrop = async e => { e.preventDefault(); bulkPhotos(await filesFromDrop(e.dataTransfer)); };
  drawPreview();
}
function dlTemplate() {
  if (window.XLSX) { const ws = XLSX.utils.aoa_to_sheet([TPL_HEAD, ...TPL_ROWS]); ws["!cols"] = TPL_HEAD.map((h, i) => ({ wch: i === 0 ? 26 : i === 6 || i >= 9 ? 26 : 16 })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Items"); XLSX.writeFile(wb, "gali-bazaar-catalogue-template.xlsx"); }
  else csvDownload("gali-bazaar-catalogue-template.csv", [TPL_HEAD, ...TPL_ROWS]);
}
async function readFile(f) {
  if (!f) return;
  let rows = [];
  try {
    if (/\.csv$/i.test(f.name) || !window.XLSX) { const t = (await f.text()).replace(/^﻿/, ""); rows = parseCsv(t); }
    else { const wb = XLSX.read(await f.arrayBuffer()); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" }); }
  } catch (e) { return toast("Couldn't read this file"); }
  const hasHead = rows[0] && String(rows[0][0] || "").toLowerCase().includes("item");
  const cx = bulkCols(hasHead ? rows[0] : null); if (hasHead) rows = rows.slice(1);
  rows = rows.map((r, i) => ({ line: i + 2, r: r.map(x => String(x ?? "").trim()) })).filter(x => x.r[cx.name]);
  if (rows.length > 500) { toast("Up to 500 items at once — first 500 taken"); rows = rows.slice(0, 500); }
  const names = new Set(D.items.map(i => i.name.toLowerCase())), gstShop = !!S.gst_billing;
  BU = { file: f.name, photos: BU.photos, rows: rows.map(({ line, r }) => {
    const col = k => cx[k] == null ? "" : (r[cx[k]] || "");
    const gtype = col("gtype").toLowerCase(), rate = col("grate") === "" ? null : +col("grate").replace("%", "");
    const excl = gstShop && gtype.startsWith("ex");
    const fin = v => excl && rate > 0 ? Math.round(v * (1 + rate / 100) * 100) / 100 : v;
    const vs = col("sizes").split(";").map(x => x.split("=")).filter(kv => kv.length === 2 && kv[0].trim()).map(([n, p]) => ({ n: n.trim(), p: fin(+p.trim() || 0) }));
    const price = (+col("price") ? fin(+col("price")) : 0) || (vs.length ? Math.min(...vs.map(v => v.p)) : 0), ban = banWord(col("name"), col("grp"), col("desc"));
    const gst = !gstShop ? null : (gtype.startsWith("in") || gtype.startsWith("ex")) ? rate : (gtype.startsWith("nil") || gtype === "0") ? 0 : null;
    const auto = typeof hsnSuggest === "function" && gstShop && gst != null ? hsnSuggest(col("name"), col("grp")) : null;
    const hsn = col("hsn").replace(/\D/g, "").slice(0, 8) || (auto ? auto.hsn : null);
    const rt = col("ret").toLowerCase(), dm = rt.match(/\d+/), days = dm ? Math.min(30, Math.max(1, +dm[0])) : null;
    const door = /^y/i.test(col("door")) || !days;
    const item = { shop: S.id, name: col("name"), price, unit: vs.length ? "" : col("unit"), in_stock: !/^no$/i.test(col("stock")), mrp: +col("mrp") || null, grp: col("grp") || null,
      descr: col("desc") || null, variants: vs, hsn, gst_rate: gst, ret_policy: door ? "none" : /exch|repl/.test(rt) ? "replace" : "return", ret_days: door ? 0 : days };
    const badGst = gstShop && (gtype.startsWith("in") || gtype.startsWith("ex")) && ![0, 5, 12, 18, 28, 40].includes(rate);
    return { line, item, ban, err: ban ? null : (price <= 0 || vs.some(v => v.p <= 0)) ? "Price missing" : badGst ? "GST % missing" : null, dup: names.has(col("name").toLowerCase()) };
  }) };
  bulk();
}
function parseCsv(t) {
  const out = []; let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); out.push(row); row = []; cur = ""; } else cur += c; }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out;
}
function photoKeyFor(name) { const s = slug(name), p = BU.photos; return ["front", "expiry", "ingredients"].map(k => p[s + "-" + k] || null); }
function drawPreview() {
  const rows = BU.rows;
  if (!rows.length) { $("#bprev").innerHTML = `<div class="sub" style="padding:18px 0">Upload your filled template to see every row checked before anything is saved.</div>`; $("#bsum").innerHTML = ""; return; }
  const ready = rows.filter(r => !r.err && !r.ban), errs = rows.filter(r => r.err), ban = rows.filter(r => r.ban);
  $("#bsum").innerHTML = `<span class="pill ok">${ready.length} ready</span> <span class="pill bad">${errs.length} errors</span> <span class="pill" style="background:#1D0F30;color:#fff">${ban.length} blocked</span>`;
  $("#bprev").innerHTML = `<div style="max-height:520px;overflow:auto"><table><thead><tr><th>ROW</th><th>ITEM</th><th>PRICE</th><th class="hm">UNIT</th><th class="hm">GST · HSN</th><th class="hm">RETURN</th><th>PHOTOS</th><th>CHECK</th></tr></thead><tbody>${rows.map(r => {
    const ph = photoKeyFor(r.item.name), n = ph.filter(Boolean).length;
    const chk = r.ban ? `<span class="pill" style="background:#1D0F30;color:#fff">Blocked: ${r.ban}</span>` : r.err ? `<span class="pill bad">${r.err}</span>` : n === 3 ? `<span class="pill ok">Ready</span>` : `<span class="pill warn">Ready • ${n ? (3 - n) + " photo" + (3 - n > 1 ? "s" : "") + " missing" : "add photos"}</span>`;
    return `<tr><td>${r.line}</td><td><b>${esc(r.item.name)}</b>${r.dup ? `<br><span class="sub">already in your catalogue</span>` : ""}</td><td>${r.item.variants.length ? esc(r.item.variants.map(v => `${v.n}=${v.p}`).join("; ")) : r.item.price ? inr(r.item.price) : "—"}</td>
      <td class="hm">${esc(r.item.unit || "—")}</td><td class="hm">${r.item.gst_rate == null ? "No GST" : r.item.gst_rate + "%"}${r.item.hsn ? " · " + esc(r.item.hsn) : ""}</td><td class="hm">${r.item.ret_policy === "none" ? "Doorstep" : (r.item.ret_policy === "replace" ? "Exchange " : "Return ") + r.item.ret_days + "d"}</td><td style="white-space:nowrap">${["F", "E", "I"].map((l, k) => `<span class="pill ${ph[k] ? "ok" : "bad"}" style="padding:2px 6px;margin-right:2px">${l}</span>`).join("")}</td><td>${chk}</td></tr>`; }).join("")}</tbody></table></div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap"><span class="sub" style="flex:1">Items without all 3 photos stay hidden until photos are added</span>
      <button class="btn pink" id="bup" ${ready.length ? "" : "disabled"}>⇪ Upload ${ready.length} item${ready.length === 1 ? "" : "s"}</button></div><div class="msg" id="bmsg"></div>`;
  $("#bup") && ($("#bup").onclick = doBulk);
}
async function doBulk() {
  const ready = BU.rows.filter(r => !r.err && !r.ban), b = $("#bup"), m = $("#bmsg");
  b.disabled = true;
  try {
    for (let i = 0; i < ready.length; i += 50) {
      const chunk = [];
      for (const r of ready.slice(i, i + 50)) {
        const ph = photoKeyFor(r.item.name), row = { ...r.item };
        if (ph.every(Boolean)) { const urls = []; for (let k = 0; k < 3; k++) urls.push(await uploadPhoto(ph[k], k)); row.images = urls; row.img_url = urls[0]; }
        chunk.push(row);
      }
      b.textContent = `Uploading ${Math.min(i + 50, ready.length)} / ${ready.length}…`;
      const { error } = await db.from("items").insert(chunk); if (error) throw error;
    }
    toast(`${ready.length} items added`); BU = { rows: [], file: "", photos: {} }; await loadAll(); go("catalog");
  } catch (e) { m.className = "msg err"; m.textContent = niceErr(e); b.disabled = false; b.textContent = "Try again"; }
}
async function filesFromDrop(dt) {
  const out = [], walk = async en => {
    if (en.isFile) await new Promise(ok => en.file(f => { out.push(f); ok(); }, ok));
    else if (en.isDirectory) { const rd = en.createReader(); let ents; do { ents = await new Promise(ok => rd.readEntries(ok, () => ok([]))); for (const x of ents) await walk(x); } while (ents.length); }
  };
  const items = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (items.length) { for (const en of items) await walk(en); } else out.push(...dt.files);
  return out;
}
async function bulkPhotos(files) {
  const m = $("#pm"), map = {};
  files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name)).forEach(f => {
    const base = f.name.replace(/\.[^.]+$/, ""), mm = base.match(/^(.*?)[-_ ](front|expiry|exp|ingredients|ingredient|ing)$/i);
    if (!mm) return; const k = /^f/i.test(mm[2]) ? "front" : /^e/i.test(mm[2]) ? "expiry" : "ingredients"; map[slug(mm[1]) + "-" + k] = f;
  });
  BU.photos = { ...BU.photos, ...map };
  const n = Object.keys(map).length;
  if (!n) { m.className = "msg err"; m.textContent = "No photos named like item-front / item-expiry / item-ingredients found."; return; }
  // photos for items that are already in the catalogue → attach right away
  const existing = D.items.filter(i => ["front", "expiry", "ingredients"].every(k => map[slug(i.name) + "-" + k]));
  m.className = "msg ok"; m.textContent = `${n} photos matched${existing.length ? ` • updating ${existing.length} existing item${existing.length === 1 ? "" : "s"}…` : ""}`;
  drawPreview();
  for (const i of existing) {
    try { const urls = []; for (let k = 0; k < 3; k++) urls.push(await uploadPhoto(map[slug(i.name) + "-" + ["front", "expiry", "ingredients"][k]], k));
      await db.from("items").update({ images: urls, img_url: urls[0] }).eq("id", i.id); } catch (e) { toast(niceErr(e)); }
  }
  if (existing.length) { m.textContent = `${n} photos matched • ${existing.length} existing item${existing.length === 1 ? "" : "s"} updated`; await loadAll(); }
}

// ================= Returns & cancelled =================
function returns() {
  const all = D.orders.filter(comingBack), issues = all.filter(o => o.return_checked_at && Object.values(o.return_check || {}).some(v => v === "MISSING" || v === "DAMAGED"));
  const coming = all.filter(o => !o.return_checked_at), received = all.filter(o => o.return_checked_at && !issues.includes(o));
  const val = o => backItems(o).reduce((a, l) => a + l.p * l.q, 0);
  const T = [["coming", "Coming", coming], ["received", "Received", received], ["issues", "Issues", issues]], cur = T.find(t => t[0] === retTab) || T[0];
  $("#main").innerHTML = head("Returns & cancelled", "Credit notes are made automatically • when the partner brings items back, check them in") + `
    <div class="kpis k4" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><span>Coming back</span><b class="or">${coming.length}</b></div><div class="kpi"><span>Value on the way</span><b>${inr(coming.reduce((a, o) => a + val(o), 0))}</b></div><div class="kpi"><span>Issues</span><b class="pk">${issues.length}</b></div></div>
    <div class="bar2"><div class="fchips">${T.map(([k, l, li]) => `<button class="fchip ${retTab === k ? "on" : ""}" onclick="retTab='${k}';returns()">${l} (${li.length})</button>`).join("")}</div></div>
    <div class="box">${cur[2].length ? `<table><thead><tr><th>ORDER</th><th>ITEMS COMING BACK</th><th>VALUE</th><th class="hm">PARTNER</th><th>STATUS</th><th></th></tr></thead><tbody>${cur[2].map(o => `<tr>
      <td><b>${short(o)}</b><br><span class="sub">${o.status === "CANCELLED" ? "Cancelled at the door" : "Returned at the door"}</span></td>
      <td>${backItems(o).map(l => `${esc(l.n)} ×${l.q}${o.return_check?.[l.n] ? ` <span class="pill ${o.return_check[l.n] === "OK" ? "ok" : "bad"}">${o.return_check[l.n]}</span>` : ""}`).join("<br>")}${o.return_reason ? `<br><span class="sub">Reason: ${esc(o.return_reason)}</span>` : ""}</td>
      <td><b>${inr(val(o))}</b></td><td class="hm">${esc(D.riders.find(r => r.id === o.rider)?.name || "—")}</td>
      <td>${o.return_checked_at ? `<span class="pill ok">Checked ${dmy(o.return_checked_at)}</span>` : `<span class="pill warn">Coming</span>`}</td>
      <td>${o.return_checked_at ? "" : `<button class="mini dk" onclick="checkIn('${o.id}')">Check in</button>`}</td></tr>`).join("")}</tbody></table>` : `<div class="sub" style="padding:18px 0">Nothing here.</div>`}</div>`;
}
function checkIn(id) {
  const o = findO(id), back = backItems(o), st = {}; back.forEach(l => st[l.n] = "OK");
  drawer(`<h2><span>Check items back · ${short(o)}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <div class="sub">Partner: ${esc(D.riders.find(r => r.id === o.rider)?.name || "—")} • mark each item as you receive it</div>
    ${back.map((l, k) => `<div class="row"><div><b>${esc(l.n)} ×${l.q}</b><span>${inr(l.p * l.q)}</span></div><div class="fchips" data-n="${k}">${["OK", "DAMAGED", "MISSING"].map(v => `<button class="fchip ${v === "OK" ? "on" : ""}" data-v="${v}" style="padding:5px 10px;font-size:12px">${v === "OK" ? "Received OK" : v === "DAMAGED" ? "Damaged" : "Not received"}</button>`).join("")}</div></div>`).join("")}
    <div class="note">“Not received” is flagged to the admin with the partner's name.</div>
    <button class="btn dark full" id="cib">Confirm</button>`);
  $$("#panel .fchips").forEach(g => { const n = back[+g.dataset.n].n; $$(".fchip", g).forEach(b => b.onclick = () => { st[n] = b.dataset.v; $$(".fchip", g).forEach(x => x.classList.toggle("on", x === b)); }); });
  $("#cib").onclick = async () => { const { error } = await db.rpc("shop_check_returns", { p_order: id, p_check: st }); if (error) return toast(niceErr(error)); toast("Checked in"); closeDrawer(); await loadAll(); page(); };
}

// ================= Complaints =================
function complaints() {
  const open = D.complaints.filter(c => !c.reply);
  $("#main").innerHTML = head("Complaints", `${open.length} waiting for your reply • reply within 48 hrs to keep your shop live`) + `
    <div class="box">${D.complaints.length ? `<table><thead><tr><th>DATE</th><th>ORDER</th><th>PROBLEM</th><th class="hm">CUSTOMER WANTS</th><th>STATUS</th><th></th></tr></thead><tbody>${D.complaints.map(c => { const o = findO(c.order_id);
      return `<tr><td>${dmy(c.created_at)}</td><td><b>${o ? short(o) : "—"}</b></td><td><b>${esc(c.reason)}</b><br><span class="sub">${esc((c.items || []).join(", "))}${c.body ? " — " + esc(c.body) : ""}</span>${c.reply ? `<div class="note" style="margin:6px 0 0">You: ${esc(c.reply)}${c.offer ? ` • Offer: ${esc(c.offer)}` : ""}</div>` : ""}</td>
      <td class="hm">${esc(c.want || "—")}</td><td><span class="pill ${c.reply ? "ok" : "warn"}">${c.reply ? "Replied" : "Open"}</span></td>
      <td>${c.photo_url ? `<button class="mini" onclick="compPhoto('${c.id}')">Photo</button>` : ""}${c.reply ? "" : `<button class="mini dk" onclick="replyComp('${c.id}')">Reply</button>`}</td></tr>`; }).join("")}</tbody></table>`
      : `<div class="sub" style="padding:18px 0">No complaints 👍</div>`}</div>`;
}
async function compPhoto(id) { const c = D.complaints.find(x => x.id === id); if (/^https?:/.test(c.photo_url)) return window.open(c.photo_url); const { data } = await db.storage.from("complaints").createSignedUrl(c.photo_url, 600); if (data?.signedUrl) window.open(data.signedUrl); else toast("Couldn't open the photo"); }
function replyComp(id) {
  const c = D.complaints.find(x => x.id === id), pre = { Replace: "Sorry for the trouble. We will replace it with your next delivery.", "Refund (cash)": "Sorry for the trouble. Our delivery person will return your money in cash." };
  drawer(`<h2><span>Reply to complaint</span><button class="x" onclick="closeDrawer()">×</button></h2><div class="sub"><b>${esc(c.reason)}</b> • ${esc((c.items || []).join(", "))}</div>
    <label>WHAT WILL YOU DO?</label>${["Replace", "Refund (cash)", "Discount on next order", "Sorry, no fault found"].map(f => `<label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-size:14px;color:#1D0F30;font-weight:500;margin:8px 0"><input type="radio" name="of" value="${f}"> ${f}</label>`).join("")}
    <label>MESSAGE TO CUSTOMER</label><textarea class="in" id="rm" rows="3"></textarea><div class="msg" id="rmm"></div><button class="btn pink full" id="rsend">Send reply</button>`);
  $$("input[name=of]").forEach(r => r.onchange = () => { if (pre[r.value] && !$("#rm").value) $("#rm").value = pre[r.value]; });
  $("#rsend").onclick = async () => {
    const offer = ($("input[name=of]:checked") || {}).value || "", msg = $("#rm").value.trim();
    if (!msg) { $("#rmm").className = "msg err"; $("#rmm").textContent = "Write a message"; return; }
    const { error } = await db.from("complaints").update({ reply: msg, offer, status: "REPLIED", replied_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast(niceErr(error));
    db.rpc("refresh_quality", { p_shop: S.id }).then(() => {}, () => {});
    toast("Reply sent"); closeDrawer(); await loadAll(); page();
  };
}

// ================= Delivery staff =================
function staff() {
  const req = D.riders.filter(r => r.join_status === "REQUESTED" && r.active !== false), act = D.riders.filter(r => r.active !== false && r.join_status !== "REQUESTED");
  const cashOf = r => D.orders.filter(o => o.rider === r.id && o.status === "DELIVERED" && o.pay_mode === "CASH" && o.delivered_by !== "Shop" && !o.cash_settled_at);
  $("#main").innerHTML = head("Delivery staff", "Partners join your shop with your invite code • one partner can work for many shops") + `
    <div class="grid2" style="grid-template-columns:1fr 1.6fr"><div>
      <div class="box" style="background:linear-gradient(135deg,#1D0F30,#4C1D95);color:#fff"><div style="font-size:12px;color:#CFC6E3">YOUR SHOP'S INVITE CODE</div>
        <div style="font-size:30px;font-weight:800;letter-spacing:3px;margin:6px 0">${esc(S.rider_code || "—")}</div>
        <div style="font-size:12px;color:#CFC6E3">Partner opens the app → Delivery partner → enters this code and their email. You accept the request here.</div>
        <div style="display:flex;gap:8px;margin-top:12px"><button class="btn" style="background:#fff;color:#1D0F30;padding:8px 12px" onclick="navigator.clipboard.writeText('${esc(S.rider_code || "")}').then(()=>toast('Code copied'))">Copy</button>
        <button class="btn" style="background:rgba(255,255,255,.15);color:#fff;padding:8px 12px" onclick="newCode()">New code</button></div></div>
      <div class="box"><h3>Join requests <span>· ${req.length}</span></h3>${req.length ? req.map(r => `<div class="fu"><div><b>${esc(r.name)}</b><span>${esc(r.phone || "")} • KYC ${esc(String(r.kyc || "").toLowerCase())}</span></div><button class="mini" onclick="decide('${r.id}',false)">Decline</button><button class="mini" style="background:#16A34A;color:#fff;border-color:#16A34A" onclick="decide('${r.id}',true)">Accept</button></div>`).join("") : `<div class="sub">No requests.</div>`}</div>
    </div>
    <div class="box"><h3>Active staff <span>· ${act.length}</span></h3>${act.length ? `<table><thead><tr><th>PARTNER</th><th>KYC</th><th>CASH PENDING</th><th></th></tr></thead><tbody>${act.map(r => { const c = cashOf(r), amt = c.reduce((a, o) => a + payable(o), 0);
      return `<tr><td><b>${esc(r.name)}</b><br><span class="sub">${esc(r.phone || "")}${r.profile === me.id ? " • you" : ""}</span></td><td><span class="pill ${r.kyc === "APPROVED" ? "ok" : "warn"}">${esc(String(r.kyc || "").toLowerCase())}</span></td>
        <td>${amt ? `<b style="color:#C2410C">${inr(amt)}</b><br><span class="sub">${c.length} order${c.length === 1 ? "" : "s"}</span>` : `<span class="sub">—</span>`}</td>
        <td style="white-space:nowrap">${amt ? `<button class="mini dk" onclick="cashIn('${r.id}','${inr(amt)}')">Mark received</button>` : ""}${r.profile === me.id ? "" : `<button class="mini" style="color:#BE185D" onclick="removeRider('${r.id}')">Remove from my shop</button>`}</td></tr>`; }).join("")}</tbody></table>`
      : `<div class="sub">No delivery staff yet. Share your invite code.</div>`}
      <div class="sub" style="margin-top:10px">Removing a partner only removes them from your shop — their other shops are not affected.</div></div></div>`;
}
async function newCode() { if (!confirm("Make a new invite code? The old code stops working.")) return; const { error } = await db.rpc("new_rider_code"); if (error) return toast(niceErr(error)); await loadAll(); page(); }
async function decide(id, ok) { const { error } = await db.rpc("decide_rider_request", { p_rider: id, p_accept: ok }); if (error) return toast(niceErr(error)); toast(ok ? "Partner added" : "Request declined"); await loadAll(); page(); }
async function cashIn(id, amt) { if (!confirm(`Got ${amt} cash from this partner?`)) return; const { error } = await db.rpc("mark_cash_received", { p_rider: id }); if (error) return toast(niceErr(error)); toast("Cash marked received"); await loadAll(); page(); }
async function removeRider(id) { const r = D.riders.find(x => x.id === id); if (!confirm(`Remove ${r?.name || "this partner"} from your shop?`)) return; const { error } = await db.from("riders").update({ active: false }).eq("id", id); if (error) return toast(niceErr(error)); await loadAll(); page(); }

// ================= Slots & areas =================
let SL = null;
function slots() {
  SL = { slots: D.slots.map(s => ({ ...s })), cov: D.cov.map(c => ({ ...c, blocks: [...(c.blocks || [])] })), days: (S.open_days || "1111111").split(""), od: !!S.outside_delivery, of: S.outside_fee ?? 0, ot: (S.open_time || "08:00").slice(0, 5), ct: (S.close_time || "21:00").slice(0, 5) };
  drawSlots();
}
function drawSlots() {
  const DN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  $("#main").innerHTML = head("Slots & areas", "When you deliver, how many orders per slot, and which areas") + `
    <div class="grid2"><div>
      <div class="box"><h3>Open days &amp; hours</h3><div class="fchips">${DN.map((d, k) => `<button class="fchip ${SL.days[k] === "1" ? "on" : ""}" onclick="SL.days[${k}]=SL.days[${k}]==='1'?'0':'1';drawSlots()">${d}</button>`).join("")}</div>
        <div style="display:flex;gap:10px;margin-top:10px"><div style="flex:1"><label>OPENS</label><input class="in" type="time" value="${SL.ot}" onchange="SL.ot=this.value"></div><div style="flex:1"><label>CLOSES</label><input class="in" type="time" value="${SL.ct}" onchange="SL.ct=this.value"></div></div></div>
      <div class="box"><h3>Delivery slots</h3><table><thead><tr><th>FROM</th><th>TO</th><th>ORDERS / SLOT</th><th></th></tr></thead><tbody>${SL.slots.map((s, k) => `<tr>
        <td><input class="in" type="time" value="${String(s.from_t).slice(0, 5)}" onchange="SL.slots[${k}].from_t=this.value"></td><td><input class="in" type="time" value="${String(s.to_t).slice(0, 5)}" onchange="SL.slots[${k}].to_t=this.value"></td>
        <td><input class="in" type="number" min="1" max="200" value="${s.cap}" onchange="SL.slots[${k}].cap=+this.value" style="width:90px"></td><td><button class="mini" onclick="SL.slots.splice(${k},1);drawSlots()">✕</button></td></tr>`).join("")}</tbody></table>
        <button class="mini" style="margin-top:8px" onclick="SL.slots.push({from_t:'17:00',to_t:'19:00',cap:10});drawSlots()">＋ Add slot</button></div>
    </div><div>
      <div class="box"><h3>Areas you deliver to</h3>${SL.cov.map((c, k) => `<div class="row"><div><b>${esc(c.locality)}</b><span>${c.blocks.length ? esc(c.blocks.join(", ")) : "All blocks"}</span></div><button class="mini" onclick="SL.cov.splice(${k},1);drawSlots()">✕</button></div>`).join("") || `<div class="sub">No areas yet.</div>`}
        <div style="display:flex;gap:8px;margin-top:10px"><input class="in" id="nl" placeholder="Locality e.g. Laxmi Nagar"><input class="in" id="nb" placeholder="Blocks (comma, optional)"><button class="mini dk" onclick="addArea()">Add</button></div></div>
      <div class="box"><div class="row" style="border:0;margin:0;padding:0"><div><b>Deliver just outside my areas (up to 1 km)</b><span>You accept each such order yourself</span></div><button class="tog ${SL.od ? "on" : ""}" onclick="SL.od=!SL.od;drawSlots()"></button></div>
        ${SL.od ? `<label>EXTRA FEE FOR OUTSIDE ORDERS ₹</label><input class="in" type="number" min="0" value="${SL.of}" onchange="SL.of=+this.value" style="max-width:160px">` : ""}</div>
      <div class="msg" id="slm"></div><button class="btn pink full" onclick="saveSlots()">Save changes</button>
    </div></div>`;
}
function addArea() { const l = $("#nl").value.trim(); if (!l) return; SL.cov.push({ locality: l, blocks: $("#nb").value.split(",").map(x => x.trim()).filter(Boolean) }); drawSlots(); }
async function saveSlots() {
  const m = $("#slm");
  try {
    const keep = SL.slots.filter(s => s.id).map(s => s.id), old = D.slots.map(s => s.id).filter(id => !keep.includes(id));
    if (old.length) await db.from("shop_slots").delete().in("id", old);
    for (const s of SL.slots.filter(s => s.id)) { const r = await db.from("shop_slots").update({ from_t: s.from_t, to_t: s.to_t, cap: s.cap }).eq("id", s.id); if (r.error) throw r.error; }
    const fresh = SL.slots.filter(s => !s.id).map(s => ({ shop: S.id, from_t: s.from_t, to_t: s.to_t, cap: s.cap }));
    if (fresh.length) { const r = await db.from("shop_slots").insert(fresh); if (r.error) throw r.error; }
    let r = await db.from("shop_coverage").delete().eq("shop", S.id); if (r.error) throw r.error;
    if (SL.cov.length) { r = await db.from("shop_coverage").insert(SL.cov.map(c => ({ shop: S.id, locality: c.locality, blocks: c.blocks }))); if (r.error) throw r.error; }
    r = await db.from("shops").update({ open_days: SL.days.join(""), open_time: SL.ot, close_time: SL.ct, outside_delivery: SL.od, outside_fee: SL.of || 0 }).eq("id", S.id); if (r.error) throw r.error;
    toast("Saved"); await loadAll(); slots();
  } catch (e) { m.className = "msg err"; m.textContent = niceErr(e); }
}

// ================= Bills & GST =================
async function bills() {
  const to = todayStr(), from = (() => { const d = new Date(); d.setDate(1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; })();
  $("#main").innerHTML = head("Bills & GST", "Bills are made automatically on delivery") + `
    <div class="bar2"><label style="margin:0">FROM</label><input class="in" type="date" id="bf" value="${from}" style="width:auto"><label style="margin:0">TO</label><input class="in" type="date" id="bt" value="${to}" style="width:auto">
      <button class="btn ghost" id="bgo" style="padding:9px 14px">Show</button><div class="sp"></div><button class="btn ghost" id="bx" style="padding:9px 14px">⇩ Export CSV</button></div><div id="bb"><div class="sub">Loading…</div></div>`;
  let rows = [], notes = [];
  const run = async () => {
    const f = $("#bf").value, t = $("#bt").value;
    const [o, c] = await Promise.all([db.from("orders").select("id,short_id,bill_no,cust_name,items,fee,total,returned,status,created_at,delivered_at,pay_mode").eq("shop", S.id).eq("status", "DELIVERED").gte("created_at", f).lte("created_at", t + "T23:59:59").order("created_at", { ascending: false }).limit(3000),
      db.from("credit_notes").select("*").eq("shop", S.id).gte("created_at", f).lte("created_at", t + "T23:59:59").order("created_at", { ascending: false })]);
    rows = o.data || []; notes = c.data || [];
    const gstOf = o => (o.items || []).filter(l => !(o.returned || []).includes(l.n)).reduce((a, l) => a + (l.g ? l.p * l.q * l.g / (100 + l.g) : 0), 0);
    const tot = rows.reduce((a, o) => a + payable(o), 0), gst = rows.reduce((a, o) => a + gstOf(o), 0);
    $("#bb").innerHTML = `<div class="kpis k4" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><span>Bills</span><b>${rows.length}</b></div><div class="kpi"><span>Sales (paid)</span><b>${inr(tot)}</b></div><div class="kpi"><span>GST inside${S.gst_billing ? "" : " (GST billing off)"}</span><b>${inr2(gst)}</b></div></div>
      <div class="grid2"><div class="box"><h3>Bills</h3>${rows.length ? `<table><thead><tr><th>BILL</th><th>DATE</th><th>CUSTOMER</th><th>PAID</th><th class="hm">MODE</th><th></th></tr></thead><tbody>${rows.map(o => `<tr><td><b>${esc(o.bill_no || short(o))}</b></td><td>${dmy(o.delivered_at || o.created_at)}</td><td>${esc(o.cust_name)}</td><td><b>${inr(payable(o))}</b></td><td class="hm">${esc(o.pay_mode || "")}</td><td><button class="mini" onclick="billPrint('${o.id}')">Print</button></td></tr>`).join("")}</tbody></table>` : `<div class="sub">No bills in these dates.</div>`}</div>
      <div class="box"><h3>Credit notes</h3>${notes.length ? `<table><thead><tr><th>NO.</th><th>DATE</th><th>KIND</th><th>AMOUNT</th></tr></thead><tbody>${notes.map(c => `<tr><td><b>${esc(c.cn_no || "—")}</b>${c.auto ? ` <span class="pill grey">Auto</span>` : ""}</td><td>${dmy(c.created_at)}</td><td>${esc(c.kind)}</td><td>${inr2(c.amount)}</td></tr>`).join("")}</tbody></table>` : `<div class="sub">No credit notes.</div>`}</div></div>`;
  };
  window.billPrint = id => { const o = rows.find(x => x.id === id); if (!D.orders.find(x => x.id === id)) D.orders.push(o); printBill(id); };
  $("#bgo").onclick = run;
  $("#bx").onclick = () => csvDownload(`bills-${$("#bf").value}-to-${$("#bt").value}.csv`, [["Bill no", "Date", "Customer", "Total", "Paid", "Mode"], ...rows.map(o => [o.bill_no || "", (o.delivered_at || o.created_at || "").slice(0, 10), o.cust_name, o.total, payable(o).toFixed(2), o.pay_mode || ""]),
    [], ["Credit note", "Date", "Kind", "Amount"], ...notes.map(c => [c.cn_no || "", (c.created_at || "").slice(0, 10), c.kind, c.amount])]);
  run();
}

// ================= Shop & KYC =================
function shop() {
  const dl = daysLeft(), kycTxt = { APPROVED: ["Verified", "ok"], PENDING: ["Being checked", "warn"], REJECTED: ["Rejected", "bad"], NONE: ["Not done", "bad"] }[S.kyc] || [S.kyc, "grey"];
  const f = (k, l, v, t = "text") => `<div><label>${l}</label><input class="in" id="sh_${k}" type="${t}" value="${esc(v ?? "")}"></div>`;
  $("#main").innerHTML = head("Shop & KYC", "Your shop details — the same as in the app") + `
    <div class="grid2"><div class="box"><h3>Shop details</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px">
      ${f("name", "SHOP NAME", S.name)}${f("phone", "PHONE", S.phone)}${f("addr", "ADDRESS", S.addr)}${f("locality", "LOCALITY", S.locality)}${f("city", "CITY", S.city)}${f("pin", "PIN CODE", S.pin)}
      ${f("min_order", "MINIMUM ORDER ₹", S.min_order, "number")}${f("delivery_fee", "DELIVERY FEE ₹", S.delivery_fee, "number")}${f("free_above", "FREE DELIVERY ABOVE ₹ (optional)", S.free_above, "number")}${f("upi_id", "UPI ID (shown to customers)", S.upi_id)}
      ${f("fssai", "FSSAI (food shops)", S.fssai)}${f("gstin", "GSTIN (optional)", S.gstin)}</div>
      <div class="msg" id="shm"></div><button class="btn pink" style="margin-top:12px" onclick="saveShopForm()">Save details</button></div>
    <div><div class="box"><h3>KYC <span class="pill ${kycTxt[1]}" style="float:right">${kycTxt[0]}</span></h3>
        <div class="row" style="border:0;margin:0"><div><b>PAN name</b><span>${esc(S.pan_name || "—")}</span></div></div><div class="row"><div><b>PAN</b><span>${S.pan_number ? esc(S.pan_number.slice(0, 5) + "••••" + S.pan_number.slice(-1)) : "—"}</span></div></div>
        <div class="row"><div><b>Aadhaar</b><span>${S.aadhaar_last4 ? "•••• " + esc(S.aadhaar_last4) : "—"}</span></div></div>
        ${S.kyc_reason && S.kyc !== "APPROVED" ? `<div class="warnline">${esc(S.kyc_reason)}</div>` : ""}<div class="note">KYC documents are uploaded and changed in the app (Account → KYC), with the camera.</div></div>
      <div class="box" style="background:#1D0F30;color:#fff"><b style="font-size:16px">${S.kyc !== "APPROVED" ? "Plan starts after KYC" : dl == null ? "Plan not started" : dl < 0 ? "Plan ended — shop is offline" : `${S.trial_used ? "Plan" : "Free trial"} • ${dl} day${dl === 1 ? "" : "s"} left`}</b>
        <div style="font-size:12px;color:#CFC6E3;margin:4px 0 12px">${S.sub_until ? "Till " + dmyy(S.sub_until) + " • " : ""}Renewal link goes to your email</div><button class="btn" style="background:#fff;color:#1D0F30" onclick="sendLink(this)">Send link</button></div>
      <div class="box"><h3>Status</h3><div class="row" style="border:0;margin:0"><div><b>${S.closed ? "Shop closed" : "Shop open"}</b><span>Customers ${S.closed ? "can't" : "can"} order right now</span></div><button class="tog ${S.closed ? "" : "on"}" onclick="toggleOpen()"></button></div></div></div></div>`;
}
async function saveShopForm() {
  const v = k => $("#sh_" + k).value.trim(), n = k => v(k) === "" ? null : +v(k), m = $("#shm");
  if (!v("name") || !/^\d{10}$/.test(v("phone").replace(/\D/g, "").slice(-10))) { m.className = "msg err"; m.textContent = "Enter shop name and a 10-digit phone"; return; }
  const patch = { name: v("name"), phone: v("phone"), addr: v("addr"), locality: v("locality"), city: v("city"), pin: v("pin"), min_order: n("min_order") || 0, delivery_fee: n("delivery_fee") || 0,
    free_above: n("free_above"), upi_id: v("upi_id") || null, fssai: v("fssai") || null, gstin: v("gstin") || null };
  if (!patch.gstin) patch.gst_billing = false;
  const { error } = await db.from("shops").update(patch).eq("id", S.id);
  if (error) { m.className = "msg err"; m.textContent = niceErr(error); return; }
  Object.assign(S, patch); toast("Saved"); shell(); page();
}

boot();
