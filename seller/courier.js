/* Seller panel — courier (spec 3, 6, 6b, 16). Gali Bazaar never books couriers: the seller books COD + open-box outside,
 * then adds the tracking here. Every rule is checked on the server; this page only shows and sends. */
const COURIER_RULES = [
  ["💵", "Pay only at the door.", "पैसा सिर्फ़ दरवाज़े पर।", "Every courier order is Cash on Delivery. The customer pays the courier only after checking the parcel.", "हर कूरियर ऑर्डर कैश ऑन डिलीवरी है। ग्राहक पार्सल जाँचने के बाद ही कूरियर को पैसा देता है।"],
  ["📦", "Open-box check.", "ओपन-बॉक्स जाँच।", "The customer opens the parcel in front of the courier. If the item is wrong, damaged, different, a wrong size/colour, or anything is missing, they can refuse the parcel and pay nothing. The parcel comes back to you (RTO) and the courier's return charge is yours.", "ग्राहक कूरियर के सामने पार्सल खोलता है। सामान ग़लत, ख़राब, अलग, ग़लत साइज़/रंग या कुछ कम हो, तो वह पार्सल लेने से मना कर सकता है और कुछ नहीं देगा। पार्सल आपके पास वापस आएगा (RTO) और कूरियर का वापसी ख़र्च आपका होगा।"],
  ["↩️", "Not accept / refuse at the door", "दरवाज़े पर लेने से मना", "for any reason before paying. The order shows “Refused at door” with the reason. Check the parcel in when it comes back.", "पैसे देने से पहले किसी भी कारण से। ऑर्डर पर \"Refused at door\" और कारण दिखेगा। पार्सल लौटने पर उसे चेक-इन करें।"],
  ["📸", "After accepting:", "लेने के बाद:", "the customer can report a problem within 48 hours of receiving, or within the return/replacement days you set on the item if longer, with photos. You must reply within 48 hours and replace, refund or explain. Items marked “At door only” can't be returned after accepting — only refused at the door.", "ग्राहक मिलने के 48 घंटे के अंदर (या सामान पर आपकी रखी रिटर्न/रिप्लेसमेंट अवधि में, अगर ज़्यादा हो) फ़ोटो के साथ शिकायत कर सकता है। आपको 48 घंटे में जवाब देकर बदलना, पैसा लौटाना या कारण बताना होगा। \"At door only\" वाला सामान लेने के बाद नहीं लौटेगा — सिर्फ़ दरवाज़े पर मना हो सकता है।"],
  ["❓", "Not received:", "नहीं मिला:", "if the parcel doesn't arrive, the customer can tap “Not received” 7 days after you ship. It goes to you and to Gali Bazaar.", "पार्सल न पहुँचे तो भेजने के 7 दिन बाद ग्राहक \"Not received\" दबा सकता है — शिकायत आपको और Gali Bazaar को जाती है।"],
  ["⏱️", "Cancel:", "कैंसिल:", "the customer can cancel free until you accept. If you don't accept within 24 hours, or don't add tracking within 1 day after your dispatch date, the order is cancelled automatically.", "आपके स्वीकार करने तक ग्राहक मुफ़्त में कैंसिल कर सकता है। आप 24 घंटे में स्वीकार न करें, या भेजने की तारीख़ के 1 दिन बाद तक ट्रैकिंग न डालें, तो ऑर्डर अपने आप कैंसिल हो जाता है।"],
  ["🧾", "Your responsibility:", "आपकी ज़िम्मेदारी:", "packing well, booking the courier as COD + open-box, adding the correct courier name and tracking number on time; the courier paying you the COD money; delays, damage, loss and return charges. Gali Bazaar does not book couriers or hold any money.", "अच्छी पैकिंग, कूरियर को COD + ओपन-बॉक्स बुक करना, सही कूरियर नाम और ट्रैकिंग नंबर समय पर डालना; कूरियर से COD का पैसा लेना; देरी, नुक़सान, गुम होना और वापसी का ख़र्च। Gali Bazaar कूरियर बुक नहीं करता और कोई पैसा नहीं रखता।"],
  ["⚠️", "Repeated problems:", "बार-बार दिक़्क़त:", "3 late or auto-cancelled courier orders in 30 days, or many refused parcels because of wrong or damaged items, can switch off courier selling for your shop.", "30 दिन में 3 देर से भेजे/अपने आप कैंसिल हुए ऑर्डर, या ग़लत/ख़राब सामान से बहुत से लौटे पार्सल — आपकी दुकान का कूरियर बंद हो सकता है।"],
];
const COURIERS = ["India Post", "DTDC", "Delhivery", "Blue Dart", "Ecom Express", "Xpressbees", "Shadowfax", "Shiprocket", "Ekart", "Professional Couriers", "Trackon", "Other"];
const trackLink = (c, a) => !a ? null : ({ "India Post": "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx", DTDC: `https://www.dtdc.in/trace.asp?strCnno=${a}`,
  Delhivery: `https://www.delhivery.com/track/package/${a}`, "Blue Dart": `https://www.bluedart.com/tracking?trackFor=0&trackNo=${a}`, "Ecom Express": `https://ecomexpress.in/tracking/?awb_field=${a}`,
  Xpressbees: `https://www.xpressbees.com/shipment/tracking?awbNo=${a}`, Shiprocket: `https://shiprocket.co/tracking/${a}`, Ekart: `https://ekartlogistics.com/shipmenttrack/${a}` })[c] || null;
