// Gali Bazaar — Seller panel on the web (same shop + data as the seller app; RLS = only your shop).
// Routes: /seller/login/  /seller/  /seller/orders/  /seller/catalog/  /seller/catalog/bulk/  /seller/returns/
//         /seller/complaints/  /seller/staff/  /seller/slots/  /seller/bills/  /seller/shop/  /seller/plan/  /seller/support/
const db = makeClient("gb-seller-auth");
const BANNED = /(cigar|cigarette|bidi|beedi|gutkha|gutka|tobacco|tambaku|khaini|zarda|pan masala|paan masala|hookah|vape|e-cig|nicotine|snuff|beer|whisky|whiskey|vodka|\brum\b|wine|liquor|daru|sharab|सिगरेट|बीड़ी|बीडी|गुटखा|तंबाकू|तम्बाकू|खैनी|ज़र्दा|जर्दा|शराब|दारू)/i;
const banWord = (...s) => { for (const x of s) { const m = x && String(x).match(BANNED); if (m) return /cig|bidi|beedi|gutk|tobac|tamba|khain|zard|masala|hookah|vape|nicot|snuff|सिग|बीड़|बीडी|गुट|तंब|तम्ब|खैन|ज़र्द|जर्द/i.test(m[0]) ? "tobacco" : "alcohol"; } return null; };
const ICON = {
  plan: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4",
  support: "M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-2v-6h4M4 13h4v6H6a2 2 0 0 1-2-2zM12 21h4",
  dash: "M3 11 12 4l9 7v9h-6v-6H9v6H3z", courier: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10", orders: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01", cat: "M4 9h16l-1.5-5h-13zM5 9v11h14V9M9 20v-6h6v6",
  ret: "M6 6l12 12M18 6 6 18", comp: "M3 6h18v12H3zM3 7l9 6 9-6", staff: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 0 1 0 7M22 21c0-3-2-5-4-5.6",
  slots: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2", bills: "M6 3h9l4 4v14H6zM14 3v5h5", books: "M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h6M8 11h6", shop: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4",
};
const NAV = [["", "Dashboard", "dash"], ["orders", "Orders", "orders"], ["courier", "Courier", "courier"], ["catalog", "Catalog", "cat"], ["returns", "Returns & cancelled", "ret"], ["complaints", "Complaints", "comp"],
  ["staff", "Delivery staff", "staff"], ["slots", "Slots & areas", "slots"], ["bills", "Bills & GST", "bills"], ["books", "Books & expenses", "books"], ["shop", "Shop & KYC", "shop"], ["plan", "Subscription & bills", "plan"], ["support", "Help & support", "support"]];
const ico = (k, s = 19) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[k] || k}"/></svg>`;
let S = null, me = null, D = { items: [], orders: [], riders: [], complaints: [], cns: [], slots: [], cov: [], festivals: [] };
let catF = "all", catQ = "", ordTab = "new", retTab = "coming", drawerOpen = false;
const route = () => location.pathname.replace(/^\/seller\/?/, "").replace(/\/$/, "");
const go = p => { history.pushState({}, "", "/seller/" + (p ? p + "/" : "")); page(); };
window.onpopstate = () => page();
const localDay = x => { const d = new Date(x); return isNaN(d) ? "" : istIso(d); };
const todayStr = () => istIso();
const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const short = o => "#" + (o.short_id || String(o.id).slice(0, 6).toUpperCase());
const payable = o => { const kept = (o.items || []).filter(l => !(o.returned || []).includes(l.n)); return kept.length ? kept.reduce((a, l) => a + l.p * l.q, 0) + Number(o.fee || 0) : 0; };
const saleOf = o => o.status === "DELIVERED" ? payable(o) : 0;
const comingBack = o => (o.status === "DELIVERED" && (o.returned || []).length) || (o.status === "CANCELLED" && (o.picked_at || o.refused_at));
const backItems = o => o.status === "CANCELLED" ? (o.items || []) : (o.items || []).filter(l => (o.returned || []).includes(l.n));
const photos = i => (i.images && i.images.length ? i.images : [i.img_url]).filter(Boolean);
const hidden = i => i.photos_ok === false || (i.photos_ok == null && photos(i).length < NEED());
const SLOT_ABBR = { front: "F", label: "L", ingredients: "I", back: "B", tag: "T", side: "S", top: "Tp", sole: "So", cut: "C", bis: "BIS", more: "+", more2: "+" };
const STATUS = { PLACED: ["New", "bad"], ACCEPTED: ["Packing", "warn"], OUT: ["On the way", "grey"], DELIVERED: ["Delivered", "ok"], CANCELLED: ["Cancelled", "grey"], DECLINED: ["Rejected", "grey"] };
const pill = o => { const [l, c] = STATUS[o.status] || [o.status, "grey"]; return `<span class="pill ${c}">${l}</span>`; };
const retLabel = i => i.ret_policy === "replace" && i.ret_days ? `Replacement • ${i.ret_days} days` : i.ret_policy === "return" && i.ret_days ? `Return & refund • ${i.ret_days} days` : "At door only";
const daysLeft = () => S.sub_until ? Math.round((new Date(S.sub_until) - new Date(todayStr())) / 864e5) : null;
// same rule as the server's shop_live(): 5 days' grace after the plan ends, not paused for dues, not closed (update-71)
const graceOk = () => { if (!S.sub_until) return false; const d = new Date(S.sub_until + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 5); return d.toISOString().slice(0, 10) >= todayStr(); };
const live = () => S.kyc === "APPROVED" && !S.quality_hold && !S.dues_paused && !S.closed && graceOk();

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
  if (window.GBTerms) await GBTerms.gate(db, "seller", () => location.replace("/seller/login/"));
  await loadAll();
  shell(); page();
  liveSync(db, "seller", [["orders", `shop=eq.${S.id}`], ["items", `shop=eq.${S.id}`], ["riders", `shop=eq.${S.id}`], ["complaints", `shop=eq.${S.id}`],
    ["credit_notes", `shop=eq.${S.id}`], ["shops", `id=eq.${S.id}`], ["shop_slots", `shop=eq.${S.id}`], ["shop_coverage", `shop=eq.${S.id}`], "festivals"],
    async () => {
      const cnt = () => ({ o: D.orders.filter(o => o.status === "PLACED").length, c: (D.complaints || []).filter(c => c.status === "OPEN").length, k: S.kyc,
        paid: D.orders.filter(o => o.status === "DELIVERED").length });
      const b = cnt(); await loadAll(); refreshChrome(); if (!drawerOpen) page(); const a = cnt();
      if (a.o > b.o) { toast("🔔 New order"); tone("new_order"); }
      else if (a.c > b.c) { toast("⚠️ New complaint"); tone("complaint"); }
      else if (a.k === "APPROVED" && b.k !== "APPROVED") { toast("✅ KYC approved"); tone("kyc_ok"); }
      else if (a.paid > b.paid) tone("payment");
    });
}
async function notSeller(email) {
  await db.auth.signOut();
  document.body.innerHTML = `<div class="login">${LOGO}<h1>This account isn't a seller account</h1><p class="sub">${esc(email || "")} doesn't own a shop on Gali Bazaar, so it can't open the seller panel. You've been signed out.<br><br>New shop? Download the app and tap <b>Register your shop</b> — KYC is done in the app.</p><a class="btn pink" href="/seller/login/">Sign in again</a> <a class="btn ghost" href="/#install">Download app</a></div>`;
}
// voice alerts ("New order arrived!") — the same tones as the app
// food shops must give a 14-digit FSSAI number (update-47)
// return options this shop's category allows (admin → Categories): food = only at the door, grocery = replacement ≤ 3 days
const RET = () => { const c = (D.cats || []).find(x => x.key === S.type), t = S.type;
  const d = c && c.max_return_days != null ? c.max_return_days : (["sweets", "food", "fruitveg"].includes(t) ? 0 : t === "grocery" ? 3 : 30);
  return { max: Math.max(0, Math.min(30, d)), refund: c && c.allow_refund != null ? !!c.allow_refund : t !== "grocery" }; };
// address points are approximate → never an exact distance
const approxKm = k => k < 0.5 ? "just" : k <= 1 ? "about 1 km" : `about ${Math.round(k)} km`;
// fixed category kinds (update-51) — same rules as kind_rules() on the server
const KINDS = { food_fresh: { fssai: 1, courier: "never", ret: 0, refund: 0, packaged: 0, bis: 0, food: 1 }, food_cooked: { fssai: 1, courier: "sealed", ret: 0, refund: 0, packaged: 0, bis: 0, food: 1 },
  food_packed: { fssai: 1, courier: "sealed", ret: 3, refund: 0, packaged: 1, bis: 0, food: 1 }, flowers: { fssai: 0, courier: "never", ret: 0, refund: 0, packaged: 0, bis: 0, food: 0 },
  general: { fssai: 0, courier: "yes", ret: 30, refund: 1, packaged: 1, bis: 0, food: 0 }, bis_goods: { fssai: 0, courier: "yes", ret: 15, refund: 1, packaged: 1, bis: 1, food: 0 } };
const KIND = () => { const c = (D.cats || []).find(x => x.key === S.type), k = c?.kind || ({ grocery: "food_packed", sweets: "food_cooked", food: "food_cooked", fruitveg: "food_fresh" })[S.type] || "general"; return { key: k, ...KINDS[k] }; };
const COURIER_SHOP = () => ["courier", "both"].includes(S.delivery_mode);
const FOOD = () => (D.cats || []).some(c => c.key === S.type && c.needs_fssai) || (!(D.cats || []).length && ["grocery", "fruitveg", "sweets", "food"].includes(S.type));
const TONE = {};
function tone(k) { try { const a = TONE[k] || (TONE[k] = new Audio(`/sounds/${k}.mp3`)); a.currentTime = 0; a.play().catch(() => {}); } catch (e) {} }
function beep() { tone("new_order"); }

async function loadAll() {
  const since3 = new Date(Date.now() - 3 * 864e5).toISOString(), since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [shop, items, ords, rid, comp, cns, slots, cov, fest, catq] = await Promise.all([
    db.from("shops").select("*").eq("id", S.id).single(),
    db.from("items").select("*").eq("shop", S.id).order("name"),
    db.from("orders").select("*").eq("shop", S.id).or(`created_at.gte.${since30},status.in.(PLACED,ACCEPTED,OUT)`).order("created_at", { ascending: false }).limit(600),
    db.from("riders").select("*").eq("shop", S.id).order("created_at"),
    db.from("complaints").select("*").eq("shop", S.id).order("created_at", { ascending: false }).limit(200),
    db.from("credit_notes").select("*").eq("shop", S.id).order("created_at", { ascending: false }).limit(300),
    db.from("shop_slots").select("*").eq("shop", S.id).order("from_t"),
    db.from("shop_coverage").select("*").eq("shop", S.id),
    db.from("festivals").select("*").gte("day", todayStr()).order("day").limit(3),
    db.from("categories").select("*"),
  ]);
  const charts = await db.from("size_charts").select("*").or(`shop.eq.${S.id},shop.is.null`).order("name");   // own + Gali Bazaar standard
  if (shop.data) S = shop.data;
  D = { items: items.data || [], orders: ords.data || [], riders: rid.data || [], complaints: comp.data || [], cns: cns.data || [], slots: slots.data || [], cov: cov.data || [], festivals: fest.data || [] };
  D.cats = catq.data || [];
  { const r = await db.rpc("item_spec_def"); if (!r.error && r.data && r.data.sets) { SPEC = r.data; SPEC_LIVE = true; } }   // update-65
  D.charts = charts.error ? [] : (charts.data || []);
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
  // Food Corner (update-70): orders are by phone — no orders, courier, returns, staff, slots or bills in the panel
  const COOKED_HIDE = ["orders", "courier", "returns", "staff", "bills"];
  $("#snav").innerHTML = NAV.filter(([k]) => !(COOKED() && COOKED_HIDE.includes(k))).map(([k, l, i]) => {
    if (COOKED() && k === "catalog") l = "Menu"; if (COOKED() && k === "slots") l = "Areas you serve"; const n = k === "orders" ? c.neworders : k === "returns" ? c.ret : k === "complaints" ? c.comp : 0;
    return `<a data-k="${k}" href="/seller/${k ? k + "/" : ""}" class="${k === r ? "on" : ""}">${ico(i)}<span>${l}</span>${n ? `<span class="badge">${n}</span>` : ""}</a>`; }).join("");
  $$("#snav a").forEach(a => a.onclick = e => { e.preventDefault(); menu(false); go(a.dataset.k); });
}
function menu(o) { $(".side").classList.toggle("open", o); $("#scrim").classList.toggle("open", o); }
// is the shop visible to customers? KYC approved + plan/trial running (+ not on hold)
function shopStatusPill() {
  const t = todayStr(), on = live() && !S.delete_requested_at;
  // three separate states: Closed · Paused · dues · Active
  if (S.closed && !S.delete_requested_at) return `<span class="pill grey" style="margin-left:6px" title="You closed the shop — customers can't order until you open it">● Closed</span>`;
  if (S.dues_paused && !S.delete_requested_at) return `<span class="pill bad" style="margin-left:6px;cursor:pointer" title="Plan / TDS dues not paid — pay to come back live" onclick="go('plan')">● Paused · dues</span>`;
  if (S.delete_requested_at) return `<span class="pill bad" style="margin-left:6px;cursor:pointer" title="Your delete request is with Gali Bazaar — customers can't see or order from your shop" onclick="go('shop')">● Hidden · delete request</span>`;
  const why = S.kyc !== "APPROVED" ? (S.kyc === "PENDING" ? "KYC being checked" : "KYC not done") : !graceOk() ? "plan ended" : S.quality_hold ? "on hold" : "";
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
  if (r === "catalog/charts") return charts();
  if (r === "catalog/new") { catalog(); return editItem(null); }
  ({ "": dash, orders, courier, catalog, returns, complaints, staff, slots, bills, books, shop, plan, support }[r.split("/")[0]] || dash)();
}
function drawer(html, wide) {
  const el = $("#panel"); el.innerHTML = html; el.classList.add("open"); el.style.width = wide ? "520px" : ""; document.body.classList.add("po"); drawerOpen = true;
}
function closeDrawer(silent) { const el = $("#panel"); if (!el) return; el.classList.remove("open"); document.body.classList.remove("po"); drawerOpen = false; if (!silent && route() === "catalog/new") history.replaceState({}, "", "/seller/catalog/"); }