let crTab = "new", crHi = false;
const rulesHtml = hi => COURIER_RULES.map(r => `<div style="display:flex;gap:10px;margin:8px 0"><span style="font-size:18px;width:28px">${r[0]}</span><div><b>${esc(hi ? r[2] : r[1])}</b> <span class="sub" style="margin:0">${esc(hi ? r[4] : r[3])}</span></div></div>`).join("");
const dayTxt = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "—";
const todayIso = () => new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(new Date(d + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);
function courier() {
  const C = D.orders.filter(o => o.delivery_type === "courier");
  const T = [["new", "New", o => o.status === "PLACED"], ["ship", "To ship", o => o.status === "ACCEPTED"], ["transit", "In transit", o => o.status === "OUT"],
    ["done", "Delivered", o => o.status === "DELIVERED"], ["rto", "Refused / RTO", o => o.refused_at || (o.status === "CANCELLED" && o.auto_cancel_reason)]];
  const cur = T.find(t => t[0] === crTab) || T[0], list = C.filter(cur[2]);
  let visits = 0; try { visits = +localStorage.getItem("gb_cr_visits") || 0; localStorage.setItem("gb_cr_visits", visits + 1); } catch (e) {}
  $("#main").innerHTML = head("📦 Courier", "You book the courier (COD + open-box) and add the tracking here",
    `<button class="btn ghost" onclick="courierRules(false)">?</button>${crTab === "ship" ? `<button class="btn ghost" onclick="trackUpload()">⇪ Tracking upload</button>` : ""}`) + `
    ${!COURIER_SHOP() ? `<div class="box" style="border:1.5px solid #F5D08A;background:#FFF7E6">Courier selling is off. Turn it on in <a href="#" onclick="go('shop');return false" style="color:#7C3AED">Shop &amp; KYC → How do you sell?</a></div>` : ""}
    <details class="box" ${visits < 3 ? "open" : ""}><summary style="cursor:pointer;font-weight:600">How courier orders work — what your customer can do</summary>${rulesHtml(false)}</details>
    <div class="bar2"><div class="fchips">${T.map(([k, l, f]) => `<button class="fchip ${crTab === k ? "on" : ""}" onclick="crTab='${k}';courier()">${l} ${C.filter(f).length}</button>`).join("")}</div></div>
    <div class="box">${list.length ? `<table><thead><tr><th>ORDER</th><th>SHIP TO</th><th class="hm">ITEMS</th><th>COD</th><th>${crTab === "ship" ? "DISPATCH" : crTab === "transit" ? "TRACKING" : "STATUS"}</th><th></th></tr></thead><tbody>${list.map(o => {
      const late = o.status === "ACCEPTED" && o.dispatch_date <= todayIso();
      const st = o.status === "ACCEPTED" ? `<b style="color:${late ? "#DC2626" : "inherit"}">${o.dispatch_date === todayIso() ? "Today" : dayTxt(o.dispatch_date)}</b>${o.dispatch_changed ? `<div class="sub" style="margin:0">changed: ${esc(o.dispatch_change_reason)}</div>` : ""}`
        : o.status === "OUT" ? `${esc(o.courier_name)}<br><b>${esc(o.awb)}</b>${o.not_received_at ? `<div style="color:#DC2626;font-size:12px">❗ Customer says not received</div>` : ""}`
        : o.refused_at ? `<span style="color:#B45309">Refused: ${esc(o.refuse_reason)}</span><div class="sub" style="margin:0">Return charge is yours. Check the parcel in when it arrives.</div>`
        : o.auto_cancel_reason ? `<span style="color:#DC2626">${esc(o.auto_cancel_reason)}</span>` : esc(o.status);
      const act = o.status === "PLACED" ? `<button class="mini" onclick="rejectOrder('${o.id}')">Reject</button><button class="mini" style="background:#16A34A;color:#fff;border-color:#16A34A" onclick="crAccept('${o.id}')">Accept</button>`
        : o.status === "ACCEPTED" ? `<button class="mini" onclick="crCopy('${o.id}')">Copy address</button><button class="mini" onclick="crSlip('${o.id}')">Packing slip</button>${o.dispatch_changed ? "" : `<button class="mini" onclick="crDate('${o.id}')">Change date</button>`}<button class="mini dk" onclick="crTrack('${o.id}')">Add tracking</button>`
        : o.status === "OUT" ? `${(o.tracking_url || trackLink(o.courier_name, o.awb)) ? `<a class="mini" target="_blank" href="${esc(o.tracking_url || trackLink(o.courier_name, o.awb))}">Track</a>` : ""}${!o.received_at && !o.refused_at ? `<button class="mini" onclick="crTrack('${o.id}')">Edit tracking</button>` : ""}`
        : o.refused_at && !o.return_checked_at ? `<button class="mini dk" onclick="checkIn('${o.id}')">Check in parcel</button>` : `<button class="mini" onclick="printBill('${o.id}')">Bill</button>`;
      return `<tr><td><b>${short(o)}</b><div class="sub" style="margin:0">${esc(o.cust_name)}</div></td><td style="max-width:240px">${esc((o.addr || "").split(",").slice(-3).join(",").trim())}</td>
        <td class="hm">${(o.items || []).reduce((a, l) => a + l.q, 0)}</td><td>${inr(o.total)}</td><td>${st}</td><td style="white-space:nowrap">${act}</td></tr>`; }).join("")}</tbody></table>`
      : `<div class="sub" style="padding:18px 0">Nothing here.</div>`}</div>`;
}
function courierRules(accept) {
  drawer(`<h2><span>${crHi ? "कूरियर ऑर्डर: ग्राहक क्या कर सकता है" : "Courier orders: what your customer can do"}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <button class="fchip" onclick="crHi=!crHi;courierRules(${accept})">${crHi ? "English" : "हिंदी"}</button>
    <div id="crl" style="max-height:52vh;overflow:auto;margin-top:8px">${rulesHtml(crHi)}</div>
    ${accept ? `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px"><input type="checkbox" id="crok" disabled style="margin-top:3px"> <span>${crHi ? "मैंने पढ़ लिया कि कूरियर ऑर्डर पर ग्राहक क्या कर सकता है, और मैं ये नियम मानता/मानती हूँ" : "I have read what customers can do on courier orders and I accept these rules"}</span></label>
      <div class="sub" id="crsc">Scroll to the end to tick</div><button class="btn pink full" id="crgo" disabled style="margin-top:8px;opacity:.5">Accept and turn courier on</button>` : ""}`, true);
  if (!accept) return;
  const l = $("#crl"), ok = $("#crok"), go = $("#crgo"), chk = () => { if (l.scrollTop + l.clientHeight >= l.scrollHeight - 20) { ok.disabled = false; $("#crsc").textContent = ""; } };
  l.onscroll = chk; chk();
  ok.onchange = () => { go.disabled = !ok.checked; go.style.opacity = ok.checked ? 1 : .5; };
  go.onclick = async () => { const { error } = await db.rpc("accept_courier_rules", { p_platform: "web" }); if (error) return toast(niceErr(error)); closeDrawer(true); await saveSell(true); };
}
// ---- "How do you sell?" (Shop & KYC) ----
function sellBox() {
  const K = KIND(), can = K.courier !== "never", m = S.delivery_mode || "local", sc = S.courier_scope || "state";
  const opt = (k, t, sub) => `<label class="row" style="border:1.5px solid ${m === k ? "#6A1BB0" : "#EEE7F6"};border-radius:14px;padding:10px 12px;margin:6px 0;cursor:${k !== "local" && !can ? "not-allowed" : "pointer"};opacity:${k !== "local" && !can ? .5 : 1}">
    <div><b>${t}</b><span>${k !== "local" && !can ? "Fresh items can't go by courier." : sub}</span></div><input type="radio" name="sm" value="${k}" ${m === k ? "checked" : ""} ${k !== "local" && !can ? "disabled" : ""} onchange="sellMode(this.value)"></label>`;
  return `<div class="box"><h3>How do you sell? <span class="sub" style="font-weight:400">Aap kaise bechte ho?</span></h3>
    ${opt("local", "🛵 Local delivery", "Your areas · slots")}${opt("courier", "📦 Courier", "You book the courier yourself")}${opt("both", "🛵 + 📦 Both", "Local areas + courier elsewhere")}
    ${S.courier_blocked ? `<div class="warnline">Courier selling is paused for your shop because of late or cancelled courier orders. Contact Gali Bazaar.</div>` : ""}
    <div id="cset" style="display:${m === "local" ? "none" : "block"}">
      <label>COURIER SENDS TO</label><select class="in" id="cs_scope"><option value="city" ${sc === "city" ? "selected" : ""}>My city</option><option value="state" ${sc === "state" ? "selected" : ""}>My state</option><option value="india" ${sc === "india" ? "selected" : ""}>All India (needs a valid GSTIN)</option></select>
      <label>CITIES (for “My city”, comma separated)</label><input class="in" id="cs_cities" value="${esc((S.courier_cities || []).join(", ") || S.city || "")}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px"><div><label>COURIER CHARGE ₹</label><input class="in" id="cs_fee" type="number" value="${S.courier_fee ?? 60}"></div>
        <div><label>FREE ABOVE ₹ (optional)</label><input class="in" id="cs_free" type="number" value="${S.courier_free_above ?? ""}"></div>
        <div><label>MINIMUM COURIER ORDER ₹ (optional)</label><input class="in" id="cs_min" type="number" value="${S.courier_min_order ?? ""}" placeholder="${S.min_order || 0}"></div>
        <div><label>SHIPS WITHIN (DAYS)</label><select class="in" id="cs_days">${[1, 2, 3].map(d => `<option ${(S.ships_within_days || 2) === d ? "selected" : ""}>${d}</option>`).join("")}</select></div></div>
      <label>DELIVERY TIME (customer ko kitne din mein milega)</label>
      <div style="display:flex;gap:8px;align-items:center"><input class="in" id="cs_dmin" type="number" min="1" max="15" style="max-width:90px" value="${S.courier_days_min ?? ""}" placeholder="3"> to
        <input class="in" id="cs_dmax" type="number" min="1" max="15" style="max-width:90px" value="${S.courier_days_max ?? ""}" placeholder="6"> days</div>
      <div class="sub">Apne courier ke hisaab se sahi din daalo. Galat din = customer cancel/refuse.</div>
      <div class="note">Gali Bazaar doesn't book couriers. Every courier order is <b>COD + Open-box</b>. <a href="#" onclick="courierRules(false);return false" style="color:#7C3AED">What customers can do →</a></div></div>
    <div class="msg" id="csm"></div><button class="btn pink" style="margin-top:10px" onclick="saveSell()">Save</button></div>`;
}
function sellMode(v) { S._mode = v; $("#cset").style.display = v === "local" ? "none" : "block"; }
async function saveSell(afterRules) {
  const mode = S._mode || S.delivery_mode || "local", v = id => $(id)?.value?.trim() ?? "", m = $("#csm");
  if (mode !== "local" && !afterRules && ((S.delivery_mode || "local") === "local" || !S.courier_rules_ok_at)) return courierRules(true);
  const patch = { delivery_mode: mode };
  if (mode !== "local") {
    const a = parseInt(v("#cs_dmin")), b = parseInt(v("#cs_dmax"));
    if (!(a >= 1 && a <= 15 && b >= a && b <= 15)) { if (m) { m.className = "msg err"; m.textContent = "Delivery time: fill both, from 1 to 15 days (From ≤ To)"; } return; }
    Object.assign(patch, { courier_days_min: a, courier_days_max: b });
  }
  if (mode !== "local") Object.assign(patch, { courier_scope: v("#cs_scope"), courier_cities: v("#cs_cities").split(",").map(x => x.trim()).filter(Boolean), courier_fee: +v("#cs_fee") || 0,
    courier_free_above: v("#cs_free") === "" ? null : +v("#cs_free"), courier_min_order: v("#cs_min") === "" ? null : +v("#cs_min"), ships_within_days: +v("#cs_days") || 2 });
  const { error } = await db.from("shops").update(patch).eq("id", S.id);
  if (error) { if (m) { m.className = "msg err"; m.textContent = niceErr(error); } else toast(niceErr(error)); return; }
  const first = (S.delivery_mode || "local") === "local" && mode !== "local";
  await loadAll(); toast(first ? "Courier selling is on. Read how open-box and refusals work in the Courier tab." : "Saved"); page();
}
// ---- actions ----
function dateOpts(from, until) { const out = []; for (let d = from; d <= until; d = addDays(d, 1)) out.push(d); return out; }
function crAccept(id) {
  const o = findO(id), ds = dateOpts(todayIso(), addDays(todayIso(), S.ships_within_days || 2));
  drawer(`<h2><span>Accept courier order ${short(o)}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <div class="note">💵 Customer pays the courier only after checking (open-box).<br>↩️ They can refuse at the door — return charges are yours.<br>⏱️ You must add tracking by your dispatch date.</div>
    <label>COURIER DISPATCH DATE</label><div class="fchips" id="dd">${ds.map(d => `<button class="fchip" data-d="${d}">${d === todayIso() ? "Today" : dayTxt(d)}</button>`).join("")}</div>
    <button class="btn pink full" id="ok" disabled style="margin-top:12px;opacity:.5">Accept</button>`);
  let sel = null; $$("#dd .fchip").forEach(b => b.onclick = () => { sel = b.dataset.d; $$("#dd .fchip").forEach(x => x.classList.toggle("on", x === b)); $("#ok").disabled = false; $("#ok").style.opacity = 1; });
  $("#ok").onclick = async () => { const { error } = await db.from("orders").update({ status: "ACCEPTED", dispatch_date: sel, log: [...(o.log || []), { s: "ACCEPTED", t: new Date().toISOString() }] }).eq("id", id);
    if (error) return toast(niceErr(error)); toast("Accepted"); closeDrawer(); await loadAll(); page(); };
}
function crDate(id) {
  const o = findO(id), acc = (o.accepted_at || new Date().toISOString()).slice(0, 10), ds = dateOpts(todayIso(), addDays(acc, S.ships_within_days || 2)).filter(d => d !== o.dispatch_date);
  drawer(`<h2><span>Change dispatch date (once)</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <div class="fchips" id="dd">${ds.map(d => `<button class="fchip" data-d="${d}">${d === todayIso() ? "Today" : dayTxt(d)}</button>`).join("") || `<span class="sub">No other date left within your “Ships within” days.</span>`}</div>
    <label>REASON</label><select class="in" id="rs"><option value="">Pick a reason</option><option>Stock arriving</option><option>Courier pickup delayed</option><option>Other</option></select>
    <div class="sub">The customer gets a message with the new date.</div><button class="btn pink full" id="ok" style="margin-top:12px">Change date</button>`);
  let sel = null; $$("#dd .fchip").forEach(b => b.onclick = () => { sel = b.dataset.d; $$("#dd .fchip").forEach(x => x.classList.toggle("on", x === b)); });
  $("#ok").onclick = async () => { if (!sel || !$("#rs").value) return toast("Pick the new date and a reason");
    const { error } = await db.from("orders").update({ dispatch_date: sel, dispatch_change_reason: $("#rs").value }).eq("id", id); if (error) return toast(niceErr(error));
    toast("Date changed"); closeDrawer(); await loadAll(); page(); };
}
function crTrack(id) {
  const o = findO(id), edit = o.status === "OUT", known = COURIERS.includes(o.courier_name);
  drawer(`<h2><span>${edit ? "Edit tracking" : "Add tracking"} · ${short(o)}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <label>COURIER COMPANY</label><select class="in" id="tc"><option value="">Pick…</option>${COURIERS.map(c => `<option ${c === (known ? o.courier_name : o.courier_name ? "Other" : "") ? "selected" : ""}>${c}</option>`).join("")}</select>
    <input class="in" id="to" placeholder="Courier name" style="display:${o.courier_name && !known ? "block" : "none"};margin-top:6px" value="${esc(known ? "" : o.courier_name || "")}">
    <label>AWB / TRACKING NO.</label><input class="in" id="ta" value="${esc(o.awb || "")}" maxlength="30" style="text-transform:uppercase" placeholder="6–30 letters / numbers">
    <label>TRACKING LINK (OPTIONAL)</label><input class="in" id="tl" value="${esc(o.tracking_url || "")}">
    <label>COD AMOUNT (LOCKED)</label><input class="in" value="${inr(o.total)}" disabled>
    ${edit ? "" : `<label>BOOKING RECEIPT PHOTO (OPTIONAL)</label><input type="file" id="tr" accept="image/*" class="in">
    <div class="note">Gali Bazaar doesn't book couriers. When you book, ask the courier for COD + Open-box delivery (the customer checks the item before paying). If the courier doesn't allow open-box, use another courier.</div>
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;text-transform:none;letter-spacing:0;color:#1D0F30"><input type="checkbox" id="tk" style="margin-top:3px"> I booked this as Cash on Delivery with Open-box delivery, and I told the courier company that the customer must open and check the parcel before paying</label>`}
    <div class="msg" id="tm"></div><button class="btn dark full" id="ok" style="margin-top:10px">${edit ? "Save tracking" : "Mark as shipped"}</button>`);
  const fill = () => { $("#to").style.display = $("#tc").value === "Other" ? "block" : "none"; const l = trackLink($("#tc").value, $("#ta").value.trim().toUpperCase()); if (l) $("#tl").value = l; };
  $("#tc").onchange = fill; $("#ta").oninput = fill;
  $("#ok").onclick = async () => {
    const name = $("#tc").value === "Other" ? $("#to").value.trim() : $("#tc").value, awb = $("#ta").value.replace(/\s/g, "").toUpperCase(), mm = $("#tm");
    const err = !name ? "Pick the courier company" : !/^[A-Z0-9/-]{6,30}$/.test(awb) ? "AWB / tracking number: 6–30 letters, numbers, - or /" : !edit && !$("#tk").checked ? "Tick that you booked it as COD with Open-box delivery" : null;
    if (err) { mm.className = "msg err"; mm.textContent = err; return; }
    const patch = { courier_name: name, awb, tracking_url: $("#tl").value.trim() || null };
    if (!edit) {
      const f = $("#tr").files[0];
      if (f) { const b = await squeeze(await loadImg(f), 1000, 80, .7), p = `${me.id}/${o.id}_courier_${Date.now()}.webp`; const up = await db.storage.from("proofs").upload(p, b, { contentType: "image/webp" }); if (!up.error) patch.courier_receipt_path = p; }
      Object.assign(patch, { openbox_confirmed: true, status: "OUT", log: [...(o.log || []), { s: "OUT", t: new Date().toISOString() }] });
    }
    const { error } = await db.from("orders").update(patch).eq("id", id);
    if (error) { mm.className = "msg err"; mm.textContent = niceErr(error); return; }
    toast(edit ? "Tracking saved" : "Marked as shipped — the customer is told"); closeDrawer(); await loadAll(); page();
  };
}
function crCopy(id) { const o = findO(id); navigator.clipboard.writeText(`${o.cust_name}\n${o.addr}\nMobile: ${o.cust_phone || ""}`).then(() => toast("Address and mobile copied"), () => toast("Couldn't copy")); }
function crSlip(id) {
  const o = findO(id), w = window.open("", "_blank");
  w.document.write(`<!doctype html><title>Packing slip ${short(o)}</title><style>@page{size:A6;margin:6mm}body{font:12px Poppins,system-ui,sans-serif;color:#111}h1{font-size:15px;margin:0}
    .b{border:1px solid #111;border-radius:6px;padding:8px;margin:6px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0;border-bottom:1px dashed #ccc}</style>
    <h1>Order ${short(o)} · COD ${inr(o.total)}</h1><div style="font-size:11px">Cash on Delivery · <b>Open-box: customer checks before paying</b></div>
    <div class="b"><b>To:</b> ${esc(o.cust_name)}<br>${esc(o.addr)}<br>Mobile: ${esc(o.cust_phone || "")}</div>
    <div class="b"><b>From:</b> ${esc(S.name)}<br>${esc([S.addr, S.locality, S.city, S.state, S.pin].filter(Boolean).join(", "))}<br>Phone: ${esc(S.phone || "")}</div>
    <table>${(o.items || []).map(l => `<tr><td>${esc(l.n)}</td><td style="text-align:right">× ${l.q}</td></tr>`).join("")}</table>
    <script>print()<\/script>`);
  w.document.close();
}
// ---- tracking upload: order_no, courier, awb, tracking_link (one tick for the whole upload) ----
function trackUpload() {
  drawer(`<h2><span>Tracking upload</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <div class="sub">CSV with columns <code>order_no, courier, awb, tracking_link</code> — one row per order. Same checks as adding tracking by hand.</div>
    <button class="btn ghost" onclick="csvDownload('gali-bazaar-tracking.csv',[['order_no','courier','awb','tracking_link'],...D.orders.filter(o=>o.delivery_type==='courier'&&o.status==='ACCEPTED').map(o=>[o.short_id,'','',''])])">⇩ CSV with your “To ship” orders</button>
    <input type="file" id="tu" accept=".csv" class="in" style="margin-top:10px">
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;text-transform:none;letter-spacing:0;color:#1D0F30;margin-top:8px"><input type="checkbox" id="tk" style="margin-top:3px"> I booked every order in this file as Cash on Delivery with Open-box delivery, and told the courier that the customer must check the parcel before paying</label>
    <div id="tur"></div><button class="btn dark full" id="ok" style="margin-top:10px">Upload</button>`, true);
  $("#ok").onclick = async () => {
    const f = $("#tu").files[0]; if (!f) return toast("Choose the CSV"); if (!$("#tk").checked) return toast("Tick the COD + Open-box confirmation");
    const rows = parseCsv((await f.text()).replace(/^﻿/, "")).filter(r => r.some(x => String(x).trim())); if (/order/i.test(rows[0]?.[0] || "")) rows.shift();
    const out = [];
    for (const [no, cour, awbRaw, link] of rows) {
      const o = D.orders.find(x => x.delivery_type === "courier" && String(x.short_id) === String(no).trim().replace(/^#/, ""));
      if (!o) { out.push(`❌ ${esc(no)}: order not found`); continue; }
      const awb = String(awbRaw || "").replace(/\s/g, "").toUpperCase();
      const { error } = await db.from("orders").update({ courier_name: String(cour || "").trim(), awb, tracking_url: String(link || "").trim() || trackLink(String(cour || "").trim(), awb),
        openbox_confirmed: true, status: "OUT", log: [...(o.log || []), { s: "OUT", t: new Date().toISOString() }] }).eq("id", o.id);
      out.push(error ? `❌ ${short(o)}: ${esc(niceErr(error))}` : `✅ ${short(o)}: shipped`);
    }
    $("#tur").innerHTML = `<div style="margin-top:10px;font-size:13px;line-height:1.7">${out.join("<br>")}</div>`; await loadAll();
  };
}