// ================= Dashboard =================
function dash() {
  const t = todayStr(), hr = istD(Date.now()).getUTCHours();
  const todayDone = D.orders.filter(o => o.status === "DELIVERED" && localDay(o.delivered_at || o.created_at) === t);
  const sales = todayDone.reduce((a, o) => a + saleOf(o), 0), news = D.orders.filter(o => o.status === "PLACED");
  const cashO = D.orders.filter(o => o.status === "DELIVERED" && o.pay_mode === "CASH" && o.delivered_by && o.delivered_by !== "Shop" && !o.cash_settled_at && o.rider);
  const cash = cashO.reduce((a, o) => a + payable(o), 0), who = [...new Set(cashO.map(o => D.riders.find(r => r.id === o.rider)?.name).filter(Boolean))];
  const back = D.orders.filter(o => comingBack(o) && !o.return_checked_at), backV = back.reduce((a, o) => a + backItems(o).reduce((x, l) => x + l.p * l.q, 0), 0);
  const miss = D.items.filter(hidden).length, oos = D.items.filter(i => !i.in_stock).length, liveI = D.items.filter(i => !hidden(i) && i.in_stock).length;
  const dl = daysLeft(), paid = D.orders.length >= 0 && S.trial_used;
  const plan = S.kyc !== "APPROVED" ? (S.kyc === "PENDING" ? "KYC under verification" : "Finish KYC in the app") : dl == null ? "Plan not started" : dl < 0 ? "Plan ended — shop is offline" : `${S.trial_used ? "Plan" : "Free trial"} • ${dl} day${dl === 1 ? "" : "s"} left`;
  const fest = D.festivals.find(f => f.active !== false && (new Date(f.day) - new Date(t)) / 864e5 <= 7);
  const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  $("#main").innerHTML = head(`${greet}${S.pan_name ? ", " + esc(S.pan_name.split(" ")[0][0] + S.pan_name.split(" ")[0].slice(1).toLowerCase()) : ""}`,
      `${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} • ${esc(S.name)}${S.locality ? ", " + esc(S.locality) : ""}`,
      `<button class="btn pink" onclick="editItem(null)">＋ Add item</button>`) + (D.items.some(lowI) ? (() => { const L = D.items.filter(lowI).sort((a, b) => a.stock_qty - b.stock_qty); return `
    <div class="box" style="background:#FFF7E6;border-color:#FFC93C;display:flex;gap:12px;align-items:center;flex-wrap:wrap;cursor:pointer" onclick="catF='low';go('catalog')"><span style="font-size:24px">📦</span>
      <div style="flex:1;min-width:200px"><b style="color:#8A5A00">${L.length} item${L.length === 1 ? "" : "s"} low on stock</b><div class="sub" style="margin:0">${L.slice(0, 3).map(i => `${esc(i.name)} (${i.stock_qty === 0 ? "out" : i.stock_qty + " left"})`).join(" · ")}${L.length > 3 ? ` · +${L.length - 3} more` : ""}</div></div>
      <b style="color:#8A5A00">Update stock →</b></div>`; })() : "") + (FOOD() && !/^[12][0-9]{13}$/.test(S.fssai || "") ? `
    <div class="box" style="background:#FFF4D6;border-color:#F6D58A;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="font-size:24px">🧾</span>
      <div style="flex:1;min-width:200px"><b>Add your FSSAI number</b><div class="sub">FSSAI registration is required for food shops. Add your 14-digit number to keep selling.</div></div>
      <a class="btn dark" href="/seller/shop/">Add FSSAI number</a></div>` : "") + `
    <div class="kpis k4">
      <div class="kpi"><span>Today's sales</span><b>${inr(sales)}</b><small>${todayDone.length} order${todayDone.length === 1 ? "" : "s"} delivered${(o => o > 0 ? ` · 🪔 ${inr(o)} from offers` : "")(todayDone.reduce((a, o) => a + (o.items || []).filter(l => l.d && !(o.returned || []).includes(l.n)).reduce((x, l) => x + l.p * l.q, 0), 0))}</small></div>
      <div class="kpi"><span>New orders</span><b class="pk">${news.length}</b><small>waiting for you</small></div>
      <div class="kpi"><span>Cash with staff</span><b class="or">${inr(cash)}</b><small>${who.length ? esc(who.join(", ")) + " • not handed over" : "All cash received"}</small></div>
      <div class="kpi"><span>Returns coming back</span><b class="pu">${back.length}</b><small>${inr(backV)} • check in</small></div>
    </div>
    ${!live() ? `<div class="warnline" style="margin:0 0 16px">Your shop is hidden from customers: ${S.kyc !== "APPROVED" ? (S.kyc === "PENDING" ? "KYC is being checked." : "finish KYC in the app.") : S.quality_hold ? "paused for quality — reply to your complaints." : S.dues_paused ? "paused for dues — pay in Subscription & bills." : S.closed ? "you closed the shop." : "plan ended — send yourself the renewal link below."}</div>` : ""}
    <div class="grid2">
      <div class="box"><h3>New orders <a href="/seller/orders/" onclick="event.preventDefault();go('orders')" style="float:right;color:#7C3AED;font-size:13px;text-decoration:none">All orders →</a></h3>
        ${news.length ? orderTable(news.slice(0, 8), true) : `<div class="sub" style="padding:18px 0">No new orders right now. New orders appear here by themselves.</div>`}</div>
      <div>
        ${typeof shareBox === "function" ? shareBox() : ""}
        <div class="box"><h3>Quick actions</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn" style="background:#F3EDFF;text-align:left" onclick="editItem(null)">＋ Add item</button>
          <button class="btn" style="background:#FFE4EC;text-align:left" onclick="go('catalog/bulk')">⇪ Bulk upload</button>
          <button class="btn" style="background:#FFF3E2;text-align:left" onclick="go('slots')">◷ Slots</button>
          <button class="btn" style="background:#E6F8EE;text-align:left" onclick="go('staff')">👥 Delivery staff</button></div></div>
        ${fest ? `<div class="box" style="background:linear-gradient(135deg,#FF8A1F,#EF287B);color:#fff"><b style="font-size:16px">${esc(fest.name)} ${(new Date(fest.day) - new Date(t)) / 864e5 < 1 ? "is today" : "in " + Math.round((new Date(fest.day) - new Date(t)) / 864e5) + " days"}</b>
          <div style="font-size:12.5px;opacity:.9;margin:4px 0 10px">${D.items.filter(i => i.fest === fest.id).length} items tagged. Tag your festival items in the app (Dashboard → Festival items) — they show in the festival banner for customers near you.</div></div>` : ""}
        <div class="box"><h3>Catalogue health <span style="float:right">${D.items.length} items</span></h3>
          <div class="fu"><div><b style="font-weight:500">Missing photos</b></div><a class="pill bad" href="#" onclick="event.preventDefault();catF='missing';go('catalog')">${miss} items</a></div>
          <div class="fu"><div><b style="font-weight:500">Out of stock</b></div><a class="pill warn" href="#" onclick="event.preventDefault();catF='oos';go('catalog')">${oos} items</a></div>
          <div class="fu"><div><b style="font-weight:500">Live with 3 photos</b></div><span class="pill ok">${liveI} items</span></div></div>
        <div class="box" style="background:#1D0F30;color:#fff;display:flex;align-items:center;gap:12px"><div style="flex:1"><b style="font-size:15px">${esc(plan)}</b><div style="font-size:12px;color:#CFC6E3">Renewal link goes to your email</div></div>
          <button class="btn" style="background:#fff;color:#1D0F30;padding:9px 14px" onclick="sendLink(this)">Send link</button></div>
      </div></div>`;
  rulesCard();   // IT Rules 2026: content-rules reminder every 3 months
  cookedCard();  // Food Corner: calls this month
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
    <td><b>${short(o)}</b><br><span class="sub">${ago(o.created_at)}</span></td><td><b>${esc(o.cust_name)}</b>${o.outside ? `<br><span class="pill warn">${approxKm(Number(o.outside_km || 0)) === "just" ? "Just outside area" : "Outside area • " + approxKm(Number(o.outside_km || 0))}</span>` : ""}</td>
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
  const cur = T.find(t => t[0] === ordTab) || T[0], loc = D.recent.filter(o => o.delivery_type !== "courier"), list = loc.filter(cur[2]);
  $("#main").innerHTML = head("Orders", "Running orders and the last 3 days • older ones are in Bills & GST") + `
    <div class="bar2"><div class="fchips">${T.map(([k, l, f]) => `<button class="fchip ${ordTab === k ? "on" : ""}" onclick="ordTab='${k}';orders()">${l} ${loc.filter(f).length}</button>`).join("")}</div>
      ${COURIER_SHOP() || D.recent.some(o => o.delivery_type === "courier") ? `<div class="sp"></div><button class="btn ghost" onclick="go('courier')">📦 Courier orders ${D.recent.filter(o => o.delivery_type === "courier" && ["PLACED", "ACCEPTED"].includes(o.status)).length}</button>` : ""}</div>
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
    ${o.outside ? `<div class="warnline">Customer is ${approxKm(Number(o.outside_km || 0))} outside your areas. Accept only if you can deliver.</div>` : ""}
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
    <div class="box" style="background:#F6F2FB;margin-top:12px"><b>${esc(o.cust_name)}</b>${o.cust_phone ? (/^X/.test(o.cust_phone) ? ` • ${esc(o.cust_phone)} <span class="sub" style="margin:0">(hidden 24 h after the order)</span>` : ` • <a href="${phoneLink(o.cust_phone)}" style="color:#7C3AED">${esc(o.cust_phone)}</a>`) : ""}<div class="sub">${esc(o.addr)}</div>
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

// ================= Item details by category (update-65) =================
// The server keeps the master list (item_spec_def) and checks every item; this built-in copy is used until it loads.
// SPEC_LIVE: the server has update-65 — only then are the new boxes shown, checked and saved
let SPEC_LIVE = false;
let SPEC = {"version":1,"sets":{"apparel":{"label":"Clothing","hi":"कपड़े","fields":[{"k":"material","label":"Material / fabric","req":true,"hint":"e.g. 100% cotton","hi":"मटीरियल / कपड़ा"},{"k":"colour","label":"Colour","req":true,"hint":"e.g. Navy blue","hi":"रंग"},{"k":"fit","label":"Fit","req":false,"options":["Regular","Slim","Loose"],"hi":"फ़िट"},{"k":"wash_care","label":"Wash care","req":false,"hint":"e.g. Machine wash cold","hi":"धुलाई"}]},"footwear":{"label":"Footwear","hi":"जूते-चप्पल","fields":[{"k":"upper","label":"Upper material","req":true,"hint":"e.g. Synthetic leather","hi":"ऊपर का मटीरियल"},{"k":"sole","label":"Sole material","req":true,"hint":"e.g. Rubber / EVA","hi":"सोल का मटीरियल"},{"k":"colour","label":"Colour","req":true,"hint":"e.g. Black","hi":"रंग"},{"k":"ftype","label":"Footwear type","req":false,"options":["Shoe","Sports shoe","Sandal","Slipper","Chappal","Boot","Other"],"hi":"टाइप"}]},"electrical":{"label":"Electrical / appliance","hi":"बिजली का सामान / उपकरण","fields":[{"k":"brand","label":"Brand","req":true,"hint":"e.g. Bajaj","hi":"ब्रांड"},{"k":"model","label":"Model no.","req":true,"hint":"e.g. KX 15 (as printed on the product)","hi":"मॉडल नंबर"},{"k":"power","label":"Power / voltage","req":true,"hint":"e.g. 750 W, 230 V","hi":"पावर (W) / वोल्टेज"},{"k":"in_box","label":"What's in the box","req":true,"hint":"e.g. Mixer, 3 jars, user manual","hi":"डिब्बे में क्या है"}]},"mobile_acc":{"label":"Mobile accessory","hi":"मोबाइल एक्सेसरी","fields":[{"k":"brand","label":"Brand","req":true,"hint":"e.g. boAt","hi":"ब्रांड"},{"k":"compatible","label":"Works with","req":true,"hint":"e.g. Type-C phones, iPhone 13","hi":"किस फ़ोन के साथ चलेगा"},{"k":"colour","label":"Colour","req":false,"hint":"e.g. Black","hi":"रंग"}]},"beauty":{"label":"Personal care & beauty","hi":"पर्सनल केयर व ब्यूटी","fields":[{"k":"brand","label":"Brand","req":true,"hint":"e.g. Himalaya","hi":"ब्रांड"},{"k":"ingredients","label":"Key ingredients","req":true,"hint":"e.g. Neem, turmeric","hi":"मुख्य सामग्री"},{"k":"how_to_use","label":"How to use","req":true,"hint":"e.g. Apply on wet face, rinse after 1 minute","hi":"कैसे इस्तेमाल करें"},{"k":"skin_hair","label":"Skin / hair type","req":false,"hint":"e.g. All skin types","hi":"त्वचा / बालों का टाइप"}]},"toys":{"label":"Toys","hi":"खिलौने","fields":[{"k":"brand","label":"Brand","req":true,"hint":"e.g. Funskool","hi":"ब्रांड"},{"k":"age","label":"Age group","req":true,"hint":"e.g. 3+ years","hi":"उम्र"},{"k":"material","label":"Material","req":true,"hint":"e.g. Plastic","hi":"मटीरियल"}]},"homekitchen":{"label":"Home & kitchen","hi":"घर व रसोई","fields":[{"k":"material","label":"Material","req":true,"hint":"e.g. Stainless steel","hi":"मटीरियल"},{"k":"size","label":"Size / capacity","req":true,"hint":"e.g. 3 L, 24 cm","hi":"साइज़ / क्षमता"},{"k":"colour","label":"Colour","req":false,"hint":"e.g. Silver","hi":"रंग"}]},"stationery":{"label":"Stationery, books & gifts","hi":"स्टेशनरी, किताबें व गिफ़्ट","fields":[{"k":"brand","label":"Brand / publisher","req":true,"hint":"e.g. Classmate","hi":"ब्रांड / प्रकाशक"},{"k":"contents","label":"What's in the pack","req":true,"hint":"e.g. 6 notebooks, 200 pages each","hi":"पैक में क्या-क्या है"}]},"general":{"label":"Other items","hi":"बाक़ी सामान","fields":[],"details_min":20}},"by_category":{"garments":["apparel"],"footwear":["footwear"],"electrical":["electrical","mobile_acc"],"beauty":["beauty"],"toys":["toys"],"homekitchen":["homekitchen"],"stationery":["stationery"]},"none_kinds":["food_fresh","food_cooked","food_packed","flowers"],"details_min":20};
const specSets = t => SPEC.none_kinds.includes(KIND().key) ? [] : (SPEC.by_category[t] || ["general"]);
function specBox(i) {
  const sets = specSets(S.type); if (!sets.length || !SPEC_LIVE) return "";
  if (!F_.specSet) F_.specSet = sets.includes(i?.spec_set) ? i.spec_set : sets.length === 1 ? sets[0] : null;
  F_.specs = F_.specs || { ...(i?.specs || {}) };
  const st = SPEC.sets[F_.specSet];
  const field = f => f.options
    ? `<div><label>${esc(f.label.toUpperCase())}${f.req ? " *" : " (OPTIONAL)"}</label><select class="in" data-spec="${f.k}"><option value="">—</option>${f.options.map(o => `<option ${F_.specs[f.k] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`
    : `<div><label>${esc(f.label.toUpperCase())}${f.req ? " *" : " (OPTIONAL)"}</label><input class="in" data-spec="${f.k}" maxlength="300" value="${esc(F_.specs[f.k] || "")}" placeholder="${esc(f.hint || "")}"></div>`;
  return `<div id="specbox" style="border:1px solid #EEE7F6;border-radius:16px;padding:12px 14px;margin-top:12px"><b>Product details</b>
    ${sets.length > 1 ? `<label>PRODUCT TYPE *</label><div class="fchips" style="background:#F6F2FB;border-radius:14px;padding:4px;gap:4px">${sets.map(k => `<button class="fchip ${F_.specSet === k ? "on" : ""}" style="flex:1;border:0" onclick="specPick('${k}')">${esc(SPEC.sets[k].label)}</button>`).join("")}</div>` : ""}
    ${st ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">${st.fields.map(field).join("")}</div>` : ""}
    ${st && st.details_min ? `<div class="sub" style="font-size:12px;margin:6px 0 0">Write at least ${st.details_min} letters in <b>Product details</b> below — what it is, size, material, use.</div>` : ""}</div>`;
}
function specErr(desc) {
  const sets = specSets(S.type); if (!sets.length || !SPEC_LIVE) return null;
  if (!F_.specSet) return "Pick the product type";
  const st = SPEC.sets[F_.specSet], miss = st.fields.find(f => f.req && !(F_.specs[f.k] || "").trim());
  if (miss) return `Add ${miss.label.toLowerCase()} — needed for ${(D.cats.find(c => c.key === S.type) || {}).name || "this category"}`;
  if (st.details_min && desc.replace(/\s+/g, " ").length < st.details_min) return `Product details: write at least ${st.details_min} letters about the item`;
  return null;
}
function specRead() { document.querySelectorAll("[data-spec]").forEach(el => { F_.specs[el.dataset.spec] = el.value.trim(); }); }
function specPick(k) { specRead(); F_.specSet = k; const b = $("#specbox"); if (b) b.outerHTML = specBox(null); }

// 270, "270.00", 270.0 → "270"; 12.5 → "12.5" (form boxes show whole rupees without decimals)
const numTxt = v => v == null || v === "" || isNaN(+v) ? "" : String(Math.round(+v * 100) / 100);

// ================= Food Corner (update-70): listing + "Call to order" =================
const COOKED = () => !!S && (((D.cats || []).find(c => c.key === S.type) || {}).call_only ?? S.type === "food");   // Food Corner (sweets / bakery keep orders)
async function cookedCard() {
  if (!COOKED()) return;
  const { data: c } = await db.rpc("my_shop_calls"); const x = c || { month: 0, today: 0, last_month: 0 };
  const m = $("#main"); if (!m || document.getElementById("callscard")) return;
  const h = m.querySelector(".top");
  const html = `<div class="box" id="callscard" style="background:#1D0F30;color:#fff;display:flex;gap:16px;align-items:center;flex-wrap:wrap"><span style="font-size:28px">📞</span>
    <div style="flex:1;min-width:220px"><div style="font-size:12.5px;color:#C9BEDC">Calls this month</div><div style="font-size:28px;font-weight:800">${x.month}</div>
      <div style="font-size:12.5px;color:#C9BEDC;margin-top:4px">Customers see your menu and call you. Orders, payment, bills and delivery are yours, outside the app.</div></div>
    <div style="text-align:right"><b>Today ${x.today}</b><div style="font-size:12px;color:#C9BEDC">Last month ${x.last_month}</div></div></div>`;
  if (h) h.insertAdjacentHTML("afterend", html); else m.insertAdjacentHTML("afterbegin", html);
}

// ================= Content-rules reminder (update-69): shown for 30 days after each quarterly push, until "Got it" =================
async function rulesCard() {
  const { data: r } = await db.rpc("content_reminder_now"); if (!r || !r.year) return;
  const key = `rules_seen_${r.year}_${r.quarter}`; try { if (localStorage.getItem(key)) return; } catch (e) {}
  const m = $("#main"); if (!m || document.getElementById("rulescard")) return;
  const h = m.querySelector(".top"); const html = `<div class="box" id="rulescard" style="background:#F3EDFF;border-color:#E2D6FA"><b>📜 Reminder: Gali Bazaar content rules</b>
    <div class="sub" style="margin:4px 0 10px;color:#3D2F55">In ratings, chats, photos and items, don't post: someone else's content, obscene or harmful-to-children material, false or misleading claims, impersonation, anything against India's security or public order, viruses, or anything illegal. Such content is removed and the account can be closed.</div>
    <a class="btn ghost" href="/legal/#terms" target="_blank">Read the rules</a> <button class="btn pink" onclick="try{localStorage.setItem('${key}','1')}catch(e){};document.getElementById('rulescard').remove()">Got it</button></div>`;
  if (h) h.insertAdjacentHTML("afterend", html); else m.insertAdjacentHTML("afterbegin", html);
}

// ================= Catalog =================
// low stock (update-63): items with a stock count at or below the shop's mark (default 5)
const lowI = i => i.stock_qty != null && i.stock_qty <= (S.low_stock_at ?? 5);
function catalog() {
  const groups = [...new Set(D.items.map(i => (i.grp || "").trim()).filter(Boolean))].sort().slice(0, 8);
  const liveN = D.items.filter(i => !hidden(i) && i.in_stock).length;
  const F = [["all", `All ${D.items.length}`], ["missing", `Hidden ${D.items.filter(hidden).length}`], ["oos", `Out of stock ${D.items.filter(i => !i.in_stock).length}`], ...(D.items.some(lowI) ? [["low", `📦 Low stock ${D.items.filter(lowI).length}`]] : []), ...groups.map(g => ["g:" + g, g])];
  $("#main").innerHTML = head(`${D.items.length} items • ${liveN} live`, "Photos per item depend on your category — see the 📷 Photo guide. Hidden items show what to fix.",
      `<a class="btn ghost" href="/help/photo-guide/" target="_blank">📷 Photo guide</a>${["garments", "footwear"].includes(S.type) ? `<button class="btn ghost" onclick="go('catalog/charts')">📏 Size charts</button>` : ""}<button class="btn ghost" onclick="go('catalog/bulk')">⇪ Bulk upload</button><button class="btn pink" onclick="editItem(null)">＋ Add item</button>`) + `
    <div class="bar2"><div class="fchips">${F.map(([k, l]) => `<button class="fchip ${catF === k ? "on" : ""}" data-f="${esc(k)}">${esc(l)}</button>`).join("")}</div><div class="sp"></div>
      <input class="search" id="q" placeholder="🔍 Search items" value="${esc(catQ)}"></div>
    ${(() => { const H = D.items.filter(hidden); if (!H.length) return ""; const why = {};
      H.forEach(i => { const k = String(i.hidden_reason || "Add photos").startsWith("Fix:") ? "Fix details" : (i.hidden_reason || "Add photos"); why[k] = (why[k] || 0) + 1; });
      const main = Object.entries(why).sort((a, b) => b[1] - a[1])[0][0], act = main === "Add size chart" ? "pick a size chart" : main === "Add photos" ? "add photos" : "fix the details";
      return `<div class="box" style="border:1.5px solid #F7A8C4;background:#FFF1F5;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="catF='${catF === "missing" ? "all" : "missing"}';catalog()">
        <span style="font-size:24px">🙈</span><div style="flex:1"><b style="color:#BE185D">${H.length} item${H.length === 1 ? "" : "s"} hidden — ${act}</b>
        <div class="sub" style="margin:0">${Object.entries(why).map(([k, v]) => `${esc(k)} (${v})`).join(" · ")} · customers can't see them</div></div>
        <b style="color:#BE185D">${catF === "missing" ? "Show all" : "Fix now →"}</b></div>`; })()}
    ${COOKED() ? "" : `<div class="box" id="offbox" style="border:1.5px solid #F5C27A;background:#FFF5E6"></div>`}
    <div class="box" id="ct"></div><div class="sub">Items missing photos, pack details or a size chart are hidden from customers until fixed — the PHOTOS column says what to fix.</div>`;
  $$(".fchip").forEach(b => b.onclick = () => { catF = b.dataset.f; catalog(); });
  $("#q").oninput = e => { catQ = e.target.value; drawCat(); };
  drawCat(); if (!COOKED()) loadOffers();
}
// ---- festival offers (update-76): select items → Discount %, or the whole shop; ends by itself ----
let offSel = null, OFF = { items: [], shop: [] };
const offDay = iso => new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });   // "24 Nov"   // offSel = Set of picked item ids while selecting
async function loadOffers() {
  const now = new Date().toISOString();
  const [a, b] = await Promise.all([db.from("item_offers").select("*").eq("shop", S.id).is("ended_at", null).gt("ends", now).order("ends"),
    db.from("shop_offers").select("*").eq("shop", S.id).is("ended_at", null).gt("ends", now).order("ends")]);
  OFF = { items: a.data || [], shop: b.data || [] }; drawOffers(); drawCat();
}
function drawOffers() {
  const el = $("#offbox"); if (!el) return;
  const groups = {}; OFF.items.forEach(o => { const k = o.name + "|" + o.pct + "|" + offDay(o.ends); (groups[k] = groups[k] || []).push(o); });
  const rows = [...OFF.shop.map(o => `<div class="offrow"><span>🏬 Whole shop <b>${o.pct}%</b> · ${esc(o.name)} · ${offDay(o.starts)} → ${offDay(o.ends)}${(o.exclude || []).length ? ` · ${o.exclude.length} left out` : ""}</span><button class="btn ghost sm" onclick="endOffer('shop','${o.id}')">End</button></div>`),
    ...Object.values(groups).map(l => `<div class="offrow"><span>🏷️ ${l.length} item${l.length === 1 ? "" : "s"} <b>${l[0].pct}%</b> · ${esc(l[0].name)} · ${offDay(l[0].starts)} → ${offDay(l[0].ends)}</span><button class="btn ghost sm" onclick="endOffer('item','${l.map(o => o.id).join(",")}')">End</button></div>`)];
  el.innerHTML = `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span style="font-size:24px">🪔</span>
    <div style="flex:1;min-width:200px"><b style="color:#8A4B00">Festival offers</b><div class="sub" style="margin:0">Give a % discount on some items or the whole shop. Customers see the struck price and a badge; it ends by itself.</div></div>
    ${offSel ? `<button class="btn ghost" onclick="offSel=null;drawOffers();drawCat()">Cancel</button><button class="btn pink" ${offSel.size ? "" : "disabled"} onclick="offerForm('items')">Discount % on ${offSel.size} item${offSel.size === 1 ? "" : "s"}</button>`
      : `<button class="btn ghost" onclick="offSel=new Set();drawOffers();drawCat()">☑ Select items</button><button class="btn" style="background:#B45309;color:#fff" onclick="offerForm('shop')">Whole shop</button>`}</div>
    ${rows.length ? `<div style="margin-top:10px;display:grid;gap:6px">${rows.join("")}</div>` : ""}`;
}
function pickOff(id, on) { if (!offSel) return; on ? offSel.add(id) : offSel.delete(id); drawOffers(); }
async function endOffer(kind, ids) {
  for (const id of ids.split(",")) { const { error } = await db.rpc("seller_end_offer", { p_kind: kind, p_id: id }); if (error) return toast(niceErr(error)); }
  toast("Offer ended"); loadOffers();
}
async function offerForm(kind) {
  const d0 = new Date(), ymd = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10), today = ymd(d0);
  const { data: fs } = await db.from("festivals").select("id,name,day,active").gte("day", today).order("day").limit(5);
  const fest = (fs || []).find(f => f.active !== false) || null;
  const from = fest ? [today, ymd(new Date(new Date(fest.day).getTime() - 2 * 864e5))].sort()[1] : today, to = fest ? fest.day : ymd(new Date(d0.getTime() + 3 * 864e5));
  window._offFest = fest?.id || null;
  drawer(`<h2><span>${kind === "items" ? `Discount on ${offSel.size} item${offSel.size === 1 ? "" : "s"}` : "Discount on the whole shop"}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <label class="lbl">Discount % (1–90)</label><input class="in" id="opct" type="number" min="1" max="90" value="10">
    <label class="lbl">Offer name (customers see it)</label><input class="in" id="oname" maxlength="30" value="${esc(fest ? fest.name + " offer" : "Festival offer")}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl">From</label><input class="in" id="ofrom" type="date" min="${today}" value="${from}"></div><div><label class="lbl">Till</label><input class="in" id="oto" type="date" min="${today}" value="${to}"></div></div>
    <div class="sub">Works on each item's price of 7 days ago (or today's if lower) and never goes above MRP. Size options get the same %. ${fest ? `Dates are set for ${esc(fest.name)} (${offDay(fest.day)}).` : ""}</div>
    ${kind === "shop" ? `<label class="lbl">Leave these items out (optional)</label><div style="max-height:220px;overflow:auto;border:1px solid #EEE7F7;border-radius:12px;padding:8px">${D.items.map(i => `<label style="display:flex;gap:8px;align-items:center;padding:3px 0"><input type="checkbox" class="oex" value="${i.id}">${esc(i.name)}</label>`).join("")}</div>` : ""}
    <button class="btn pink" style="width:100%;margin-top:14px" onclick="saveOffer('${kind}')">Save offer</button>`);
}
async function saveOffer(kind) {
  const pct = +$("#opct").value, name = $("#oname").value.trim(), from = $("#ofrom").value, to = $("#oto").value;
  if (!(pct >= 1 && pct <= 90)) return toast("Discount must be 1–90%");
  if (!from || !to || to < from) return toast("Pick the start and end dates");
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const starts = from === today ? new Date().toISOString() : from + "T00:00:00+05:30", ends = to + "T23:59:59+05:30";
  const { error } = kind === "items"
    ? await db.rpc("seller_item_offer", { p_items: [...offSel], p_pct: pct, p_starts: starts, p_ends: ends, p_name: name, p_fest: window._offFest })
    : await db.rpc("seller_shop_offer", { p_pct: pct, p_starts: starts, p_ends: ends, p_name: name, p_exclude: $$(".oex").filter(c => c.checked).map(c => c.value), p_fest: window._offFest });
  if (error) return toast(niceErr(error));
  toast(`Offer saved — customers see it from ${offDay(from)}`); closeDrawer(); offSel = null; loadOffers();
}
function drawCat() {
  const q = catQ.toLowerCase().trim();
  const list = D.items.filter(i => (catF === "all" || (catF === "missing" && hidden(i)) || (catF === "oos" && !i.in_stock) || (catF === "low" && lowI(i)) || (catF.startsWith("g:") && (i.grp || "").trim() === catF.slice(2)))
    && (!q || (i.name + " " + (i.grp || "")).toLowerCase().includes(q)));
  const fei = i => hidden(i) ? `<span class="pill bad" title="Hidden from customers">${esc(i.hidden_reason || "Add photos")}</span>` + (i.hidden_reason === "Add size chart" && (D.charts || []).length
      ? `<br><select class="in" style="margin-top:4px;padding:4px 8px;font-size:12px;width:auto" onchange="if(this.value)setChart('${i.id}',this.value)"><option value="">📏 Pick size chart…</option>${(D.charts || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>` : "")
    : i.photos && Object.keys(i.photos).length ? Object.keys(i.photos).filter(k => i.photos[k]).map(k => `<span class="pill ok" style="padding:2px 6px;margin-right:2px" title="${esc(k)}">${esc(SLOT_ABBR[k] || k.replace(/^c-/, ""))}</span>`).join("")
    : `<span class="pill ok" style="padding:2px 6px">${photos(i).length}</span>`;
  $("#ct").innerHTML = list.length ? `<table><thead><tr><th>ITEM</th><th class="hm">CATEGORY</th><th class="hm">UNIT</th><th class="hm">MRP</th><th>YOUR PRICE</th><th>PHOTOS</th><th>IN STOCK</th><th class="hm">RETURN</th><th></th></tr></thead><tbody>${list.map(i => `<tr>
    <td><div style="display:flex;align-items:center;gap:10px">${offSel ? `<input type="checkbox" ${offSel.has(i.id) ? "checked" : ""} onchange="pickOff('${i.id}',this.checked)" style="width:18px;height:18px">` : ""}${photos(i)[0] ? `<img src="${esc(thumbUrl(photos(i)[0]))}" onerror="this.onerror=null;this.src='${esc(photos(i)[0])}'" style="width:40px;height:40px;border-radius:10px;object-fit:cover;background:#F6F2FB" loading="lazy">` : `<span style="width:40px;height:40px;border-radius:10px;background:#F6F2FB;display:inline-flex;align-items:center;justify-content:center">📦</span>`}<div><b>${esc(i.name)}</b>${(o => o ? `<div style="color:#B45309;font-weight:700;font-size:11.5px">🪔 ${o.pct}% · ${esc(o.name)}</div>` : "")(OFF.items.find(o => o.item === i.id))}</div></div></td>
    <td class="hm">${esc(i.grp || "—")}</td><td class="hm">${esc(i.unit || (i.variants || []).map(v => v.n).join(", ") || "—")}</td>
    <td class="hm">${i.mrp ? `<s style="color:#8E84A8">${inr(i.mrp)}</s>` : "—"}</td><td><b>${(i.variants || []).length ? i.variants.map(v => `${esc(v.n)} ${inr(v.p)}`).join("<br>") : inr(i.price)}</b></td>
    <td style="white-space:nowrap">${fei(i)}</td><td style="white-space:nowrap"><button class="tog ${i.in_stock ? "on" : ""}" onclick="stock('${i.id}',${!i.in_stock})" aria-label="In stock"></button>${i.stock_qty != null ? (lowI(i) && i.in_stock ? `<div style="margin:3px 0 0"><span style="display:inline-block;background:#FFEDD5;color:#C2410C;font-weight:700;font-size:11px;border-radius:20px;padding:1px 8px">${i.stock_qty} left</span></div>` : `<div class="sub" style="margin:2px 0 0;font-size:11.5px">${i.stock_qty} left</div>`) : ""}</td>
    <td class="hm">${retLabel(i)}</td><td><button class="edit" onclick="editItem('${i.id}')">Edit</button></td></tr>`).join("")}</tbody></table>`
    : `<div class="sub" style="padding:18px 0">${D.items.length ? "No items match." : "No items yet. Add one, or upload your whole catalogue from Excel."}</div>`;
}
async function setChart(id, chart) {
  const { error } = await db.from("items").update({ size_chart: chart }).eq("id", id);
  if (error) return toast(niceErr(error));
  toast("Size chart linked"); await loadAll(); catalog();
}
async function stock(id, on) {
  const i = D.items.find(x => x.id === id); i.in_stock = on; drawCat();
  const patch = { in_stock: on }; if (on && i.stock_qty === 0) { patch.stock_qty = null; i.stock_qty = null; }   // switched on by hand at 0: stop counting
  const { error } = await db.from("items").update(patch).eq("id", id);
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
  const K = KIND();
  F_ = { id, item: i, ph: {}, slots: null, needsBis: K.bis, pol: i ? (i.ret_policy === "replace" ? 1 : i.ret_policy === "return" ? 2 : 0) : 0, stock: i ? i.in_stock : true,
    packaged: i && i.packaged != null ? !!i.packaged : !!K.packaged && !["food_fresh", "flowers", "food_cooked"].includes(K.key), courier: !!i?.courier_ok, sealed: !!i?.sealed, chart: i?.size_chart || null };
  if (i && i.photos && Object.keys(i.photos).length) Object.entries(i.photos).forEach(([k, u]) => { if (u) F_.ph[k] = { url: u }; });
  else if (i) F_.oldPhotos = photos(i);   // old item: put its plain photo list into the slots in order
  if (window.PhotoClean) PhotoClean.warm();
  const groups = [...new Set(D.items.map(x => (x.grp || "").trim()).filter(Boolean))].sort();
  drawer(`<h2><span>${i ? "Edit item" : "Add item"}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <div style="display:flex;align-items:center"><b>Item photos</b><span class="sub" style="margin:0 0 0 6px" id="phc"></span><span class="sp" style="flex:1"></span><a href="/help/photo-guide/" target="_blank" style="font-size:12.5px;color:#7C3AED;font-weight:600">📷 Photo guide</a></div>
    <div id="phs" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px;margin-top:8px"></div><div id="phn"></div>
    <label>ITEM NAME</label><input class="in" id="fn" value="${esc(i?.name || "")}" placeholder="e.g. Aashirvaad Whole Wheat Atta" autocomplete="off"><div id="msug"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>CATEGORY</label><input class="in" id="fg" list="grps" value="${esc(i?.grp || "")}" placeholder="Atta &amp; Rice"><datalist id="grps">${[...new Set([...(CATM[S.type] || Object.values(CATM).flat()), ...groups])].map(g => `<option value="${esc(g)}">`).join("")}</datalist></div>
      <div><label>${amountLabel(S.type)}</label><div style="display:flex;gap:6px"><input class="in" id="fq" inputmode="decimal" style="flex:1;min-width:0" value="${esc(splitUnit(i?.unit)[0])}" placeholder="1">
        <select class="in" id="fuu" style="flex:1;min-width:0">${(() => { const cu = splitUnit(i?.unit)[1] || unitsFor(S.type)[0]; return [...new Set([...unitsFor(S.type), ...(i ? [cu] : [])])].map(u => `<option ${u === cu ? "selected" : ""}>${esc(u)}</option>`).join(""); })()}</select></div>
        <input type="hidden" id="fu" value="${esc(i?.unit || "")}"></div>
      <div><label>MRP ₹</label><input class="in" id="fm" inputmode="decimal" value="${numTxt(i?.mrp)}"></div><div><label>YOUR PRICE ₹${S.gst_billing ? " (incl. GST)" : ""}</label><input class="in" id="fp" inputmode="decimal" value="${numTxt(i?.price)}"></div></div>
    <div id="off"></div>
    ${!["food_fresh", "flowers"].includes(K.key) ? `<div class="row" style="border:1px solid #EEE7F6;border-radius:16px;padding:12px 14px;margin-top:12px"><div><b>Packaged item</b><span>Maker, net qty, MRP and country of origin are shown to customers</span></div><button class="tog ${F_.packaged ? "on" : ""}" id="fpk"></button></div>
    <div id="pkbox" style="display:${F_.packaged ? "block" : "none"}">
      <div style="display:grid;grid-template-columns:1fr;gap:10px"><div><label>MANUFACTURER / PACKER / IMPORTER *</label><input class="in" id="fmk" value="${esc(i?.maker || "")}" placeholder="Name, as on the pack"></div>
        <div></div></div>
      ${SPEC_LIVE ? `<label>THEIR FULL ADDRESS WITH PIN *</label><input class="in" id="fma" maxlength="300" value="${esc(i?.maker_address || "")}" placeholder="As on the pack — building, street, city, PIN">
      <label>CONSUMER CARE PHONE / EMAIL *</label><input class="in" id="fcc" maxlength="120" value="${esc(i?.consumer_care || "")}" placeholder="As on the pack, e.g. 1800-123-4567 or care@brand.com">` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label>COUNTRY OF ORIGIN</label><input class="in" id="fco" value="${esc(i?.country_of_origin || "India")}" title="Not India → the item shows as Imported"></div>
        ${K.food ? `<div><label>FSSAI (ON PACK) *</label><input class="in" id="ffs" inputmode="numeric" maxlength="14" value="${esc(i?.fssai || "")}" placeholder="14 digits"></div>` : "<div></div>"}</div>
      ${K.food ? `<label>INGREDIENTS (OPTIONAL)</label><input class="in" id="fin" value="${esc(i?.ingredients || "")}">` : ""}
      <div class="sub" style="font-size:12px;margin:6px 0 0">Every declaration on the pack is shown to customers (Legal Metrology rules). A country other than India shows the item as <b>Imported</b>.</div></div>` : ""}
    ${specBox(i)}
    ${!K.food && K.key !== "flowers" ? `<div id="biswrap" style="display:none"><label>BIS / ISI / R-NUMBER (ON THE BOX OR LABEL) <span id="bisreq"></span></label><input class="in" id="fbis" value="${esc(i?.bis_no || "")}" maxlength="20" placeholder="e.g. CM/L-1234567 or R-41012345" style="text-transform:uppercase"></div>` : ""}
    ${["garments", "footwear"].includes(S.type) ? `<label>📏 SIZE CHART</label>
      <div style="display:flex;gap:8px"><select class="in" id="fch" style="flex:1"><option value="">Standard — picked automatically</option>
        <optgroup label="Gali Bazaar standard">${(D.charts || []).filter(c => !c.shop).map(c => `<option value="${c.id}" ${c.id === F_.chart && i?.size_chart_auto === false ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</optgroup>
        ${(D.charts || []).some(c => c.shop) ? `<optgroup label="My own charts">${(D.charts || []).filter(c => c.shop).map(c => `<option value="${c.id}" ${c.id === F_.chart ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</optgroup>` : ""}</select>
      <button class="btn ghost" type="button" onclick="go('catalog/charts')">My own chart</button></div><div id="chw"></div>` : ""}
    <label style="margin-top:14px;font-size:13px;letter-spacing:0;color:#1D0F30;text-transform:none">Return / replacement</label>
    ${RET().max === 0 ? `<div class="note" id="pol" style="margin:4px 0 8px">At door only — fresh and cooked food can be returned only at the door.</div>` : `
    <div class="fchips" id="pol" style="background:#F6F2FB;border-radius:14px;padding:4px;gap:4px">${["At door only", "Replacement"].concat(RET().refund ? ["Return & refund"] : []).map((l, k) => `<button class="fchip" style="flex:1;border:0" data-k="${k}">${l}</button>`).join("")}</div>
    ${RET().refund ? "" : `<div class="sub" style="font-size:12px;margin-top:4px">Replacement only for damaged or expired packs.</div>`}`}
    <div id="dw" style="display:none"><label>WITHIN HOW MANY DAYS OF DELIVERY? (1–${RET().max || 30})</label><input class="in" id="fd" inputmode="numeric" value="${Math.min(i?.ret_days || 7, RET().max || 30)}"></div>
    ${RET().max === 0 || KIND().food ? "" : `<label>WARRANTY IN MONTHS (OPTIONAL)</label><input class="in" id="fwm" inputmode="numeric" maxlength="3" value="${i?.warranty_months || ""}" placeholder="e.g. 12 for 1 year" oninput="this.value=this.value.replace(/\\D/g,'')">
    <div class="sub" style="font-size:12px;margin:4px 0 8px">Your shop's own warranty, from the delivery date. Customers see it on the item and the bill. While any sold item is under warranty, Gali Bazaar checks with you before your shop can be deleted.</div>`}
    ${COURIER_SHOP() ? (K.courier === "never" ? `<div class="note" style="margin-top:10px">Fresh items: local delivery only.</div>` : `<div class="row" style="border:1.5px solid ${F_.courier ? "#6A1BB0" : "#EEE7F6"};border-radius:16px;padding:12px 14px;margin-top:10px" id="crow"><div><b>📦 Can go by courier</b><span>${K.courier === "sealed" ? "Only sealed packets that last at least 1 month (namkeen, biscuits, soan papdi…)." : "Customers in your courier area can order it"}</span></div><button class="tog ${F_.courier ? "on" : ""}" id="fcr"></button></div>
      ${K.courier === "sealed" ? `<div id="sealbox" style="display:${F_.courier ? "grid" : "none"};grid-template-columns:1fr 1fr;gap:10px;align-items:end"><label style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:13.5px;letter-spacing:0;color:#1D0F30"><input type="checkbox" id="fsl" ${F_.sealed ? "checked" : ""}> Sealed pack</label>
        <div><label>SHELF LIFE (MONTHS) *</label><input class="in" id="fsh" inputmode="numeric" maxlength="2" value="${i?.shelf_life_months ?? ""}"></div></div>` : ""}`) : ""}
    <label>STOCK — HOW MANY YOU HAVE (OPTIONAL)</label><input class="in" id="fsq" inputmode="numeric" maxlength="5" value="${i?.stock_qty ?? ""}" placeholder="${S.type === "footwear" ? "e.g. 100 (pairs)" : "e.g. 100"}" oninput="this.value=this.value.replace(/\\D/g,'');if(this.value!=='')$('#fs').classList.toggle('on',+this.value>0)">
    <div class="sub" style="font-size:12px;margin:4px 0 8px">Goes down with each order; comes back on a cancel or when you check in returned items. You get an alert at 5 or fewer. At 0 the item shows "Out of stock" by itself. Leave empty to use only the switch.</div>
    <div class="row" style="border:1px solid #EEE7F6;border-radius:16px;padding:12px 14px"><div><b>In stock</b><span>On = customers can order • Off = out of stock (hidden)</span></div><button class="tog ${F_.stock ? "on" : ""}" id="fs"></button></div>
    <details style="margin-top:10px" ${(i && (i.descr || i.gst_rate || (i.variants || []).length)) || (specSets(S.type)[0] === "general") ? "open" : ""}><summary class="sub" style="cursor:pointer">More: product details${S.gst_billing ? ", GST %" : ""}, multiple sizes</summary>
      <label>${specSets(S.type).length === 0 ? "PRODUCT DETAILS (OPTIONAL)" : (specSets(S.type).includes("general") && specSets(S.type).length === 1) ? "PRODUCT DETAILS * (AT LEAST 20 LETTERS)" : "MORE DETAILS (OPTIONAL)"}</label><textarea class="in" id="fx" rows="3" placeholder="What it is, size, material, how to use">${esc(i?.descr || "")}</textarea>
      ${S.gst_billing ? `<label>GST %</label><select class="in" id="fgst">${["", 0, 5, 12, 18, 28, 40].map(v => `<option value="${v}" ${String(i?.gst_rate ?? "") === String(v) ? "selected" : ""}>${v === "" ? "—" : v + "%"}</option>`).join("")}</select>
        <label>HSN CODE (OPTIONAL — printed on the tax invoice)</label><input class="in" id="fh" inputmode="numeric" maxlength="8" value="${esc(i?.hsn || "")}" placeholder="e.g. 11010000">` : ""}
      <label>SIZES (OPTIONAL) — e.g. Half=140; Full=260</label><input class="in" id="fv" value="${esc((i?.variants || []).map(v => `${v.n}=${numTxt(v.p)}`).join("; "))}" placeholder="250g=12; 500g=22; 1kg=40"></details>
    <div class="msg" id="fe"></div>
    <button class="btn pink full" id="fsave" style="margin-top:10px;padding:15px">Save item</button>
    ${i ? `<button class="btn ghost full" style="margin-top:8px;color:#BE185D" onclick="delItem('${i.id}')">Delete item</button>` : ""}`);
  drawPhotos(); paintPol(); loadSlots();
  $("#fn").addEventListener("input", () => { clearTimeout(F_.st); F_.st = setTimeout(loadSlots, 500); });
  if ($("#fpk")) $("#fpk").onclick = () => { F_.packaged = !F_.packaged; $("#fpk").classList.toggle("on", F_.packaged); $("#pkbox").style.display = F_.packaged ? "block" : "none"; loadSlots(); };
  if ($("#fcr")) $("#fcr").onclick = () => { F_.courier = !F_.courier; $("#fcr").classList.toggle("on", F_.courier); $("#crow").style.borderColor = F_.courier ? "#6A1BB0" : "#EEE7F6"; if ($("#sealbox")) $("#sealbox").style.display = F_.courier ? "grid" : "none"; };
  if ($("#fch")) { const chk = async () => { const sz = $("#fv").value.split(";").map(x => x.split("=")[0].trim()).filter(Boolean);
      let id = $("#fch").value, auto = false;
      if (!id && sz.length > 1) { const { data } = await db.rpc("pick_size_chart", { p_type: S.type, p_name: $("#fn").value, p_grp: $("#fg").value, p_sizes: sz }); id = data || ""; auto = true; }
      const c = (D.charts || []).find(x => x.id === id), no = c ? sz.filter(z => !(c.rows || []).some(r => String(r.size).toLowerCase().replace(/^uk\s*/, "") === z.toLowerCase().replace(/^uk\s*/, ""))) : [];
      $("#chw").innerHTML = c && auto ? `<div class="okline">📏 Size chart: ${esc(c.name)} ✓ <span class="sub" style="margin:0">— picked automatically</span></div>` : "";
      $("#chw").innerHTML += no.length ? `<div class="sub" style="color:#B45309">⚠ No row for ${esc(no.join(", "))} in this chart</div>` : !c && sz.length > 1 ? `<div class="sub" style="color:#BE185D">No standard chart fits these sizes — pick one above, or the item stays hidden.</div>` : ""; };
    $("#fch").onchange = chk; $("#fv").addEventListener("input", chk); $("#fn").addEventListener("input", () => { clearTimeout(F_.ct); F_.ct = setTimeout(chk, 500); }); chk(); }
  const syncU = () => { const q = $("#fq").value.trim(); $("#fu").value = q ? q + " " + $("#fuu").value : ($("#fu").value && !splitUnit($("#fu").value)[0] ? $("#fu").value : ""); };
  $("#fq").addEventListener("input", syncU); $("#fuu").addEventListener("change", syncU);
  // suggestions from the Gali Bazaar item list (new items): pick → name, pack, group, HSN, photos, pack details
  if (!i) { let tmr = null; $("#fn").addEventListener("input", () => { clearTimeout(tmr); const q = $("#fn").value.trim(); if (q.length < 3) { $("#msug").innerHTML = ""; return; }
    tmr = setTimeout(async () => {
      let qq = db.from("common_items").select("*"); q.split(/\s+/).filter(w => w.length >= 2).slice(0, 3).forEach(w => qq = qq.ilike("name", `%${w.replace(/[%_]/g, "")}%`));
      const { data } = await qq.order("uses", { ascending: false }).limit(6); window._ms = data || [];
      $("#msug").innerHTML = _ms.length ? `<div style="border:1px solid #EEE7F6;border-radius:12px;margin-top:6px;overflow:hidden"><div class="sub" style="padding:6px 10px">Gali Bazaar item list — tap to use</div>${_ms.map((c, k) =>
        `<div onclick="useMaster(${k})" style="display:flex;align-items:center;gap:10px;padding:7px 10px;cursor:pointer;border-top:1px solid #F4EFF9">${c.images && c.images[0] ? `<img src="${esc(thumbUrl(c.images[0]))}" onerror="this.onerror=null;this.src='${esc(c.images[0])}'" style="width:34px;height:34px;border-radius:8px;object-fit:cover">` : `<span style="width:34px;height:34px;border-radius:8px;background:#F6F2FB"></span>`}
        <div style="flex:1"><b style="font-size:13px">${esc(c.name)}</b><div class="sub" style="margin:0">${esc([c.unit, c.grp, c.images && c.images.length ? "" : "no photo yet"].filter(Boolean).join(" · "))}</div></div><b style="color:#7C3AED;font-size:12.5px">Use</b></div>`).join("")}</div>` : "";
    }, 300); }); }
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
function useMaster(k) {
  const c = (window._ms || [])[k]; if (!c) return;
  $("#fn").value = c.name; $("#fu").value = c.unit || ""; { const [q, u] = splitUnit(c.unit); $("#fq").value = q; if (u) { if (![...$("#fuu").options].some(o => o.value === u)) $("#fuu").add(new Option(u)); $("#fuu").value = u; } } if (c.grp) $("#fg").value = c.grp;
  if (S.gst_billing && $("#fh") && c.hsn) { $("#fh").value = c.hsn; if (c.gst_rate != null) $("#fgst").value = String(c.gst_rate); }
  if ($("#fmk") && c.maker) $("#fmk").value = c.maker; if ($("#ffs") && c.fssai) $("#ffs").value = c.fssai; if ($("#fin") && c.ingredients) $("#fin").value = c.ingredients;
  // pack declarations from the item list (update-65)
  if ($("#fma") && c.maker_address) $("#fma").value = c.maker_address; if ($("#fcc") && c.consumer_care) $("#fcc").value = c.consumer_care;
  if ($("#fco") && c.country_of_origin) $("#fco").value = c.country_of_origin;
  (c.images || []).forEach((u, j) => { const sl = (F_.slots || localSlots().slots)[j]; if (sl) F_.ph[sl.key] = { url: u }; });
  $("#msug").innerHTML = `<div class="okline">Details taken from the Gali Bazaar item list${(c.images || []).length ? "" : " — add the photos"}. Set your price.</div>`; drawPhotos();
}
function paintPol() { const R = RET(); if (R.max === 0) F_.pol = 0; else if (F_.pol === 2 && !R.refund) F_.pol = 1; $$("#pol .fchip").forEach(b => { const on = +b.dataset.k === F_.pol; b.classList.toggle("on", on); }); $("#dw").style.display = F_.pol ? "block" : "none"; }
function offLine() { const m = +$("#fm").value, p = +$("#fp").value; $("#off").innerHTML = m > p && p > 0 ? `<div class="okline">⚡ ${Math.round((m - p) / m * 100)}% off shown to customers automatically</div>` : ""; }
// photos needed: grocery = front + back label, fruits & veg = 2, food / sweets / stationery = 1
// category master per shop type + unit master (same lists as the app)
const CATM = { grocery: ["Atta & flours", "Rice", "Dal & pulses", "Oil & ghee", "Sugar, salt & jaggery", "Masala & spices", "Dairy", "Eggs & bread", "Tea & coffee", "Health drinks", "Breakfast", "Noodles & pasta", "Biscuits", "Snacks & namkeen", "Chocolates & sweets", "Sauces & spreads", "Pickles", "Dry fruits", "Cold drinks & juices", "Instant food", "Baby care", "Personal care", "Detergent & cleaning", "Household", "Puja"],
  fruitveg: ["Fruits", "Vegetables", "Leafy greens", "Herbs & seasoning", "Exotic", "Cut & sprouts"], sweets: ["Mithai", "Bengali sweets", "Dry fruit sweets", "Namkeen", "Bakery", "Cakes", "Gift boxes"],
  food: ["Chaat", "Snacks", "Main course", "Roti & paratha", "Rice & biryani", "Thali", "Chinese", "South Indian", "Rolls & momos", "Pizza & burger", "Drinks", "Desserts"],
  stationery: ["Notebooks & registers", "Pens & pencils", "Art & craft", "Paper & files", "Office supplies", "Exam essentials", "School bags & boxes", "Gifts & toys"] };
const UNITS = ["kg", "g", "L", "ml", "pc", "pack", "packet", "dozen", "box", "bottle", "jar", "pouch", "bunch", "plate", "pair", "set", "ream", "m"];
// only real measures or counts that fit this kind of shop (same as the app)
function unitsFor(t) {
  const k = KIND().key;
  return t === "footwear" ? ["pair", "set", "nos"] : t === "garments" ? ["pc", "nos", "set", "pair"] : t === "stationery" ? ["pc", "nos", "set", "ream", "m", "g", "kg"]
    : t === "fruitveg" || k === "food_fresh" ? ["kg", "g", "L", "ml", "pc", "dozen", "bunch"] : k === "food_cooked" ? ["kg", "g", "L", "ml", "pc", "plate"]
    : k === "food_packed" ? ["kg", "g", "L", "ml", "pc", "dozen"] : ["pc", "nos", "set", "pair", "kg", "g", "L", "ml", "m"];
}
// always "Qty": a number, with the unit (kg, g, L, pair, set, nos…) picked next to it
const amountLabel = t => "QTY";
const splitUnit = u => { const m = String(u || "").match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z].*)?$/); return m ? [m[1], (m[2] || "").trim()] : ["", String(u || "").trim()]; };
const NEED = () => S.type === "grocery" ? 3 : S.type === "fruitveg" ? 2 : 1;
const PHL = () => S.type === "grocery" ? ["1. Front", "2. Maker / FSSAI", "3. Ingredients"] : NEED() === 2 ? ["1. Photo", "2. Photo"] : ["Photo"];
const normN = s => String(s || "").trim().replace(/\s+/g, " ").toLowerCase(), normU = s => String(s || "").replace(/\s+/g, "").toLowerCase();
// Gali Bazaar item list (common_items): rows matching these names, grouped by name
async function masterFind(names) {
  const out = {}, list = [...new Set(names.map(normN))].filter(n => n && !/[%_,()]/.test(n));
  for (let i = 0; i < list.length; i += 60) {
    const { data } = await db.from("common_items").select("*").or(list.slice(i, i + 60).map(n => `name.ilike.${n}`).join(",")).limit(1000);
    (data || []).forEach(c => (out[normN(c.name)] = out[normN(c.name)] || []).push(c));
  }
  return out;
}
// named photo slots from the server (item_photo_slots); offline → a simple local list (server still checks on save)
function localSlots() {
  const K = KIND(), pk = F_.packaged, sl = (...a) => a.map(([key, label, req]) => ({ key, label, req, hint: "" }));
  return { slots: S.type === "fruitveg" ? sl(["front", "Whole", 1], ["cut", "Close-up / cut", 1])
    : S.type === "garments" ? sl(["front", "Front", 1], ["back", "Back", 1], ["tag", "Size / brand tag", 1], ["more", "Fabric close-up", 0])
    : S.type === "footwear" ? sl(["side", "Side", 1], ["top", "Top (pair)", 1], ["sole", "Sole", 1], ["label", "Box label", pk ? 1 : 0])
    : K.key === "bis_goods" ? sl(["front", "Product", 1], ["label", "Box / label with MRP", 1], ["bis", "BIS / ISI mark", 1])
    : K.food && pk ? sl(["front", "Front — name & brand", 1], ["label", "Back label — maker, MRP, FSSAI", 1], ["ingredients", "Ingredients", 1])
    : K.food || K.key === "flowers" ? sl(["front", "Photo", 1], ["more", "Close-up", 0])
    : pk ? sl(["front", "Front", 1], ["label", "Label with MRP / maker", 1]) : sl(["front", "Front", 1], ["more", "Another side", 0]), needs_bis: !!K.bis };
}
async function loadSlots() {
  if (!F_ || !$("#phs")) return;
  const { data, error } = await db.rpc("item_photo_slots", { p_category: S.type, p_packaged: F_.packaged, p_name: $("#fn")?.value.trim() || "" });
  if (!F_) return;
  const d = !error && data && data.slots ? data : localSlots();
  F_.slots = d.slots; F_.needsBis = !!d.needs_bis;
  if (F_.oldPhotos) { F_.oldPhotos.forEach((u, j) => { const sl = F_.slots[j]; if (sl) F_.ph[sl.key] = { url: u }; }); F_.oldPhotos = null; }
  if ($("#bisreq")) $("#bisreq").innerHTML = `<b style="color:#EF287B">* required</b>`;
  if ($("#biswrap")) $("#biswrap").style.display = F_.needsBis ? "block" : "none";   // only goods that legally need the BIS / ISI mark
  drawPhotos();
}
const foodLoose = () => { const K = KIND(); return (K.key === "food_cooked" && !F_.packaged) || S.type === "fruitveg" || K.key === "food_fresh"; };
async function cleanSlot(key, file) {
  if (!file || !/^image\//.test(file.type)) return;
  if (file.size > 10 * 1024 * 1024) return toast("Photo is bigger than 10 MB");
  F_.ph[key] = { busy: true }; drawPhotos();
  try { const r = await PhotoClean.clean(file, key, foodLoose()); if (F_) F_.ph[key] = { res: r, orig: false }; }
  catch (e) { console.warn(e); if (F_) F_.ph[key] = { err: "Couldn't read this photo — try another" }; }
  drawPhotos();
}
function drawPhotos() {
  if (!F_ || !$("#phs")) return;
  const sl = F_.slots || localSlots().slots, ready = v => v && (v.url || v.res);
  const req = sl.filter(x => x.req).length;
  $("#phc").textContent = `• ${esc((D.cats || []).find(c => c.key === S.type)?.name || "Item")}${F_.packaged ? " · packed" : ""} · ${req} required`;
  $("#phs").innerHTML = sl.map((d, k) => { const v = F_.ph[d.key], src = v?.res ? (v.orig && v.res.originalPreview ? v.res.originalPreview : v.res.preview) : v?.url;
    return `<div><div class="drop" data-k="${d.key}" title="${esc(d.hint || d.label)}" style="height:104px;border-radius:16px;border:${ready(v) ? "1.5px solid #34C77B" : d.req ? "1.5px dashed #EF4444" : "1px solid #EEE7F6"};background:${ready(v) ? "#fff" : "#FFF7FA"};display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;position:relative">
      ${v?.busy ? `<span class="sub" style="margin:0">Cleaning…</span>` : src ? `<img src="${esc(src)}" style="width:100%;height:100%;object-fit:cover"><button onclick="event.stopPropagation();delete F_.ph['${d.key}'];drawPhotos()" style="position:absolute;top:4px;right:4px;border:0;border-radius:50%;width:22px;height:22px;background:#fff;cursor:pointer">×</button>`
        : `<span style="color:#EF287B;font-size:12px;font-weight:600;text-align:center">＋<br>Drop or browse</span>${d.req ? `<i style="position:absolute;top:7px;right:7px;width:8px;height:8px;border-radius:50%;background:#EF4444"></i>` : ""}`}</div>
      <div style="font-size:12px;font-weight:600;margin-top:4px">${k + 1}. ${esc(d.label)}${ready(v) ? " ✓" : d.req ? ' <span style="color:#EF287B">*</span>' : ' <span class="sub" style="margin:0">(optional)</span>'}</div></div>`; }).join("");
  $("#phn").innerHTML = sl.map(d => { const v = F_.ph[d.key]; if (!v) return "";
    return (v.res?.removed ? `<div class="sub" style="margin:4px 0 0">${esc(d.label)}: ${v.orig ? "original photo" : "background removed ✓"} · <a href="#" onclick="F_.ph['${d.key}'].orig=!F_.ph['${d.key}'].orig;drawPhotos();return false" style="color:#7C3AED">${v.orig ? "Use cleaned" : "Use original"}</a></div>` : "")
      + (v.res?.warnings || []).map(w => `<div class="sub" style="margin:2px 0 0;color:#B45309">⚠ ${esc(d.label)}: ${esc(w)}</div>`).join("")
      + (v.err ? `<div class="sub" style="color:#BE185D">${esc(d.label)}: ${esc(v.err)}</div>` : ""); }).join("")
    + `<div class="sub" style="margin-top:6px">Use your own clear photos of the real item. Product photos get a clean white background automatically.</div>`;
  $$("#phs .drop").forEach(el => {
    const key = el.dataset.k;
    el.onclick = () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => cleanSlot(key, inp.files[0]); inp.click(); };
    el.ondragover = e => { e.preventDefault(); el.style.background = "#F3EDFF"; }; el.ondragleave = () => drawPhotos();
    el.ondrop = e => { e.preventDefault(); const fs = [...e.dataTransfer.files].filter(f => /^image\//.test(f.type)); const i0 = sl.findIndex(x => x.key === key); fs.forEach((f, j) => { const t = sl[i0 + j]; if (t) cleanSlot(t.key, f); }); };
  });
  const miss = sl.filter(d => d.req && !ready(F_.ph[d.key])).map(d => d.label.split(" —")[0].split(" /")[0].toLowerCase()), busy = sl.some(d => F_.ph[d.key]?.busy), b = $("#fsave");
  if (b) { b.disabled = miss.length > 0 || busy; b.textContent = busy ? "Cleaning photos…" : miss.length ? `Add ${miss.join(", ")} photo to save` : "Save item"; b.style.opacity = b.disabled ? .5 : 1; }
}
async function saveItem() {
  const e = $("#fe"), name = $("#fn").value.trim(), grp = $("#fg").value.trim(), desc = $("#fx").value.trim(), K = KIND();
  const vs = $("#fv").value.split(";").map(x => x.split("=")).filter(kv => kv.length === 2 && kv[0].trim()).map(([n, p]) => ({ n: n.trim(), p: +p.trim() || 0 }));
  const price = +$("#fp").value || (vs.length ? Math.min(...vs.map(v => v.p)) : 0), days = Math.max(0, Math.min(RET().max, +$("#fd").value || 0));
  if (RET().max === 0) F_.pol = 0; else if (F_.pol === 2 && !RET().refund) F_.pol = 1;
  const pk = F_.packaged && !["food_fresh", "flowers"].includes(K.key), val = id => ($(id)?.value || "").trim();
  if ($("#specbox")) specRead();
  const bis = val("#fbis").toUpperCase(), fssai = val("#ffs").replace(/\D/g, ""), shelf = parseInt(val("#fsh"), 10);
  const sl = F_.slots || localSlots().slots, miss = sl.filter(d => d.req && !(F_.ph[d.key]?.url || F_.ph[d.key]?.res));
  const err = !name ? "Enter the item name" : banWord(name, grp, desc) ? "Tobacco, cigarettes and alcohol can't be sold on Gali Bazaar." : miss.length ? `Add ${miss.map(d => d.label.toLowerCase()).join(", ")} photo`
    : vs.some(v => v.p <= 0) ? "Every size needs a price above ₹0" : price <= 0 ? "Price must be above ₹0"
    : pk && !val("#fmk") ? "Packaged item: add the manufacturer / packer / importer name"
    : SPEC_LIVE && pk && !(val("#fma").length >= 15 && /(^|[^0-9])[1-9][0-9]{5}([^0-9]|$)/.test(val("#fma"))) ? "Packaged item: add the full address of the manufacturer / packer / importer, with the 6-digit PIN code"
    : SPEC_LIVE && pk && !(val("#fcc").replace(/\D/g, "").length >= 10 || /[^@\s]+@[^@\s]+\.[a-z]{2,}/i.test(val("#fcc"))) ? "Packaged item: add the consumer care phone number or email printed on the pack"
    : specErr(desc) ? specErr(desc) : !vs.length && !(+val("#fq") > 0) ? `Add ${amountLabel(S.type).toLowerCase()} — a number, e.g. ${S.type === "footwear" ? "1 (pair)" : "500 (g)"}`
    : pk && !(+$("#fm").value > 0) && !vs.length ? "Packaged item: add the MRP" : pk && K.food && !/^[12][0-9]{13}$/.test(fssai) ? "Packaged food: add the 14-digit FSSAI number printed on the pack"
    : F_.needsBis && !bis ? "Add the BIS / ISI / R-number printed on the product" : bis && !/^[A-Z0-9/ .-]{6,20}$/.test(bis) ? "BIS / ISI / R-number: 6–20 letters or numbers, e.g. CM/L-1234567"
    : F_.courier && K.courier === "sealed" && !($("#fsl")?.checked && shelf >= 1) ? "Food by courier: only sealed packs that last at least 1 month" : null;
  if (err) { e.className = "msg err"; e.textContent = err; return; }
  const b = $("#fsave"); b.disabled = true; b.textContent = "Saving…";
  try {
    const map = {};
    for (const d of sl) { const v = F_.ph[d.key]; if (!v) continue;
      if (v.res) map[d.key] = await PhotoClean.upload(db, me.id, v.orig && v.res.original ? v.res.original : v.res.big, v.orig && v.res.originalThumb ? v.res.originalThumb : v.res.thumb);
      else if (v.url) map[d.key] = v.url; }
    const imgs = Object.values(map);
    const row = { shop: S.id, name, price, unit: vs.length ? "" : $("#fu").value.trim(), in_stock: F_.stock, mrp: +$("#fm").value || null, grp: grp || null, descr: desc || null,
      img_url: imgs[0] || null, images: imgs, photos: map, variants: vs, ret_policy: F_.pol === 0 || days === 0 ? "none" : F_.pol === 1 ? "replace" : "return", ret_days: F_.pol === 0 ? 0 : days,
      // warranty (update-64): only sent once the column exists, so saving never breaks before the SQL is run
      ...((D.items.some(x => "warranty_months" in x) || +(val("#fwm") || 0)) ? { warranty_months: Math.min(120, +(val("#fwm") || 0) || 0) } : {}),
      packaged: pk, maker: val("#fmk") || null, stock_qty: val("#fsq") === "" ? null : +val("#fsq"), net_qty: pk && !vs.length ? (val("#fq") + " " + ($("#fuu")?.value || "")).trim() : null, country_of_origin: pk ? val("#fco") || "India" : null, bis_no: bis || null,
      ...(SPEC_LIVE ? { maker_address: pk ? val("#fma") || null : null, consumer_care: pk ? val("#fcc") || null : null } : {}),
      ...(SPEC_LIVE && specSets(S.type).length ? { spec_set: F_.specSet, specs: Object.fromEntries((SPEC.sets[F_.specSet]?.fields || []).map(f => [f.k, (F_.specs[f.k] || "").trim()]).filter(([, v]) => v)) } : {}),
      courier_ok: !!F_.courier && K.courier !== "never", sealed: !!$("#fsl")?.checked, shelf_life_months: isNaN(shelf) ? null : shelf };
    if (K.food) { row.fssai = fssai || null; row.ingredients = val("#fin") || null; }
    if ($("#fch")) row.size_chart = $("#fch").value || null;
    if (S.gst_billing && $("#fgst")) row.gst_rate = $("#fgst").value === "" ? null : +$("#fgst").value;
    if (S.gst_billing && $("#fh")) row.hsn = $("#fh").value.replace(/\D/g, "") || null;
    const r = F_.id ? await db.from("items").update(row).eq("id", F_.id) : await db.from("items").insert(row);
    if (r.error) throw r.error;
    // replaced photos: delete our own old file when no other item uses it
    if (F_.item) for (const u of photos(F_.item).filter(u => !imgs.includes(u))) await dropPhoto(u);
    toast(F_.id ? "Item saved" : "Item added"); closeDrawer(); await loadAll(); history.replaceState({}, "", "/seller/catalog/"); page();
  } catch (x) { e.className = "msg err"; e.textContent = niceErr(x); b.disabled = false; b.textContent = "Save item"; }
}
async function dropPhoto(u) {
  const key = String(u).split("/object/public/public/")[1]; if (!key || !key.startsWith(me.id + "/items/")) return;
  const { data } = await db.from("items").select("id").eq("shop", S.id).contains("images", [u]).limit(1);
  if (!(data || []).length) await db.storage.from("public").remove([key, key.replace(/\.webp$/, "_t.webp")]).catch(() => {});
}
async function delItem(id) {
  if (!confirm("Delete this item?")) return;
  const { error } = await db.from("items").delete().eq("id", id); if (error) return toast(niceErr(error));
  closeDrawer(); await loadAll(); page();
}

// ================= Bulk upload =================
// bulk upload lives in /seller/bulk.js (server checks every row: bulk_items)
const slug = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9ऀ-ॿ]+/g, "-").replace(/^-|-$/g, "");

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
        <button class="btn" style="background:#25D366;color:#fff;padding:8px 12px" onclick="riderInviteWa()">Send on WhatsApp</button>
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
function riderInviteWa() {
  const t = `Hello! ${S.name} wants to add you as a delivery partner on Gali Bazaar.\n\n1. Install the app: https://github.com/AumiterGlobals/gali-bazaar-site/releases/download/app/gali-bazaar.apk\n2. Open it → tap *Join as delivery partner*\n3. Enter shop code: *${S.rider_code || ""}*\n4. Sign in with your Gmail → type the code we email you\n5. Do your KYC once (Aadhaar + PAN + selfie)\n\nI'll accept your request, then orders from ${S.name} reach your phone.`;
  window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank");
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
  const to = todayStr(), from = (() => istIso().slice(0, 8) + "01")();
  $("#main").innerHTML = head("Bills & GST", "Sales invoices (app orders + counter bills) and credit notes — downloads for your CA") + `
    <div class="bar2"><label style="margin:0">FROM</label><input class="in" type="date" id="bf" value="${from}" style="width:auto"><label style="margin:0">TO</label><input class="in" type="date" id="bt" value="${to}" style="width:auto">
      <button class="btn ghost" id="bgo" style="padding:9px 14px">Show</button></div><div id="bb"><div class="sub">Loading…</div></div>`;
  let rows = [], notes = [];
  const gstOn = !!(S.gst_billing && S.gstin);
  const lineTax = l => l.g > 0 ? l.p * l.q * l.g / (100 + l.g) : 0;
  const run = async () => {
    const f = $("#bf").value, t = $("#bt").value;
    const [o, cs, c] = await Promise.all([
      db.from("orders").select("id,short_id,bill_no,cust_name,cust_phone,addr,items,fee,total,returned,status,created_at,delivered_at,pay_mode").eq("shop", S.id).eq("status", "DELIVERED").gte("created_at", f).lte("created_at", t + "T23:59:59").order("created_at"),
      db.from("counter_sales").select("*").eq("shop", S.id).gte("created_at", f).lte("created_at", t + "T23:59:59").order("created_at"),
      db.from("credit_notes").select("*").eq("shop", S.id).gte("created_at", f).lte("created_at", t + "T23:59:59").order("created_at")]);
    // counter bills look like orders here (same bill series)
    const counter = (cs.data || []).map(x => ({ id: x.id, short_id: "COUNTER", bill_no: x.bill_no, cust_name: x.cust_name, cust_phone: x.cust_phone, addr: x.cust_addr || "Counter sale (at the shop)",
      items: x.items || [], fee: Number(x.fee || 0), total: Number(x.total), returned: [], status: "DELIVERED", created_at: x.created_at, delivered_at: x.created_at, pay_mode: x.pay_mode === "CREDIT" ? "Udhaar" : x.pay_mode, counter: true }));
    rows = [...(o.data || []).filter(x => x.bill_no), ...counter].sort((x, y) => String(x.bill_no).localeCompare(String(y.bill_no), undefined, { numeric: true }));
    notes = c.data || [];
    const kept = r => (r.items || []).filter(l => !(r.returned || []).includes(l.n));
    const billTot = r => (r.items || []).reduce((a, l) => a + l.p * l.q, 0) + Number(r.fee || 0);
    const tot = rows.reduce((a, r) => a + billTot(r), 0), cnTot = notes.filter(n => n.kind !== "REPLACEMENT").reduce((a, n) => a + Number(n.amount), 0);
    const gst = gstOn ? rows.reduce((a, r) => a + (r.items || []).reduce((s, l) => s + lineTax(l), 0), 0) : 0;
    BILLS = { rows, notes, f, t, kept, billTot };
    $("#bb").innerHTML = `<div class="kpis k4"><div class="kpi"><span>Bills</span><b>${rows.length}</b></div><div class="kpi"><span>Sales (bill total)</span><b>${inr2(tot)}</b></div>
      <div class="kpi"><span>Credit notes</span><b class="pk">− ${inr2(cnTot)}</b></div><div class="kpi"><span>GST inside${gstOn ? "" : " (GST billing off)"}</span><b>${inr2(gst)}</b></div></div>
      <div class="box"><h3>Downloads for your CA</h3><div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost" onclick="billDl('register')">⇩ Sales register (every bill)</button>
        <button class="btn ghost" onclick="billDl('items')">⇩ Item-wise sales</button>
        ${gstOn ? `<button class="btn ghost" onclick="billDl('gst')">⇩ GST summary (GSTR-1 B2C)</button><button class="btn ghost" onclick="billDl('hsn')">⇩ HSN summary</button>` : ""}
        <button class="btn ghost" onclick="billDl('cn')">⇩ Credit notes register</button>
        <button class="btn ghost" onclick="billPrintAll('bills')">🖨 All bills (print / save as PDF)</button>
        <button class="btn ghost" onclick="billPrintAll('cn')">🖨 All credit notes (print / save as PDF)</button></div>
        <div class="sub" style="margin-top:8px">Excel files open in Excel, Google Sheets and Tally import. Expenses, payments and full books: <a href="/seller/books/" style="color:#7C3AED">Books &amp; expenses</a>.</div></div>
      <div class="grid2"><div class="box"><h3>Bills</h3>${rows.length ? `<table><thead><tr><th>BILL</th><th>DATE</th><th>CUSTOMER</th><th>TOTAL</th><th class="hm">MODE</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${esc(r.bill_no)}</b>${r.counter ? ` <span class="pill grey">Counter</span>` : ""}</td><td>${dmy(r.delivered_at || r.created_at)}</td><td>${esc(r.cust_name)}</td><td><b>${inr2(billTot(r))}</b></td><td class="hm">${esc(r.pay_mode || "")}</td><td><button class="mini" onclick="billPrint('${r.id}')">Print</button></td></tr>`).join("")}</tbody></table>` : `<div class="sub">No bills in these dates.</div>`}</div>
      <div class="box"><h3>Credit notes</h3>${notes.length ? `<table><thead><tr><th>NO.</th><th>DATE</th><th>AGAINST</th><th>KIND</th><th>AMOUNT</th><th></th></tr></thead><tbody>${notes.map(n => `<tr><td><b>${esc(n.cn_no || "—")}</b>${n.auto ? ` <span class="pill grey">Auto</span>` : ""}</td><td>${dmy(n.created_at)}</td><td>${esc((rows.find(r => r.id === (n.order_id || n.sale_id)) || {}).bill_no || "")}</td><td>${esc(n.kind)}</td><td>${inr2(n.amount)}</td><td><button class="mini" onclick="cnPrint('${n.id}')">Print</button></td></tr>`).join("")}</tbody></table>` : `<div class="sub">No credit notes.</div>`}</div></div>`;
  };
  window.billPrint = id => { const r = rows.find(x => x.id === id); billPrintAll("bills", [r]); };
  window.cnPrint = id => billPrintAll("cn", null, [notes.find(n => n.id === id)]);
  $("#bgo").onclick = run;
  run();
}
let BILLS = null;
function billDl(kind) {
  const { rows, notes, f, t, kept, billTot } = BILLS, gstOn = !!(S.gst_billing && S.gstin), f2 = v => Number(v || 0).toFixed(2);
  const tax = l => l.g > 0 ? l.p * l.q * l.g / (100 + l.g) : 0, per = `${f}_to_${t}`;
  if (kind === "register") {
    const h = ["Bill No", "Date", "Customer", "Phone", "Source", "Items", "Goods value", "Festival discount", "Delivery", "Bill total", "Paid by"]; if (gstOn) h.push("Taxable", "CGST", "SGST", "GST rates");
    return csvDownload(`sales-register-${per}.csv`, [h, ...rows.map(r => { const goods = (r.items || []).reduce((a, l) => a + l.p * l.q, 0), tx = (r.items || []).reduce((a, l) => a + tax(l), 0);
      const row = [r.bill_no, (r.delivered_at || r.created_at || "").slice(0, 10), r.cust_name, r.cust_phone || "", r.counter ? "Counter bill" : "App order", (r.items || []).map(l => `${l.n} x${l.q}`).join("; "), f2(goods), f2(offSaved(r)), f2(r.fee), f2(billTot(r)), r.pay_mode || "Cash"];
      if (gstOn) row.push(f2(goods - tx), f2(tx / 2), f2(tx / 2), [...new Set((r.items || []).map(l => (l.g || 0) + "%"))].join("/")); return row; })]);
  }
  if (kind === "items") {
    const m = {}; rows.forEach(r => (r.items || []).forEach(l => { const k = l.n; m[k] = m[k] || { q: 0, a: 0, g: l.g, h: l.h, oq: 0, oa: 0 }; m[k].q += l.q; m[k].a += l.p * l.q; if (l.d) { m[k].oq += l.q; m[k].oa += l.p * l.q; } }));
    return csvDownload(`item-sales-${per}.csv`, [["Item", "HSN", "Qty", "Amount", "GST %", "Qty on offer", "Sales from offers"], ...Object.entries(m).sort((a, b) => b[1].a - a[1].a).map(([n, v]) => [n, v.h || "", v.q, f2(v.a), v.g ?? "", v.oq, f2(v.oa)])]);
  }
  if (kind === "gst" || kind === "hsn") {
    const m = {}; rows.forEach(r => (r.items || []).filter(l => l.g > 0 || kind === "hsn").forEach(l => { const k = kind === "gst" ? String(l.g) : (l.h || "—") + "|" + (l.g || 0); m[k] = m[k] || { q: 0, gross: 0, tax: 0 }; m[k].q += l.q; m[k].gross += l.p * l.q; m[k].tax += tax(l); }));
    notes.filter(n => n.kind !== "REPLACEMENT").forEach(n => (n.items || []).filter(l => l.g > 0 || kind === "hsn").forEach(l => { const k = kind === "gst" ? String(l.g) : (l.h || "—") + "|" + (l.g || 0); if (!m[k]) return; m[k].q -= l.q; m[k].gross -= l.p * l.q; m[k].tax -= tax(l); }));
    return kind === "gst"
      ? csvDownload(`gst-b2c-${per}.csv`, [["Place of supply", "GST rate %", "Taxable value", "CGST", "SGST", "Total tax"], ...Object.entries(m).map(([g, v]) => [S.state, g, f2(v.gross - v.tax), f2(v.tax / 2), f2(v.tax / 2), f2(v.tax)])])
      : csvDownload(`hsn-summary-${per}.csv`, [["HSN", "GST %", "Qty", "Total value", "Taxable value", "CGST", "SGST"], ...Object.entries(m).map(([k, v]) => { const [h, g] = k.split("|"); return [h, g, v.q, f2(v.gross), f2(v.gross - v.tax), f2(v.tax / 2), f2(v.tax / 2)]; })]);
  }
  return csvDownload(`credit-notes-${per}.csv`, [["CN No", "Date", "Type", "Against bill", "Customer", "Items", "Amount", "Refund mode", "Reason"],
    ...notes.map(n => { const r = rows.find(x => x.id === (n.order_id || n.sale_id)) || {}; return [n.cn_no || "", n.cn_date || (n.created_at || "").slice(0, 10), n.kind, r.bill_no || "", r.cust_name || "", (n.items || []).map(l => `${l.n} x${l.q}`).join("; "), f2(n.amount), n.refund_mode || "", n.reason || ""]; })]);
}
// festival offers (update-76): what the customer saved on this order (lines carry b = base price, d = % off)
const offSaved = r => (r.items || []).filter(l => l.d && !(r.returned || []).includes(l.n)).reduce((a, l) => a + ((l.b ?? l.p) - l.p) * l.q, 0);
// one printable page with every bill / credit note (Print → Save as PDF)
function billPrintAll(kind, onlyRows, onlyNotes) {
  const { rows, notes } = BILLS, gstOn = !!(S.gst_billing && S.gstin), f2 = v => Number(v || 0).toFixed(2);
  const list = kind === "bills" ? (onlyRows || rows) : (onlyNotes || notes);
  if (!list.length) return toast("Nothing to print in these dates");
  const tax = l => l.g > 0 ? l.p * l.q * l.g / (100 + l.g) : 0;
  const headHtml = `<h2 style="margin:0">${esc(S.name)}</h2><div class="m">${esc([S.addr, S.locality, S.city, S.state, S.pin].filter(Boolean).join(", "))}${S.gstin ? `<br><b>GSTIN ${esc(S.gstin)}</b>` : ""}${S.fssai ? ` · FSSAI ${esc(S.fssai)}` : ""}</div>`;
  const bill = r => { const items = r.items || [], goods = items.reduce((a, l) => a + l.p * l.q, 0), fee = Number(r.fee || 0);
    return `<div class="doc">${headHtml}<div class="tag">${gstOn ? "TAX INVOICE" : "BILL OF SUPPLY"}</div>
      <div class="meta"><div><b>Bill no</b> ${esc(r.bill_no)}<br><b>Date</b> ${dmyy(r.delivered_at || r.created_at)}<br><b>Paid by</b> ${esc(r.pay_mode || "Cash")}</div><div><b>Billed to</b><br>${esc(r.cust_name)}${r.cust_phone ? " · " + esc(r.cust_phone) : ""}<br><span class="m">${esc(r.addr || "")}</span></div></div>
      <table><tr><th>#</th><th>Item${gstOn ? " · HSN" : ""}</th><th>Qty</th><th>Rate</th>${gstOn ? "<th>Taxable</th><th>GST</th>" : ""}<th>Amount</th></tr>
      ${items.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.n)} ${esc(l.u || "")}${gstOn && l.h ? `<br><small>HSN ${esc(l.h)}</small>` : ""}${l.d ? `<br><small style="color:#B45309">Price ${f2(l.b)} − ${l.d}% ${esc(l.on || "offer")}</small>` : ""}</td><td>${l.q}</td><td>${f2(l.p)}</td>${gstOn ? `<td>${f2(l.p * l.q - tax(l))}</td><td>${l.g || 0}%<br><small>C ${f2(tax(l) / 2)} · S ${f2(tax(l) / 2)}</small></td>` : ""}<td>${f2(l.p * l.q)}</td></tr>`).join("")}
      ${fee ? `<tr><td></td><td>Delivery charges</td><td></td><td></td>${gstOn ? "<td></td><td></td>" : ""}<td>${f2(fee)}</td></tr>` : ""}
      ${(sv => sv > 0 ? `<tr><td></td><td colspan="${gstOn ? 5 : 3}" style="color:#B45309">Festival discount (included above)</td><td style="color:#B45309">− ${f2(sv)}</td></tr>` : "")(offSaved(r))}
      <tr class="t"><td colspan="${gstOn ? 6 : 4}">Total</td><td>₹${f2(goods + fee)}</td></tr></table>
      ${(r.returned || []).length ? `<div class="m">Returned at the door: ${esc(r.returned.join(", "))} — reduced by credit note.</div>` : ""}
      ${gstOn ? `<div class="m">Whether tax is payable on reverse charge: No</div>` : `<div class="m">Seller not registered under GST · no GST charged.</div>`}
      <div class="m">Issued by ${esc(S.name)}, the seller. Gali Bazaar is only a platform that connects buyers and sellers.</div></div>`; };
  const cn = n => { const r = rows.find(x => x.id === (n.order_id || n.sale_id)) || {};
    return `<div class="doc">${headHtml}<div class="tag">CREDIT NOTE</div>
      <div class="meta"><div><b>Credit note</b> ${esc(n.cn_no || "")}<br><b>Date</b> ${esc(n.cn_date || dmyy(n.created_at))}<br><b>Against bill</b> ${esc(r.bill_no || "")}</div><div><b>Customer</b><br>${esc(r.cust_name || "")}<br><span class="m">${esc(n.reason || n.kind)}</span></div></div>
      <table><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>${(n.items || []).map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.n)}</td><td>${l.q}</td><td>${f2(l.p)}</td><td>${f2(l.p * l.q)}</td></tr>`).join("")}
      <tr class="t"><td colspan="4">Credit amount</td><td>₹${f2(n.amount)}</td></tr></table><div class="m">Refund: ${esc(n.refund_mode || "")}${n.auto ? " · made automatically for a return at the door" : ""}</div></div>`; };
  const w = window.open("", "_blank"); if (!w) return toast("Allow pop-ups to print");
  w.document.write(`<html><head><title>${kind === "bills" ? "Bills" : "Credit notes"} · ${esc(S.name)}</title><style>
    body{font-family:Arial,sans-serif;color:#1D0F30;margin:0;padding:16px}.doc{max-width:720px;margin:0 auto 24px;border:1px solid #eee;border-radius:12px;padding:18px;page-break-after:always}
    .m{color:#6B6380;font-size:12px;margin-top:4px}.tag{display:inline-block;background:#6A1BB0;color:#fff;font-weight:700;border-radius:8px;padding:5px 12px;margin:10px 0}
    .meta{display:flex;gap:16px;font-size:13px}.meta div{flex:1;background:#FAF8FC;border-radius:8px;padding:8px}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px}
    th{background:#F4EDFC;text-align:left;padding:6px}td{padding:6px;border-bottom:1px solid #eee;vertical-align:top}.t td{font-weight:800;border-top:2px solid #1D0F30}
    @media print{body{padding:0}.doc{border:0}button{display:none}}</style></head><body>
    <button onclick="print()" style="display:block;margin:0 auto 14px;padding:10px 18px;border:0;border-radius:10px;background:#6A1BB0;color:#fff;font-weight:700">Print / Save as PDF</button>
    ${list.map(kind === "bills" ? bill : cn).join("")}</body></html>`);
  w.document.close();
}

// ================= Shop & KYC =================
function shop() {
  const dl = daysLeft(), kycTxt = { APPROVED: ["Verified", "ok"], PENDING: ["Being checked", "warn"], REJECTED: ["Rejected", "bad"], NONE: ["Not done", "bad"] }[S.kyc] || [S.kyc, "grey"];
  const f = (k, l, v, t = "text") => `<div><label>${l}</label><input class="in" id="sh_${k}" type="${t}" value="${esc(v ?? "")}"></div>`;
  $("#main").innerHTML = head("Shop & KYC", "Your shop details — the same as in the app") + `
    <div class="grid2"><div class="box"><h3>Shop details</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px">
      ${f("name", "SHOP NAME", S.name)}${f("phone", "PHONE", S.phone)}${f("addr", "ADDRESS", S.addr)}${f("locality", "LOCALITY", S.locality)}${f("city", "CITY", S.city)}${f("pin", "PIN CODE", S.pin)}
      ${f("min_order", "MINIMUM ORDER ₹", S.min_order, "number")}${f("delivery_fee", "DELIVERY FEE ₹", S.delivery_fee, "number")}${f("free_above", "FREE DELIVERY ABOVE ₹ (optional)", S.free_above, "number")}${f("upi_id", "UPI ID (shown to customers)", S.upi_id)}
      ${f("fssai", FOOD() ? "FSSAI NO. (14 DIGITS) — REQUIRED" : "FSSAI NO. (OPTIONAL)", S.fssai)}${f("gstin", "GSTIN (optional)", S.gstin)}</div>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:8px;font-size:12.5px;line-height:1.45"><input type="checkbox" id="gul" ${S.gst_under_limit ? "checked" : ""} style="margin-top:3px">
        <span>No GSTIN? Tick this: I'm not GST registered — my shop's yearly sales are under the GST limit (₹40 lakh for goods; ₹20 lakh in some states). If sales cross the limit, I'll add my GSTIN.</span></label>
      <div class="msg" id="shm"></div><button class="btn pink" style="margin-top:12px" onclick="saveShopForm()">Save details</button></div>
      ${sellBox()}
    <div><div class="box"><h3>KYC <span class="pill ${kycTxt[1]}" style="float:right">${kycTxt[0]}</span></h3>
        <div class="row" style="border:0;margin:0"><div><b>PAN name</b><span>${esc(S.pan_name || "—")}</span></div></div><div class="row"><div><b>PAN</b><span>${S.pan_number ? esc(S.pan_number.slice(0, 5) + "••••" + S.pan_number.slice(-1)) : "—"}</span></div></div>
        <div class="row"><div><b>Aadhaar</b><span>${S.aadhaar_last4 ? "•••• " + esc(S.aadhaar_last4) : "—"}</span></div></div>
        ${S.kyc_reason && S.kyc !== "APPROVED" ? `<div class="warnline">${esc(S.kyc_reason)}</div>` : ""}<div class="note">KYC documents are uploaded and changed in the app (Account → KYC), with the camera.</div></div>
      <div class="box" style="background:#1D0F30;color:#fff"><b style="font-size:16px">${S.kyc !== "APPROVED" ? "Plan starts after KYC" : dl == null ? "Plan not started" : dl < 0 ? "Plan ended — shop is offline" : `${S.trial_used ? "Plan" : "Free trial"} • ${dl} day${dl === 1 ? "" : "s"} left`}</b>
        <div style="font-size:12px;color:#CFC6E3;margin:4px 0 12px">${S.sub_until ? "Till " + dmyy(S.sub_until) + " • " : ""}Renewal link goes to your email</div><button class="btn" style="background:#fff;color:#1D0F30" onclick="sendLink(this)">Send link</button></div>
      <div class="box"><h3>Status</h3><div class="row" style="border:0;margin:0"><div><b>${S.closed ? "Shop closed" : "Shop open"}</b><span>Customers ${S.closed ? "can't" : "can"} order right now</span></div><button class="tog ${S.closed ? "" : "on"}" onclick="toggleOpen()"></button></div></div></div></div>`;
  $("#main").insertAdjacentHTML("beforeend", `<div class="box" id="taBox"><div class="sub">Loading…</div></div><div class="box" id="delBox"><div class="sub">Loading…</div></div>`); sdBox(); taBox();
}
// update-75: signed Seller Terms (version, time, name typed, OTP) — download as PDF
async function taBox() {
  const { data } = await db.from("terms_acceptances").select("*").eq("profile", me.id).eq("role", "seller").order("accepted_at", { ascending: false }).limit(10);
  window._ta = data || [];
  const el = $("#taBox"); if (!el) return;
  el.innerHTML = `<h3>Seller Terms you accepted</h3>${(data || []).length ? `<table><thead><tr><th>Version</th><th>Accepted</th><th>Name typed</th><th>Phone OTP</th><th></th></tr></thead><tbody>
    ${data.map((t, i) => `<tr><td><b>${esc(t.version)}</b></td><td>${new Date(t.accepted_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
      <td>${esc(t.typed_name || "—")}</td><td>${t.otp_ref ? `<span class="pill ok">Verified ••••${esc(t.phone_last4 || "")}</span>` : '<span class="pill grey">—</span>'}</td>
      <td><button class="btn ghost" style="padding:6px 12px;font-size:12.5px" onclick="taPdf(${i})">PDF</button></td></tr>`).join("")}</tbody></table>` : `<div class="sub">No signed record yet.</div>`}`;
}
async function taPdf(i) {
  const t = window._ta[i]; if (!t) return;
  const terms = await fetch("/legal/seller-terms.json").then(r => r.json()).catch(() => null);
  const md = x => esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const w = window.open("", "_blank"); if (!w) { alert("Allow pop-ups to view the record"); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Seller Terms acceptance ${esc(t.version)}</title><style>
    body{font-family:Poppins,Arial,sans-serif;color:#1D0F30;margin:0;padding:32px;max-width:780px}.bar{height:6px;background:#6A1BB0;margin:-32px -32px 26px}
    h1{font-size:20px;margin:0 0 12px}table{width:100%;border-collapse:collapse}td{padding:7px 6px;font-size:13.5px;border-bottom:1px solid #F1ECF4}td:first-child{color:#6B6380;width:200px}
    .t{font-size:13px;line-height:1.6;color:#3F3854}.t li{margin-left:16px}.mut{color:#6B6380;font-size:12px}.btn{margin:18px 0;padding:10px 18px;border:0;border-radius:99px;background:#1D0F30;color:#fff;font:inherit;cursor:pointer}
    @media print{.btn{display:none}}</style></head><body><div class="bar"></div><h1>Seller Terms — acceptance record</h1>
    <table><tr><td>Shop</td><td><b>${esc(S.name)}</b></td></tr><tr><td>Terms version</td><td>${esc(t.version)}</td></tr>
      <tr><td>Accepted at</td><td>${new Date(t.accepted_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</td></tr><tr><td>Name typed</td><td>${esc(t.typed_name || "—")}</td></tr>
      <tr><td>Read to the end</td><td>${t.scrolled ? "Yes" : "—"}</td></tr><tr><td>Phone OTP</td><td>${t.otp_ref ? "Verified (number ending " + esc(t.phone_last4 || "") + ")" : "Not required at the time"}</td></tr>
      <tr><td>OTP reference</td><td>${esc(t.otp_ref || "—")}</td></tr><tr><td>Device</td><td>${esc(t.device || "—")}</td></tr><tr><td>Via</td><td>${t.platform === "web" ? "Website seller panel" : "App " + esc(t.app_version || "")}</td></tr></table>
    <p class="mut">Electronic record of acceptance under section 10A of the Information Technology Act, 2000.</p><button class="btn" onclick="print()">Print / Save as PDF</button>
    ${terms ? `<h1 style="margin-top:20px">Seller Terms</h1><div class="t">${terms.en.map(b => b.t === "li" ? `<li>${md(b.s)}</li>` : `<p>${md(b.s)}</p>`).join("")}</div>` : ""}</body></html>`);
  w.document.close();
}

// ---------- Delete shop: a request to Gali Bazaar, deleted after the checks (update-64) ----------
const SDT = [
  "Download your records first: Bills → Excel and Books → Excel here (the app saves everything in one Excel file). Keep them for GST (72 months) and income tax (6–7 years) — Gali Bazaar keeps no copy of your books; only your customers' copies of their own bills stay.",
  "Your request goes to Gali Bazaar. While we check it, your shop is hidden from customers and takes no new orders. You can cancel the request any time before it is done.",
  "We delete the shop only when no order is open, no complaint is open, the return / exchange time of every order is over, and every paid order that was cancelled has its refund recorded. We also check store credit (\"Adjust in next order\") and items still under your warranty — settle these with your customers first.",
  "When it is approved, we email you the final copy of your records as Excel (including anything after your request, such as refunds and credit notes). Then your books, counter sales, expenses, items, photos and delivery-staff access go. KYC is kept locked for 180 days as the law requires, then deleted. It can't be brought back.",
  "Gali Bazaar keeps only its own records with you — plan payments and its invoices to you — as its tax law needs.",
];
function sdList(c) {
  if (!c) return `<div class="sub">Checking…</div>`;
  return (c.checks || []).map(k => { const [m, col, bg] = k.level === "ok" ? ["✓", "#15803D", "#E6F8EE"] : k.level === "warn" ? ["!", "#B45309", "#FFF1DC"] : ["✕", "#BE123C", "#FFE4EC"];
    return `<div style="display:flex;gap:10px;padding:7px 0;border-top:1px solid #F5F1FA"><span style="flex:none;width:22px;height:22px;border-radius:50%;background:${bg};color:${col};font-weight:800;font-size:12px;display:grid;place-items:center">${m}</span>
      <div style="flex:1"><b style="font-size:13.5px">${esc(k.title)}</b><div style="font-size:12.5px;color:${k.level === "ok" ? "#8E84A8" : col}">${esc(k.detail)}</div>
      ${(k.rows || []).slice(0, 3).map(r => `<div style="font-size:12px;color:#8E84A8">${esc(r.ref)} · ${esc(r.text)}</div>`).join("")}${(k.rows || []).length > 3 ? `<div style="font-size:12px;color:#8E84A8">+${k.rows.length - 3} more</div>` : ""}</div></div>`; }).join("");
}
async function sdBox(openForm) {
  const box = $("#delBox"); if (!box) return;
  const [{ data: rq }, { data: chk }] = await Promise.all([
    db.from("shop_delete_requests").select("*").eq("shop", S.id).order("created_at", { ascending: false }).limit(1),
    db.rpc("shop_delete_check", { p_shop: S.id })]);
  const r = (rq || [])[0];
  if (r && (r.status === "PENDING" || r.status === "APPROVED")) {
    box.style.cssText = "background:#FFF7E6;border:1px solid #F5D08A";
    box.innerHTML = `<h3 style="color:#92400E">🗑 Delete request sent <span>${new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></h3>
      <div class="sub" style="margin:0 0 6px">Gali Bazaar is checking your shop. It is hidden from customers and takes no new orders meanwhile. When the checks below are clear, we email you the final copy of your records (Excel) and delete the shop.</div>
      ${sdList(chk)}${r.status === "PENDING" ? `<button class="btn ghost" style="margin-top:12px" onclick="sdCancel()">Cancel request</button>` : ""}`;
    return;
  }
  box.style.cssText = "";
  box.innerHTML = `<h3>Delete shop</h3>${r && r.status === "REJECTED" ? `<div class="warnline" style="margin-bottom:8px">Your last request was not approved: ${esc(r.admin_note || "")}</div>` : ""}
    <div class="sub" style="margin:0 0 8px">Gali Bazaar checks every shop before deleting it, so no customer is left without their order, refund, return or warranty.</div>
    ${openForm ? `<div style="background:#F7F5FA;border-radius:14px;padding:10px 12px;margin-bottom:10px"><b style="font-size:13.5px">Your shop right now</b>${sdList(chk)}
        ${chk && !chk.ok ? `<div class="sub" style="font-size:12px;margin:6px 0 0">You can still send the request — Gali Bazaar deletes the shop once the ✕ items are clear.</div>` : ""}</div>
      <ol style="font-size:13px;line-height:1.55;padding-left:18px;margin:0 0 8px">${SDT.map(t => `<li>${t}</li>`).join("")}</ol>
      <label>WHY ARE YOU CLOSING? (OPTIONAL)</label><input class="in" id="sdr" maxlength="300">
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:8px;font-size:12.5px;text-transform:none;letter-spacing:0;color:#1D0F30"><input type="checkbox" id="sdx" style="margin-top:3px"> I have downloaded my records and will keep them as the law needs.</label>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:6px;font-size:12.5px;text-transform:none;letter-spacing:0;color:#1D0F30"><input type="checkbox" id="sda" style="margin-top:3px"> I have read and accept these terms (also in the Seller terms and the Seller guide).</label>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn" style="background:#D7263D;color:#fff" onclick="sdSend()">Send delete request</button><button class="btn ghost" onclick="sdBox(false)">Cancel</button></div>`
    : `<button class="btn ghost" style="color:#D7263D" onclick="sdBox(true)">Delete my shop &amp; account</button>`}`;
}
async function sdSend() {
  if (!$("#sdx").checked || !$("#sda").checked) return toast("Tick both boxes to send the request");
  const { error } = await db.rpc("request_shop_delete", { p_terms: "seller-delete-2026-11-15.9", p_excel: true, p_reason: $("#sdr").value.trim() });
  if (error) return toast(niceErr(error));
  toast("Request sent · Gali Bazaar will check your shop"); S.delete_requested_at = new Date().toISOString(); shell(); page();
}
async function sdCancel() {
  if (!confirm("Cancel the delete request? Your shop shows to customers and takes orders again.")) return;
  const { error } = await db.rpc("cancel_shop_delete_request");
  if (error) return toast(niceErr(error));
  toast("Request cancelled · your shop is open again"); S.delete_requested_at = null; shell(); page();
}
async function saveShopForm() {
  const v = k => $("#sh_" + k).value.trim(), n = k => v(k) === "" ? null : +v(k), m = $("#shm");
  if (!v("name") || !/^\d{10}$/.test(v("phone").replace(/\D/g, "").slice(-10))) { m.className = "msg err"; m.textContent = "Enter shop name and a 10-digit phone"; return; }
  const patch = { name: v("name"), phone: v("phone"), addr: v("addr"), locality: v("locality"), city: v("city"), pin: v("pin"), min_order: n("min_order") || 0, delivery_fee: n("delivery_fee") || 0,
    free_above: n("free_above"), upi_id: v("upi_id") || null, fssai: v("fssai").replace(/\D/g, "") || null, gstin: v("gstin") || null };
  if (!patch.gstin) patch.gst_billing = false;
  patch.gst_under_limit = !patch.gstin && !!($("#gul") && $("#gul").checked);
  if (patch.fssai && !/^[12][0-9]{13}$/.test(patch.fssai)) return toast("FSSAI number has 14 digits and starts with 1 or 2 — check your certificate");
  if (FOOD() && !patch.fssai) return toast("Add your 14-digit FSSAI number — it's required for food shops");
  if (!patch.gstin && !patch.gst_under_limit) return toast("Add your GSTIN, or tick the box that your sales are under the GST limit");
  const { error } = await db.from("shops").update(patch).eq("id", S.id);
  if (error) { m.className = "msg err"; m.textContent = niceErr(error); return; }
  Object.assign(S, patch); toast("Saved"); shell(); page();
}

boot();

// ================= Help & support (chat with the Gali Bazaar team) =================
let supTimer = null;
// ================= Subscription & bills (update-71): balance / pending, bills, TDS notes, payments, statement =================
let planTab = "bills";
const dmy = d => d ? new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
const KIND_L = { PAYMENT: "Payment received", INVOICE: "Plan invoice", BALANCE_USED: "Plan paid from balance", TDS_NOTE: "TDS recovery note", CREDIT_NOTE: "Credit note", OPENING: "Opening balance" };
async function plan() {
  $("#main").innerHTML = head("Subscription & bills", "Your plan with Gali Bazaar — bills, TDS notes, payments and statement") + `<div class="box" id="plBox"><div class="sub">Loading…</div></div>`;
  const [{ data: b, error }, { data: st }, { data: tx }] = await Promise.all([db.rpc("my_billing", { p_shop: S.id }), db.from("settings").select("*").eq("id", 1).maybeSingle(),
    db.rpc("shop_tds", { p_shop: S.id })]);
  const { data: certs } = await db.from("tds_certificates").select("*").eq("shop", S.id).order("fy", { ascending: false });
  if (error || !b) { $("#plBox").innerHTML = `<div class="msg err">${esc(error ? niceErr(error) : "Not available yet")}</div>`; return; }
  window._plan = { b, st: st || {}, tx: tx || { months: [] }, certs: certs || [] };
  planDraw();
}
function planDraw() {
  const { b } = window._plan, bal = Number(b.balance || 0), pay = Number(b.pay_now || 0);
  const tds = (window._plan.tx.months || []).filter(r => +r.tds > 0);
  const pend = (b.payments || []).filter(c => c.status === "PENDING");
  const q1 = (b.quotes || []).find(q => q.months === 1);
  const tab = (k, l, n) => `<button class="btn ${planTab === k ? "" : "ghost"}" style="padding:7px 14px;font-size:13px" onclick="planTab='${k}';planDraw()">${l}${n ? ` · ${n}` : ""}</button>`;
  const T = (h, rows) => rows.length ? `<table><thead><tr>${h.map(x => `<th${/Amount|Total|Balance|GST|Taxable|TDS|Sales/.test(x) ? ' style="text-align:right"' : ""}>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>` : `<div class="sub">Nothing here yet.</div>`;
  const R = v => `<td style="text-align:right">${inr2(v)}</td>`;
  let body = "";
  if (planTab === "bills") body = T(["Invoice", "Date", "For", "Taxable", "GST", "Total", ""], (b.invoices || []).map(i => `<tr><td><b>${esc(i.inv_no)}</b>${i.funded === "BALANCE" ? '<div class="sub" style="font-size:11.5px">Paid from balance</div>' : ""}</td><td>${dmy(i.inv_date)}</td>
      <td>${i.purpose === "FEATURED" ? `Top placement ${i.days} days` : `Plan ${dmy(i.period_from)} – ${dmy(i.period_to)}`}</td>${R(i.taxable)}${R(Number(i.cgst) + Number(i.sgst) + Number(i.igst))}<td style="text-align:right"><b>${inr2(i.total)}</b></td>
      <td><button class="btn ghost" style="padding:6px 12px;font-size:12.5px" onclick="planInvoice('${i.id}')">View / PDF</button></td></tr>`));
  if (planTab === "tds") body = tdsQuarters() + `<div class="sub" style="margin-bottom:8px">E-commerce TDS (Income-tax Act 2025, s.393(1) Sl. 8(v)) on your sales through Gali Bazaar. We deposit it with the Income-tax department and recover it from you by a separate TDS note — no GST on it. The credit shows in your Form 168 / AIS against your PAN; the certificate (Form 131) comes every quarter.</div>` +
      T(["Month", "Sales", "Rate", "TDS", "Note", "Status"], tds.map(r => `<tr><td><b>${txMonth(r.month)}</b></td>${R(r.sales)}<td>${r.rate}%${r.entity === "NO_PAN" ? ' <span class="pill bad">no PAN</span>' : ""}</td>${R(r.tds)}
        <td>${esc(r.note_no || "")} <button class="btn ghost" style="padding:4px 10px;font-size:12px" onclick="tdsNote('${r.month}')">View</button></td>
        <td>${r.status === "RECOVERED" ? '<span class="pill ok">Paid</span>' : '<span class="pill warn">Pending</span>'}</td></tr>`)) +
      "";
  if (planTab === "pay") body = T(["Date", "UTR", "For", "Status", "Amount"], (b.payments || []).map(c => `<tr><td>${dmy(c.paid_on)}</td><td>${esc(c.utr)}</td>
      <td>${c.purpose === "FEATURED" ? "Top placement" : `Plan ${c.months} month${c.months > 1 ? "s" : ""}`}${c.inv_no ? `<div class="sub" style="font-size:11.5px">Invoice ${esc(c.inv_no)}</div>` : ""}</td>
      <td>${c.status === "APPROVED" ? '<span class="pill ok">Verified</span>' : c.status === "PENDING" ? '<span class="pill warn">Checking</span>' : `<span class="pill bad">${esc(c.status === "REJECTED" ? "Not accepted" : "Not found")}</span>${c.reason ? `<div class="sub" style="font-size:11.5px">${esc(c.reason)}</div>` : ""}`}</td>${R(c.amount)}</tr>`));
  if (planTab === "stmt") body = T(["Date", "Entry", "Doc no", "Amount", "Balance"], (b.statement || []).map(l => `<tr><td>${dmy(l.at)}</td><td>${esc(KIND_L[l.kind] || l.kind)}<div class="sub" style="font-size:11.5px">${esc(l.note || "")}</div></td>
      <td>${esc(l.doc_no || "")}</td><td style="text-align:right;color:${l.amount < 0 ? "#C62828" : "#12A866"}">${l.amount < 0 ? "– " : "+ "}${inr2(Math.abs(l.amount))}</td>${R(l.running)}</tr>`));
  $("#main").innerHTML = head("Subscription & bills", "Your plan with Gali Bazaar — bills, TDS notes, payments and statement") + `
    <div class="box" style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;background:${b.paused ? "#FDECEC" : "#fff"}">
      <div style="flex:1;min-width:200px"><div class="sub">Balance</div><div style="font-size:26px;font-weight:800;color:${bal < 0 ? "#C62828" : "#1D0F30"}">${bal < 0 ? "– " : ""}${inr2(Math.abs(bal))}</div>
        <div class="sub">${S.sub_until ? "Plan active till " + dmy(S.sub_until) : "No plan yet"}</div></div>
      <div style="flex:1;min-width:200px"><div class="sub">${b.paused ? "Shop paused — pending" : "Pending"}</div><div style="font-size:26px;font-weight:800;color:${pay > 0 ? "#C62828" : "#12A866"}">${inr2(pay)}</div>
        <div class="sub">${pay > 0 ? `Plan ${inr2(b.plan_due)}${Number(b.tds_this_month) ? ` + TDS ${inr2(b.tds_this_month)}` : ""}${bal > 0 ? ` – balance ${inr2(bal)}` : ""}${b.due_by ? ` · pay by ${dmy(b.due_by)}` : " · pay now"}` : "Nothing to pay"}</div></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <a class="btn pink" href="/pay/?shop=${S.id}&months=1">Pay / renew</a>
        ${q1 && bal >= Number(q1.amount) ? `<button class="btn" onclick="useBalance()">Use balance for plan</button>` : ""}</div></div>
    <div class="sub" style="margin:-4px 0 12px">Plans renew on the 1st of every month (first month pro-rata). Pay by the 5th — unpaid shops are paused on the 6th and come back as soon as the payment is verified. Extra money stays as balance.</div>
    ${(b.payments || []).filter(c => c.status === "NOT_FOUND").map(c => `<div class="box" style="background:#FDE7EE;border-color:#F6B9CC;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:240px"><b style="color:#B0144F">Payment not found — ${inr(c.amount)} · UTR ${esc(c.utr)}</b>
      <div class="sub" style="color:#6B1233">Payment not found in our bank statement — please check your bank statement and the UTR, then update it.</div></div>
      <a class="btn pink" href="/pay/?shop=${S.id}&fix=1">Update UTR</a></div>`).join("")}
    ${pend.map(c => `<div class="box"><b>${inr(c.amount)} · ${dmy(c.paid_on)} · UTR ${esc(c.utr)}</b><div class="sub">Being checked with our bank statement — the invoice comes on the day it's verified.</div></div>`).join("")}
    <div class="box"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${tab("bills", "Bills", (b.invoices || []).length)}${tab("tds", "TDS", tds.length)}${tab("pay", "Payments", (b.payments || []).length)}${tab("stmt", "Statement", 0)}
      <span style="flex:1"></span><button class="btn ghost" style="padding:7px 14px;font-size:13px" onclick="planXlsx()">Excel</button><button class="btn ghost" style="padding:7px 14px;font-size:13px" onclick="print()">PDF</button></div>${body}</div>`;
}
async function tdsCert(p) { const { data } = await db.storage.from("tds-certs").createSignedUrl(p, 600); if (data?.signedUrl) window.open(data.signedUrl); else toast("Couldn't open the certificate"); }
// one card per quarter (newest first), only quarters with TDS: deposit, return and Form 131 status
const QTR = { 1: ["Apr–Jun", "31 Jul", "15 Aug"], 2: ["Jul–Sep", "31 Oct", "15 Nov"], 3: ["Oct–Dec", "31 Jan", "15 Feb"], 4: ["Jan–Mar", "31 May", "15 Jun"] };
function tdsQuarters() {
  const qs = ((window._plan.tx || {}).quarters || []).filter(q => +q.tds > 0);
  if (!qs.length) return "";
  return qs.map(q => { const [mon, ret, cert] = QTR[q.quarter], y0 = 2000 + +q.fy.slice(0, 2), yr = q.quarter === 4 ? y0 + 1 : y0;
    const fy = `${y0}-${String(y0 + 1).slice(2)}`, deps = (q.deposited || []).map(dmy).join(", ");
    return `<div class="box" style="margin:0 0 12px;background:#FBF9FD"><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">
      <h3 style="margin:0;flex:1">Q${q.quarter} · ${mon} ${yr} <span class="sub" style="font-weight:500">(FY ${fy})</span></h3>
      <span class="sub" style="margin:0">Sales <b>${inr2(q.sales)}</b> · TDS <b>${inr2(q.tds)}</b></span></div>
      <div style="display:grid;gap:6px;margin-top:10px;font-size:13.5px">
        <div>Deposited: ${q.all_deposited && deps ? `<b style="color:#12A866">✓ ${deps}</b>` : deps ? `${deps} <span style="color:#B26A00">· ⏳ rest pending</span>` : '<span style="color:#B26A00">⏳ Not deposited yet</span>'}</div>
        <div>Return: ${q.return_filed_on ? `<b style="color:#12A866">✓ Filed ${dmy(q.return_filed_on)}</b>` : `<span style="color:#B26A00">⏳ Return due ${ret} ${q.quarter === 4 || q.quarter === 3 ? y0 + 1 : y0}</span>`}</div>
        <div>Form 131: ${q.cert ? `<button class="btn ghost" style="padding:5px 12px;font-size:12.5px" onclick="tdsCert('${esc(q.cert)}')">Download PDF</button>` : `<span class="sub" style="margin:0">Comes by ~${cert} ${q.quarter === 1 || q.quarter === 2 ? y0 : y0 + 1}</span>`}</div>
        <div class="sub" style="margin:0">Form 168 / AIS should show ${inr2(q.tds)} — if it doesn't, tell us in Help &amp; support.</div></div></div>`; }).join("");
}
const txMonth = d => new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });
function tdsNote(month) {
  const { tx, st, b } = window._plan, r = (tx.months || []).find(x => x.month === month); if (!r) return;
  const noteDate = String(r.created_at || "").slice(0, 10);
  const due = (() => { const d = new Date(noteDate + "T00:00:00Z"); d.setUTCDate((st.pay_due_day || 5)); return d.toISOString().slice(0, 10); })();
  const paidOn = r.status === "RECOVERED" ? ((b.statement || []).filter(l => l.kind === "PAYMENT" || l.kind === "CREDIT_NOTE").map(l => l.at).filter(d => d >= noteDate).sort()[0] || "") : "";
  const addr = [S.addr, S.locality, S.city, S.state, S.pin].filter(Boolean).join(", ");
  const m = v => "₹" + Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const w = window.open("", "_blank"); if (!w) { alert("Allow pop-ups to view the note"); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>TDS note ${esc(r.note_no)}</title><style>
    body{font-family:Poppins,Arial,sans-serif;color:#1D0F30;margin:0;padding:32px;max-width:760px}.bar{height:6px;background:#6A1BB0;margin:-32px -32px 26px}
    h1{font-size:20px;margin:0}.mut{color:#6B6380;font-size:12.5px;line-height:1.5}table{width:100%;border-collapse:collapse;margin-top:18px}
    td{padding:9px 6px;font-size:13.5px;border-bottom:1px solid #F1ECF4}.btn{margin-top:22px;padding:10px 18px;border:0;border-radius:99px;background:#1D0F30;color:#fff;font:inherit;cursor:pointer}
    @media print{.btn{display:none}}</style></head><body><div class="bar"></div>
    <div style="display:flex;justify-content:space-between;gap:20px"><div>${WORDMARK}<h1>${esc(st.biz_name || "Gali Bazaar")}</h1><div class="mut">${esc(st.biz_addr || "")}${st.biz_gstin ? `<br>GSTIN: ${esc(st.biz_gstin)}` : ""}${st.tan ? `<br>TAN: ${esc(st.tan)}` : ""}</div></div>
      <div style="background:#6A1BB0;color:#fff;padding:8px 16px;border-radius:8px;font-weight:700;height:fit-content">TDS RECOVERY NOTE</div></div>
    <table><tr><td class="mut">Note no</td><td><b>${esc(r.note_no)}</b></td></tr><tr><td class="mut">Note date</td><td>${dmy(noteDate)}</td></tr>
      <tr><td class="mut">To</td><td><b>${esc(S.name)}</b> · PAN ${esc(r.pan || "not given")}<br><span class="mut">${esc(addr)}</span></td></tr>
      <tr><td class="mut">Sales month</td><td>${txMonth(r.month)}</td></tr><tr><td class="mut">Your sales through Gali Bazaar</td><td>${m(r.sales)}</td></tr>
      <tr><td class="mut">TDS rate</td><td>${r.rate}% — Income-tax Act 2025, s.393(1) Table Sl. 8(v)${r.entity === "NO_PAN" ? " (no PAN)" : ""}</td></tr>
      <tr><td class="mut"><b>TDS recovered from you</b></td><td><b style="font-size:16px">${m(r.tds)}</b></td></tr>
      <tr><td class="mut">Pay by</td><td>${dmy(due)}</td></tr>
      <tr><td class="mut">Status</td><td>${r.status === "RECOVERED" ? `<b style="color:#12A866">Paid${paidOn ? " on " + dmy(paidOn) : ""}</b>` : '<b style="color:#B26A00">Pending</b>'}</td></tr></table>
    <p class="mut" style="margin-top:20px">Gali Bazaar deposits this TDS with the Income-tax department against your PAN; it shows in your Form 168 / AIS and the quarterly certificate (Form 131). This note is not a tax invoice and carries no GST.</p>
    <button class="btn" onclick="print()">Print / Save as PDF</button></body></html>`);
  w.document.close();
}
async function useBalance() {
  if (!confirm("Pay next month's plan from your balance? The invoice is issued today.")) return;
  const { data, error } = await db.rpc("use_balance_for_plan", { p_months: 1 });
  if (error) return alert(niceErr(error));
  alert("Done — invoice " + data); const { data: sh } = await db.from("shops").select("sub_until").eq("id", S.id).single(); if (sh) S.sub_until = sh.sub_until; plan();
}
function planXlsx() {
  const { b } = window._plan; if (!window.XLSX) return alert("Excel is still loading — try again in a moment");
  const wb = XLSX.utils.book_new(), add = (n, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "Nothing yet" }]), n);
  add("Bills", (b.invoices || []).map(i => ({ "Invoice no": i.inv_no, Date: i.inv_date, For: i.purpose === "FEATURED" ? `Top placement ${i.days} days` : `Plan ${i.period_from} to ${i.period_to}`,
    SAC: i.sac, "Place of supply": i.place_of_supply, GSTIN: i.bill_gstin || "", Taxable: +i.taxable, CGST: +i.cgst, SGST: +i.sgst, IGST: +i.igst, Total: +i.total, "Paid from": i.funded === "BALANCE" ? "Balance" : "Payment" })));
  add("TDS", (window._plan.tx.months || []).filter(r => +r.tds > 0).map(r => ({ Month: r.month, "Sales": +r.sales, "Rate %": +r.rate, TDS: +r.tds, "Note no": r.note_no, Status: r.status === "RECOVERED" ? "Paid" : "Pending" })));
  add("Payments", (b.payments || []).map(c => ({ Date: c.paid_on, UTR: c.utr, Amount: +c.amount, Status: c.status === "APPROVED" ? "Verified" : c.status, Invoice: c.inv_no || "" })));
  add("Statement", (b.statement || []).map(l => ({ Date: l.at, Entry: KIND_L[l.kind] || l.kind, "Doc no": l.doc_no || "", Details: l.note || "", Amount: +l.amount, Balance: +l.running })));
  XLSX.writeFile(wb, `Gali-Bazaar-subscription-${S.name.replace(/[^A-Za-z0-9]+/g, "-")}.xlsx`);
}
// ---- shared for plan invoice / TDS note (update-71/73) ----
const GST_CODE = { "jammu and kashmir": "01", "himachal pradesh": "02", "punjab": "03", "chandigarh": "04", "uttarakhand": "05", "haryana": "06", "delhi": "07",
  "rajasthan": "08", "uttar pradesh": "09", "bihar": "10", "sikkim": "11", "arunachal pradesh": "12", "nagaland": "13", "manipur": "14", "mizoram": "15", "tripura": "16",
  "meghalaya": "17", "assam": "18", "west bengal": "19", "jharkhand": "20", "odisha": "21", "chhattisgarh": "22", "madhya pradesh": "23", "gujarat": "24",
  "dadra and nagar haveli and daman and diu": "26", "maharashtra": "27", "karnataka": "29", "goa": "30", "lakshadweep": "31", "kerala": "32", "tamil nadu": "33",
  "puducherry": "34", "andaman and nicobar islands": "35", "telangana": "36", "andhra pradesh": "37", "ladakh": "38" };
const posLabel = st => st ? `${st}${GST_CODE[String(st).trim().toLowerCase()] ? " (" + GST_CODE[String(st).trim().toLowerCase()] + ")" : ""}` : "";
function amtWords(v) {   // "Rupees One Hundred Twenty and Fifty Paise Only" — Indian numbering, same as the app PDF
  const o = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"],
    t = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = n => n < 20 ? o[n] : t[Math.floor(n / 10)] + (n % 10 ? " " + o[n % 10] : ""), three = n => [n >= 100 ? o[Math.floor(n / 100)] + " Hundred" : "", n % 100 ? two(n % 100) : ""].filter(Boolean).join(" ");
  const p = Math.round(Number(v) * 100); let r = Math.floor(p / 100); const ps = p % 100;
  const parts = [], cr = Math.floor(r / 1e7); r %= 1e7; const lk = Math.floor(r / 1e5); r %= 1e5; const th = Math.floor(r / 1000), rest = r % 1000;
  if (cr) parts.push(three(cr) + " Crore"); if (lk) parts.push(two(lk) + " Lakh"); if (th) parts.push(two(th) + " Thousand"); if (rest) parts.push(three(rest));
  return "Rupees " + (parts.join(" ") || "Zero") + (ps ? " and " + two(ps) + " Paise" : "") + " Only";
}
const WORDMARK = `<div style="font-weight:800;font-size:22px;letter-spacing:-.4px;margin-bottom:6px"><span style="color:#6A1BB0">गली</span> <span style="color:#111111">Bazaar</span><span style="color:#F0287A">.</span></div>`;
function planInvoice(id) {
  const { b, st } = window._plan, v = (b.invoices || []).find(x => x.id === id); if (!v) return;
  const pc = (b.payments || []).find(x => x.id === v.claim);
  const c = { ...v, amount: v.total, paid_on: v.inv_date, utr: pc ? pc.utr : "Paid from balance", months: v.months };
  const tax = Number(c.cgst || 0) + Number(c.sgst || 0) + Number(c.igst || 0), taxable = Number(c.taxable ?? c.amount), gst = tax > 0;
  const rate = taxable ? Math.round(tax / taxable * 100) : 0, half = rate / 2, gstin = c.bill_gstin || S.gstin;
  const sac = c.sac || (c.purpose === "FEATURED" ? "998365" : (st.plan_sac || "998439"));
  const desc = c.purpose === "FEATURED" ? `Featured listing (sponsored placement) — ${c.days} days` : `Seller plan — listing &amp; order tools`;
  const m = v => "₹" + Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const row = (l, v, b) => `<tr><td>${l}</td><td style="text-align:right;${b ? "font-weight:700;font-size:16px" : ""}">${v}</td></tr>`;
  const w = window.open("", "_blank"); if (!w) { alert("Allow pop-ups to view the invoice"); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${esc(c.inv_no || "")}</title><style>
    body{font-family:Poppins,Arial,sans-serif;color:#1D0F30;margin:0;padding:32px;max-width:760px}
    .bar{height:6px;background:#6A1BB0;margin:-32px -32px 26px}.top{display:flex;justify-content:space-between;gap:20px}
    h1{font-size:20px;margin:0}.mut{color:#6B6380;font-size:12.5px;line-height:1.5}.tag{background:#6A1BB0;color:#fff;padding:8px 16px;border-radius:8px;font-weight:700;height:fit-content}
    .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:22px 0;background:#F7F4FB;border-radius:10px;padding:12px}.meta b{display:block;font-size:13px}
    table{width:100%;border-collapse:collapse}th{text-align:left;font-size:12px;color:#6B6380;border-bottom:1.5px solid #E6DEEC;padding:8px 6px}td{padding:8px 6px;font-size:13.5px;border-bottom:1px solid #F1ECF4}
    .tot{width:320px;margin-left:auto;margin-top:12px}.btn{margin-top:22px;padding:10px 18px;border:0;border-radius:99px;background:#1D0F30;color:#fff;font:inherit;cursor:pointer}
    @media print{.btn{display:none}}</style></head><body><div class="bar"></div>
    <div class="top"><div>${WORDMARK}<h1>${esc(st.biz_name || "Gali Bazaar")}</h1><div class="mut">${esc(st.biz_addr || "")}<br>${esc(st.biz_email || "")}${st.biz_gstin ? `<br><b style="color:#1D0F30">GSTIN: ${esc(st.biz_gstin)}</b>` : ""}</div></div>
      <div class="tag">${gst ? "TAX INVOICE" : "INVOICE"}</div></div>
    <div class="meta"><div><span class="mut">Invoice no</span><b>${esc(c.inv_no || "—")}</b></div><div><span class="mut">Date</span><b>${esc(c.paid_on)}</b></div>
      <div><span class="mut">UPI ref (UTR)</span><b>${esc(c.utr || "")}</b></div><div><span class="mut">Place of supply</span><b>${esc(posLabel(c.place_of_supply || S.state || ""))}</b></div></div>
    <div class="mut">Billed to</div><b>${esc(S.name)}</b><div class="mut">${esc([S.addr, S.locality, S.city, S.state, S.pin].filter(Boolean).join(", "))}${gstin ? `<br><b style="color:#1D0F30">GSTIN: ${esc(gstin)}</b>` : ""}</div>
    <table style="margin-top:18px"><thead><tr><th>Description</th><th>SAC</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody><tr><td>${desc}${c.period_from ? `<div class="mut">Period: ${esc(c.period_from)} to ${esc(c.period_to)}</div>` : ""}</td><td>${sac}</td><td style="text-align:right">${m(taxable)}</td></tr></tbody></table>
    <table class="tot">${gst ? row("Taxable value", m(taxable)) + (Number(c.igst) > 0 ? row(`IGST @ ${rate}%`, m(c.igst)) : row(`CGST @ ${half}%`, m(c.cgst)) + row(`SGST @ ${half}%`, m(c.sgst))) : ""}${row("Total received", m(c.amount), true)}</table>
    <p style="text-align:right;font-weight:600;font-size:13px;margin:8px 0 0">Amount in words: ${amtWords(c.amount)}</p>
    ${gst ? "" : `<p class="mut">Supplier not registered under GST; no GST charged.</p>`}
    <p class="mut" style="margin-top:26px">Computer-generated invoice, no signature needed.</p><button class="btn" onclick="print()">Print / Save as PDF</button></body></html>`);
  w.document.close();
}

async function support() {
  $("#main").innerHTML = head("Help & support", "Chat with the Gali Bazaar team • app not working, payment issue, anything") + `
    <div class="box" style="max-width:760px;display:flex;flex-direction:column;height:min(70vh,640px);padding:0;overflow:hidden">
      <div id="supList" style="flex:1;overflow:auto;padding:16px;background:#F7F4FB"><div class="sub">Loading…</div></div>
      <div style="display:flex;gap:8px;padding:10px;border-top:1px solid #EEE7F6;background:#fff">
        <textarea class="in" id="supIn" rows="2" maxlength="2000" placeholder="Write your problem…" style="flex:1;resize:none;margin:0" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();supSend()}"></textarea>
        <button class="btn pink" id="supBtn" onclick="supSend()">Send</button></div></div>
    <div class="sub" style="margin-top:10px">You'll get a notification in the app when we reply. Can't open the app or this website? Email <a href="mailto:support@galibazaar.site">support@galibazaar.site</a></div>`;
  clearInterval(supTimer); await supLoad(true);
  supTimer = setInterval(() => { if (route() !== "support") return clearInterval(supTimer); supLoad(); }, 4000);
}
let supLast = "";
async function supLoad(force) {
  const { data, error } = await db.from("support_messages").select("*").eq("shop", S.id).order("created_at", { ascending: false }).limit(200);
  const el = $("#supList"); if (!el) return;
  if (error) { el.innerHTML = `<div class="msg err">${esc(/relation|schema cache/.test(error.message) ? "Support chat isn't switched on yet." : niceErr(error))}</div>`; return; }
  const m = (data || []).reverse(), sig = m.length + ":" + (m.at(-1)?.id || "");
  if (!force && sig === supLast) return; supLast = sig;
  const t = x => new Date(x).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  el.innerHTML = m.length ? m.map(x => `<div style="display:flex;justify-content:${x.from_admin ? "flex-start" : "flex-end"};margin:6px 0">
      <div style="max-width:75%;padding:9px 13px;border-radius:16px;background:${x.from_admin ? "#fff" : "#1D0F30"};color:${x.from_admin ? "#1D0F30" : "#fff"};white-space:pre-wrap;word-break:break-word">
      ${x.from_admin ? `<div style="font-size:11px;font-weight:700;color:#7C3AED">Gali Bazaar support</div>` : ""}${esc(x.body)}
      <div style="font-size:10.5px;opacity:.6;text-align:right;margin-top:3px">${t(x.created_at)}${!x.from_admin && x.read_at ? " · seen" : ""}</div></div></div>`).join("")
    : `<div style="text-align:center;padding:40px 10px"><div style="font-size:38px">🛟</div><b>Tell us what's wrong</b><div class="sub">Write here and the Gali Bazaar team replies in this chat.</div></div>`;
  el.scrollTop = el.scrollHeight;
  if (m.some(x => x.from_admin && !x.read_at)) { if (!force) tone("support_reply"); db.rpc("support_mark_read", { p_shop: S.id }).then(() => {}, () => {}); }
}
async function supSend() {
  const i = $("#supIn"), b = $("#supBtn"), body = i.value.trim(); if (!body) return;
  b.disabled = true;
  const { error } = await db.from("support_messages").insert({ shop: S.id, body, sender: me.id, from_admin: false });
  b.disabled = false;
  if (error) return toast(niceErr(error));
  i.value = ""; supLoad(true);
}
