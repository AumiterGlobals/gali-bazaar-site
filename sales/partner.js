/* Sales partner (update-52): commission popup, status strip, code card + QR, KYC + bank + UPI, payouts with PDF advice, Form 16A.
 * Every rule is checked on the server; this file only shows and sends. */
const CTYPE = (t, m) => t === "one_time" ? "One-time" : t === "period" ? `First ${m} months` : "Permanent";
const CTYPE_HI = (t, m) => t === "one_time" ? "एक बार" : t === "period" ? `पहले ${m} महीने` : "स्थायी";
const r2 = x => Math.round(x * 100) / 100;
const mny = x => "₹" + Number(x || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// worked example from the live plan price: ₹99 → GST ₹15.10 → ₹83.90 → 20% = ₹16.78
function cExample(price, gst, pct) { const after = r2(price / (1 + gst / 100)); return { price, gst: r2(price - after), after, com: r2(after * pct / 100) }; }

// ---------- 9a. "How your commission works" — every sign-in until the current text + this person's % / type is accepted ----------
function commissionText(S, hi) {
  const e = cExample(S.plan_price || 99, S.gst_rate || 18, S.pct), t = S.type, m = S.months;
  const typeLine = hi ? (t === "one_time" ? "सिर्फ़ दुकान के पहले प्लान पेमेंट पर" : t === "period" ? `दुकान जुड़ने के बाद पहले ${m} महीनों में हर प्लान पेमेंट पर` : "जब तक दुकान सब्सक्राइब्ड है, हर प्लान पेमेंट पर")
    : (t === "one_time" ? "only on the shop's first plan payment" : t === "period" ? `on every plan payment for the first ${m} months after the shop joins` : "on every plan payment while the shop stays subscribed");
  const EN = [
    [`Your commission: ${S.pct}% · ${CTYPE(t, m)}.`, ""],
    ["It is calculated on the plan amount after GST.", `Plan prices include ${S.gst_rate || 18}% GST, which goes to the government. We first take out GST, then pay ${S.pct}% of the rest.`],
    ["Example:", `a shop pays ₹${e.price} → GST ${mny(e.gst)} → amount after GST ${mny(e.after)} → your commission <b>${mny(e.com)}</b>.`],
    ["You earn only when a shop that joined with your code pays for a plan,", "and the payment is approved. No commission on customer orders, featured listings, refunds or free trials."],
    [`${CTYPE(t, m)}:`, typeLine + "."],
    ["Your code works and commission is paid only after your KYC", "(PAN, Aadhaar, selfie, bank, UPI) is approved."],
    ["Payouts:", "we pay by bank transfer or UPI to your verified account. Each payout shows the UTR, date and TDS, with a PDF you can download. TDS u/s 194H: 2% with PAN once your yearly commission crosses ₹20,000; the higher rate if PAN is missing. TDS is shown in your Form 26AS / AIS; Form 16A is given every quarter."],
    ["If a plan payment is refunded,", "its commission is cancelled, or adjusted in your next payout if it was already paid."],
    ["No referring your own shop, and no fake shops.", "These lead to blocking and loss of unpaid commission."],
    ["Gali Bazaar may change the %, type or rules with notice.", "Changes apply only to future payments, and you'll see this screen again."]];
  const HI = [
    [`आपका कमीशन: ${S.pct}% · ${CTYPE_HI(t, m)}।`, ""],
    ["कमीशन GST हटाने के बाद की रक़म पर बनता है।", `प्लान के दाम में ${S.gst_rate || 18}% GST शामिल है जो सरकार को जाता है। पहले GST हटाते हैं, फिर बाकी का ${S.pct}% देते हैं।`],
    ["उदाहरण:", `दुकान ₹${e.price} देती है → GST ${mny(e.gst)} → GST के बाद ${mny(e.after)} → आपका कमीशन <b>${mny(e.com)}</b>।`],
    ["कमाई सिर्फ़ तब, जब आपके कोड से जुड़ी दुकान प्लान ख़रीदे", "और पेमेंट अप्रूव हो। ग्राहक ऑर्डर, फ़ीचर्ड लिस्टिंग, रिफ़ंड या फ़्री ट्रायल पर कमीशन नहीं।"],
    [`${CTYPE_HI(t, m)}:`, typeLine + "।"],
    ["आपका कोड और कमीशन KYC के बाद ही", "(PAN, आधार, सेल्फ़ी, बैंक, UPI) अप्रूव होने पर चालू होता है।"],
    ["पेमेंट:", "आपके वेरिफ़ाइड खाते में बैंक ट्रांसफ़र या UPI से। हर पेमेंट पर UTR, तारीख़ और TDS, और डाउनलोड करने लायक PDF। TDS धारा 194H: साल का कमीशन ₹20,000 पार होने पर PAN के साथ 2%; PAN न हो तो ज़्यादा दर। TDS आपके Form 26AS / AIS में दिखेगा; Form 16A हर तिमाही मिलेगा।"],
    ["प्लान पेमेंट रिफ़ंड हुआ तो", "उसका कमीशन रद्द होगा, या अगर दे दिया गया था तो अगले पेमेंट में घटेगा।"],
    ["अपनी दुकान रेफ़र करना या नक़ली दुकानें मना हैं।", "ऐसा करने पर ब्लॉक और बकाया कमीशन ख़त्म।"],
    ["Gali Bazaar सूचना देकर %, प्रकार या नियम बदल सकता है।", "बदलाव सिर्फ़ आगे के पेमेंट पर लागू होंगे, और यह स्क्रीन फिर दिखेगी।"]];
  return (hi ? HI : EN).map((x, i) => `<div style="display:flex;gap:10px;margin:10px 0"><b style="color:#6A1BB0;width:22px;flex:none">${i + 1}.</b><div><b>${x[0]}</b> ${x[1]}</div></div>`).join("")
    + `<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:13px">${[[hi ? "प्लान (GST सहित)" : "Plan (incl. GST)", "₹" + e.price], [hi ? "GST हटाया" : "GST taken out", mny(e.gst)], [hi ? "GST के बाद" : "After GST", mny(e.after)], [`${hi ? "आपका कमीशन" : "Your commission"} (${S.pct}%)`, mny(e.com)]].map(r => `<tr><td style="padding:5px 0;border-bottom:1px solid #EEE7F6">${r[0]}</td><td style="text-align:right;border-bottom:1px solid #EEE7F6"><b>${r[1]}</b></td></tr>`).join("")}</table>`;
}
function commissionGate(S, onOut) {
  return new Promise(res => {
    let hi = (navigator.language || "").startsWith("hi");
    const w = document.createElement("div");
    w.style.cssText = "position:fixed;inset:0;background:rgba(29,15,48,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px";
    const draw = () => {
      w.innerHTML = `<div style="background:#fff;border-radius:22px;max-width:560px;width:100%;max-height:92vh;display:flex;flex-direction:column;padding:22px;font-family:Poppins,system-ui,sans-serif">
        <div style="display:flex;align-items:start"><div style="flex:1"><h2 style="margin:0;font-size:22px">${hi ? "आपका कमीशन कैसे बनता है" : "How your commission works"}</h2><div class="sub" style="margin:2px 0 0">${hi ? "How your commission works" : "आपका कमीशन कैसे बनता है"}</div></div>
          <button class="fchip" id="cg-l">${hi ? "English" : "हिंदी"}</button></div>
        <div style="background:#FDEBF3;border-radius:12px;padding:10px 12px;margin:12px 0;font-weight:700">${hi ? "आपका कमीशन" : "Your commission"}: ${S.pct}% · ${hi ? CTYPE_HI(S.type, S.months) : CTYPE(S.type, S.months)}</div>
        <div id="cg-b" style="overflow:auto;flex:1;font-size:13.5px;line-height:1.55;padding-right:6px">${commissionText(S, hi)}</div>
        <div id="cg-h" style="text-align:center;color:#7C3AED;font-weight:600;font-size:13px;margin:8px 0">${hi ? "पूरा पढ़ने के लिए स्क्रॉल करें ↓" : "Scroll to read all ↓"}</div>
        <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;margin-top:4px"><input type="checkbox" id="cg-t" disabled style="margin-top:3px"><span>${hi ? "मैंने कमीशन के ये नियम और" : "I have read and agree to these commission rules and the"} <a href="/legal/#sales-terms" target="_blank" style="color:#6A1BB0">${hi ? "Sales Terms पढ़ लिए हैं और मानता/मानती हूँ" : "Sales Terms"}</a></span></label>
        <button class="btn pink full" id="cg-go" disabled style="margin-top:12px;opacity:.5">${hi ? "स्वीकार करें और आगे बढ़ें" : "Accept & continue"}</button>
        <button class="btn ghost full" id="cg-so" style="margin-top:8px">${hi ? "साइन आउट" : "Sign out"}</button></div>`;
      const b = w.querySelector("#cg-b"), t = w.querySelector("#cg-t"), go = w.querySelector("#cg-go");
      const chk = () => { if (b.scrollTop + b.clientHeight >= b.scrollHeight - 12) { t.disabled = false; w.querySelector("#cg-h").textContent = ""; } };
      b.onscroll = chk; setTimeout(chk, 50);
      t.onchange = () => { go.disabled = !t.checked; go.style.opacity = t.checked ? 1 : .5; };
      go.onclick = async () => { go.disabled = true; const { error } = await db.rpc("accept_commission", { p_platform: "web" }); if (error) { toast(niceErr(error)); go.disabled = false; return; } w.remove(); res(); };
      w.querySelector("#cg-so").onclick = onOut;
      w.querySelector("#cg-l").onclick = () => { hi = !hi; draw(); };
    };
    draw(); document.body.appendChild(w);
  });
}

// ---------- status strip + code card ----------
function statusStrip(S) {
  const steps = ["Applied", "Approved", "KYC", "Active"], n = S.status === "active" ? 4 : S.kyc === "PENDING" ? 3 : 2;
  return `<div class="box" style="padding:14px 16px"><div style="display:flex;gap:6px">${steps.map((l, i) => `<div style="flex:1"><div style="height:5px;border-radius:5px;background:${i < n ? "#6A1BB0" : "#EEE7F6"}"></div><div style="font-size:12px;margin-top:4px;color:${i < n ? "#1D0F30" : "#8E84A8"};font-weight:${i === n - 1 ? 700 : 400}">${l}</div></div>`).join("")}</div>
    <div style="margin-top:10px;font-weight:600">Your commission: ${S.pct}% · ${CTYPE(S.type, S.months)} <span class="sub" style="margin:0;font-weight:400">· of each plan amount after GST</span></div>
    ${S.status === "blocked" ? `<div class="warnline">Your sales account is blocked. Contact the Gali Bazaar admin.</div>` : ""}</div>`;
}
const refLink = code => `https://galibazaar.site/r/${encodeURIComponent(code)}`;
function shareShopsMsg(code) { return `🛍️ Apni dukaan ko Gali Bazaar pe laao — 0% commission, apne mohalle ke customers.\nApp kholke *Register your shop* mein mera code daalo: *${code}*\n${refLink(code)}`; }
function shareCustMsg() { return `🛒 Order from your gali's shops on Gali Bazaar — groceries, sweets, food & more, delivered from shops near you.\nDownload: https://galibazaar.site/`; }
function codeCard(S) {
  const on = S.code_active, letters = String(S.code).split("");
  const tiles = letters.map(c => `<span style="display:inline-flex;width:34px;height:44px;align-items:center;justify-content:center;border-radius:10px;font-weight:800;font-size:22px;${on ? "background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);color:#fff" : "background:#fff;border:1px solid #E6E1EF;color:#C4BCD6"}">${esc(c)}</span>`).join("");
  return `<div class="grid2">
    <div class="box" style="${on ? "background:linear-gradient(135deg,#6A1BB0,#C026D3);color:#fff;border:0" : "border:1.5px dashed #D8D0E6;background:#FAF8FD"}">
      <div style="font-size:12px;letter-spacing:1.5px;font-weight:700;opacity:.85">YOUR CODE</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin:12px 0">${tiles}</div>
      ${on ? `<div style="display:flex;justify-content:space-between;font-size:13px;opacity:.9"><span>✓ Active · ${S.pct}% · ${CTYPE(S.type, S.months)}</span><span>${S.shops} shop${S.shops === 1 ? "" : "s"} joined</span></div>
        <div style="display:flex;gap:10px;margin-top:14px"><button class="btn" style="background:#fff;color:#6A1BB0;flex:1" onclick="copyCode()">⧉ Copy</button>
        <a class="btn" style="background:#22C55E;color:#fff;flex:1;text-align:center" target="_blank" href="https://wa.me/?text=${encodeURIComponent(shareShopsMsg(S.code))}">Share with shops</a></div>`
      : `<div style="color:#B45309;font-weight:600">🔒 Not active yet — complete your KYC</div><button class="btn pink full" style="margin-top:12px" onclick="go('kyc')">Complete KYC</button>`}</div>
    ${on ? `<div class="box" style="display:flex;gap:14px;align-items:center"><div id="qr" style="width:150px;height:150px;flex:none"></div><div><b>Show this QR</b><div class="sub">Shop owner scans it → app opens “Register your shop” with your code filled in.</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><a class="mini" target="_blank" href="https://wa.me/?text=${encodeURIComponent(shareCustMsg())}">Share app with customers</a><a class="mini" href="/help/sales-guide/#commission">How commission works</a></div></div></div>`
      : `<div class="box"><b>Before KYC</b><div class="sub">Shops can't use your code yet. If a shop types it, they see “Code not active yet”. Commission starts only after KYC is approved.</div></div>`}</div>`;
}
async function drawQr(code) {
  const el = document.getElementById("qr"); if (!el) return;
  if (!window.qrcode) await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "/lib/qrcode.js"; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }).catch(() => null);
  if (!window.qrcode) return;
  const q = qrcode(0, "M"); q.addData(refLink(code)); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0 }); el.firstChild.setAttribute("width", "150"); el.firstChild.setAttribute("height", "150");
}

// ---------- KYC + bank + UPI ----------
let KY = { files: {} };
async function ifscLookup(code) { try { const r = await fetch(`https://ifsc.razorpay.com/${code}`); if (!r.ok) return null; return await r.json(); } catch (e) { return null; } }
async function kycPage() {
  const S = D.sum, bank = (await db.rpc("my_sales_bank")).data;
  if (S.kyc === "APPROVED") {
    $("#main").innerHTML = head("KYC & bank", "Your verified details") + `<div class="box" style="max-width:680px">
      <div class="okline">✓ KYC approved — your code ${esc(S.code)} is active</div>
      ${bank ? [["Account holder", bank.holder], ["Account", bank.masked + " · " + bank.acct_type], ["IFSC", `${bank.ifsc}${bank.bank_name ? " · " + bank.bank_name : ""}${bank.branch ? " · " + bank.branch : ""}`], ["UPI", me.upi || "—"], ["Status", bank.status === "approved" ? "Approved" : bank.status === "pending" ? "Bank details under review — payouts on hold" : "Rejected — add the details again"]]
        .map(([k, v]) => `<div class="row"><div><b>${k}</b><span>${esc(v)}</span></div></div>`).join("") : ""}
      ${S.kyc_reason && S.bank_hold ? `<div class="warnline">${esc(S.kyc_reason)}</div>` : ""}
      <button class="btn dark" style="margin-top:12px" onclick="bankForm(true)">Change bank details</button></div>`;
    return;
  }
  if (S.kyc === "PENDING") { $("#main").innerHTML = head("KYC & bank", "") + `<div class="box" style="max-width:680px"><h3>⏳ Under review</h3><div class="sub">We're checking your KYC. You'll get a message and an email. Usually 1–2 days.</div></div>`; return; }
  bankForm(false);
}
function upField(k, label) { const v = KY.files[k]; return `<div class="row" style="border:1px solid #EEE7F6;border-radius:12px;padding:10px 12px;margin:6px 0"><div><b>${label}</b><span>${v ? "✓ Added" : k === "selfie" ? "Camera only" : "Photo or scan"}</span></div><button class="mini ${v ? "" : "dk"}" onclick="${k === "selfie" ? "selfieCam()" : `pickDoc('${k}')`}">${v ? "Change" : k === "selfie" ? "Take selfie" : "Upload"}</button></div>`; }
function bankForm(change) {
  const S = D.sum;
  $("#main").innerHTML = head(change ? "Change bank details" : "Complete your KYC", change ? "Payouts wait until the admin checks the new account" : "") + `<div class="box" style="max-width:720px">
    ${change ? `<div class="warnline">Changing bank details puts payouts on hold until we re-approve them. We'll email you about this change.</div>`
      : `<div class="note" style="background:#FFF7E6">Your code <b>${esc(S.code)}</b> starts working after KYC is approved.${S.kyc === "REJECTED" && S.kyc_reason ? `<br><b>Fix needed:</b> ${esc(S.kyc_reason)}` : ""}</div>
    <h3 style="margin-top:14px">IDENTITY</h3>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:0 12px"><div><label>NAME AS ON PAN</label><input class="in" id="k_pn" value="${esc(me.pan_name || me.name || "")}"></div>
      <div><label>PAN</label><input class="in" id="k_pan" maxlength="10" style="text-transform:uppercase" value="${esc(me.pan || "")}"></div></div>
    ${upField("pan", "🪪 PAN card")}${upField("aadhaar_front", "Aadhaar front (masked)")}${upField("aadhaar_back", "Aadhaar back (masked)")}
    <label>AADHAAR — LAST 4 DIGITS ONLY</label><input class="in" id="k_a4" maxlength="4" inputmode="numeric" style="max-width:140px" value="${esc(me.aadhaar_last4 || "")}">
    <div class="sub">The full Aadhaar number is never stored. Cover the first 8 digits on the photo if you can.</div>
    ${upField("selfie", "🤳 Live selfie")}
    <h3 style="margin-top:14px">ADDRESS</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px"><div><label>HOUSE / STREET</label><input class="in" id="k_h" value="${esc(me.house || "")}"></div><div><label>AREA</label><input class="in" id="k_ar" value="${esc(me.area || "")}"></div>
      <div><label>CITY</label><input class="in" id="k_c" value="${esc(me.city || "")}"></div><div><label>STATE</label><input class="in" id="k_s" value="${esc(me.state || "")}"></div><div><label>PIN</label><input class="in" id="k_p" maxlength="6" inputmode="numeric" value="${esc(me.pin || "")}"></div></div>`}
    <h3 style="margin-top:14px">BANK ACCOUNT</h3>
    <label>ACCOUNT HOLDER (SAME AS PAN)</label><input class="in" id="b_h" style="text-transform:uppercase" value="${esc((me.pan_name || me.name || "").toUpperCase())}"><div id="b_hw"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px"><div><label>ACCOUNT NO.</label><input class="in" id="b_a" inputmode="numeric" autocomplete="off"></div><div><label>ACCOUNT NO. AGAIN</label><input class="in" id="b_a2" inputmode="numeric" autocomplete="off"></div>
      <div><label>IFSC</label><input class="in" id="b_i" maxlength="11" style="text-transform:uppercase"></div><div><label>ACCOUNT TYPE</label><select class="in" id="b_t"><option>Savings</option><option>Current</option></select></div></div>
    <div class="sub" id="b_bn"></div>
    ${upField("cheque", "🧾 Cancelled cheque / passbook first page")}
    <div class="sub">Must show your name, account number and IFSC.</div>
    <label>UPI ID</label><input class="in" id="k_upi" value="${esc(me.upi || "")}" placeholder="name@bank"><div class="sub">Enter the UPI linked to the same bank account if possible.</div>
    ${change ? "" : `<label>GSTIN (OPTIONAL — only if you are GST registered)</label><input class="in" id="k_g" maxlength="15" style="text-transform:uppercase" value="${esc(me.gstin || "")}">
    <div class="sub" style="margin-top:12px">By submitting, you allow Gali Bazaar to verify your PAN, Aadhaar, selfie and bank details.</div>`}
    <div class="msg" id="km"></div><button class="btn pink full" id="k_go" style="margin-top:10px;padding:14px">${change ? "Save new bank details" : "Submit KYC"}</button>${change ? `<button class="btn ghost full" style="margin-top:8px" onclick="go('kyc')">Cancel</button>` : ""}</div>`;
  let bankName = null, branch = null;
  $("#b_i").oninput = async () => { const v = $("#b_i").value.trim().toUpperCase(); $("#b_bn").textContent = ""; bankName = branch = null;
    if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v)) { const r = await ifscLookup(v); if (r) { bankName = r.BANK; branch = r.BRANCH; $("#b_bn").textContent = `${r.BANK} · ${r.BRANCH} ✓`; } else $("#b_bn").textContent = "Bank not found for this IFSC — check it"; } };
  const nameChk = () => { const pn = ($("#k_pn")?.value || me.pan_name || "").toUpperCase().replace(/[^A-Z]/g, ""), h = $("#b_h").value.toUpperCase().replace(/[^A-Z]/g, "");
    $("#b_hw").innerHTML = pn && h && pn !== h ? `<div class="warnline">Account holder name doesn't match the PAN name — it must be your own account.</div>` : ""; };
  $("#b_h").oninput = nameChk; if ($("#k_pn")) $("#k_pn").oninput = nameChk;
  $("#k_go").onclick = async () => {
    const m = $("#km"), v = id => ($(id)?.value || "").trim();
    const bank = { holder: v("#b_h").toUpperCase(), account: v("#b_a").replace(/\D/g, ""), account2: v("#b_a2").replace(/\D/g, ""), ifsc: v("#b_i").toUpperCase(), acct_type: v("#b_t"), proof: KY.files.cheque || "", bank_name: bankName, branch };
    const err = !/^[0-9]{9,18}$/.test(bank.account) ? "Account number: 9–18 digits" : bank.account !== bank.account2 ? "The two account numbers don't match" : !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifsc) ? "IFSC: 11 characters, like SBIN0001234"
      : !bank.proof ? "Add a photo of a cancelled cheque or the passbook" : !/^[a-z0-9._-]{2,64}@[a-z][a-z0-9.-]{1,63}$/i.test(v("#k_upi")) ? "UPI ID looks wrong — like name@bank" : null;
    if (err) { m.className = "msg err"; m.textContent = err; return; }
    $("#k_go").disabled = true;
    const { error } = change ? await db.rpc("sales_change_bank", { p: { ...bank, upi: v("#k_upi") } })
      : await db.rpc("sales_submit_kyc", { p: { pan_name: v("#k_pn"), pan: v("#k_pan").toUpperCase(), aadhaar_last4: v("#k_a4"), files: { pan: KY.files.pan, aadhaar_front: KY.files.aadhaar_front, aadhaar_back: KY.files.aadhaar_back, selfie: KY.files.selfie, cheque: KY.files.cheque },
          report: { platform: "web", name_match: v("#k_pn").toUpperCase().replace(/[^A-Z]/g, "") === bank.holder.replace(/[^A-Z]/g, "") },
          house: v("#k_h"), area: v("#k_ar"), city: v("#k_c"), state: v("#k_s"), pin: v("#k_p"), upi: v("#k_upi"), gstin: v("#k_g").toUpperCase(), bank } });
    $("#k_go").disabled = false;
    if (error) { m.className = "msg err"; m.textContent = niceErr(error); return; }
    toast(change ? "Saved — payouts wait until we check it" : "KYC submitted"); KY = { files: {} }; me = null; render();
  };
}
async function upKyc(k, blob) {
  const { data: { session } } = await db.auth.getSession();
  const p = `${session.user.id}/sales_${k}_${Date.now()}.jpg`;
  const { error } = await db.storage.from("kyc").upload(p, blob, { contentType: "image/jpeg" });
  if (error) { toast(niceErr(error)); return; }
  KY.files[k] = p; const keep = [...document.querySelectorAll("#main input")].map(i => [i.id, i.value]); bankForm(D.sum.kyc === "APPROVED"); keep.forEach(([id, v]) => { const el = document.getElementById(id); if (el && v) el.value = v; });
}
async function shrinkImg(file, max = 1600, q = .82) { const im = await createImageBitmap(file); const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = im.width * s; c.height = im.height * s; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return await new Promise(r => c.toBlob(r, "image/jpeg", q)); }
function pickDoc(k) { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = async () => { if (i.files[0]) upKyc(k, await shrinkImg(i.files[0])); }; i.click(); }
async function selfieCam() {
  let st; try { st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }); } catch (e) { return toast("Allow the camera to take a live selfie"); }
  const w = document.createElement("div"); w.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px";
  w.innerHTML = `<video autoplay playsinline style="max-width:90vw;max-height:70vh;border-radius:16px;transform:scaleX(-1)"></video><div><button class="btn pink" id="sn">Take selfie</button> <button class="btn ghost" id="sx" style="background:#fff">Cancel</button></div>`;
  document.body.appendChild(w); const v = w.querySelector("video"); v.srcObject = st;
  const stop = () => { st.getTracks().forEach(t => t.stop()); w.remove(); };
  w.querySelector("#sx").onclick = stop;
  w.querySelector("#sn").onclick = async () => { const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0); const b = await new Promise(r => c.toBlob(r, "image/jpeg", .85)); stop(); upKyc("selfie", b); };
}

// ---------- payouts: year summary, each payout with UTR + PDF, Form 16A ----------
async function payoutsPage() {
  const S = D.sum, f16 = (await db.from("form16a").select("*").eq("sales", me.id).order("fy", { ascending: false })).data || [];
  const name = id => D.shops.find(s => s.id === id)?.name || "Shop";
  $("#main").innerHTML = head("Payouts", "Every payout with UTR, TDS and a PDF advice") + `
    <div class="box" style="background:linear-gradient(135deg,#4C1D95,#7C3AED 60%,#BE185D);color:#fff;border:0"><div style="font-weight:700;opacity:.85">FY ${esc(S.fy)}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:8px">${[["Earned", S.earned], ["TDS", S.tds], ["Received", S.received], ["Due", S.due]].map(([k, v]) => `<div><div style="font-size:12px;opacity:.8">${k}</div><b style="font-size:20px">${mny(v)}</b></div>`).join("")}</div></div>
    ${S.bank_hold ? `<div class="warnline">Bank details under review — payouts are on hold until we check them.</div>` : ""}
    <div class="box">${D.pay.length ? D.pay.map(p => `<div class="row" style="align-items:flex-start"><div style="flex:1"><b>${dmyy(p.pdate)}</b> <span class="sub" style="margin:0">${esc(p.advice_no || "")}</span>
        <span>Gross ${mny(p.gross)} · TDS ${mny(p.tds)} · ${esc(p.mode || "—")}<br>UTR ${esc(p.utr || p.ref || "—")}</span>
        <a href="#" style="color:#6A1BB0;font-size:13px;font-weight:600" onclick="poDetails('${p.id}');return false">View details</a><div id="pd_${p.id}"></div></div>
        <div style="text-align:right"><b style="color:#16A34A">Net ${mny(p.net)}</b><br><button class="btn pink" style="margin-top:8px;padding:8px 14px" onclick="advicePdf('${p.id}')">⇩ PDF</button></div></div>`).join("")
      : `<div class="sub">No payouts yet.</div>`}</div>
    <div class="box"><h3>Form 16A</h3>${f16.length ? f16.map(f => `<div class="row"><div><b>📄 Form 16A — Q${f.quarter} FY ${esc(f.fy)}</b></div><a href="#" style="color:#6A1BB0;font-weight:600" onclick="f16dl('${esc(f.path)}');return false">Download</a></div>`).join("") : `<div class="sub">Form 16A is added every quarter after TDS is deducted.</div>`}</div>
    <div class="box"><h3>Commission entries</h3>${D.com.length ? `<table><thead><tr><th>DATE</th><th>SHOP</th><th class="hm">PLAN · AFTER GST</th><th>%</th><th>AMOUNT</th><th></th></tr></thead><tbody>${D.com.map(c => `<tr>
        <td>${dmy(c.created_at)}</td><td><b>${esc(name(c.shop))}</b>${c.kind === "ADJUST" ? `<div class="sub" style="margin:0">Refund adjustment</div>` : ""}</td><td class="hm">${c.plan_amount != null ? mny(c.plan_amount) + " · " + mny(c.taxable) : inr(c.base_amount)}</td><td>${c.pct}%</td>
        <td><b>${mny(c.amount)}</b></td><td><span class="pill ${c.status === "PAID" ? "grey" : c.status === "CANCELLED" ? "bad" : "warn"}">${c.status}</span></td></tr>`).join("")}</tbody></table>` : `<div class="sub">No commission yet.</div>`}</div>`;
}
async function poDetails(id) {
  const el = document.getElementById("pd_" + id); if (el.innerHTML) { el.innerHTML = ""; return; }
  const { data, error } = await db.rpc("payout_advice", { p_payout: id }); if (error) return toast(niceErr(error));
  el.innerHTML = `<table style="margin-top:6px;font-size:12.5px"><tr><th>Shop</th><th>Date</th><th>Plan</th><th>GST</th><th>After</th><th>%</th><th>Comm</th></tr>${data.lines.map(l => `<tr><td>${esc(l.shop || "—")}</td><td>${dmy(l.date)}</td><td>${mny(l.plan)}</td><td>${mny(l.gst)}</td><td>${mny(l.after)}</td><td>${l.pct}</td><td>${mny(l.amount)}</td></tr>`).join("")}</table>`;
}
async function f16dl(path) { const { data } = await db.storage.from("form16a").createSignedUrl(path, 600); if (data?.signedUrl) window.open(data.signedUrl); else toast("Couldn't open the file"); }

// Payout advice PDF — made on demand from the server data (nothing stored)
async function loadJsPdf() { if (window.jspdf) return; await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "/lib/jspdf.umd.min.js"; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
async function advicePdf(id, dbc) {
  const { data: a, error } = await (dbc || db).rpc("payout_advice", { p_payout: id }); if (error) return toast(niceErr(error));
  try { await loadJsPdf(); } catch (e) { return toast("Couldn't load the PDF maker — check your internet"); }
  const doc = new jspdf.jsPDF({ unit: "pt", format: "a4" }), L = 40, R = 555; let y = 54;
  const rs = n => "Rs " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.setFillColor(106, 27, 176); doc.rect(0, 0, 595, 6, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(106, 27, 176); doc.text("Gali", L, y); let x = L + doc.getTextWidth("Gali ");
  doc.setTextColor(17, 17, 17); doc.text("Bazaar", x, y); x += doc.getTextWidth("Bazaar"); doc.setTextColor(240, 40, 122); doc.text(".", x, y);
  doc.setTextColor(17, 17, 17); doc.setFontSize(13); doc.text("COMMISSION PAYOUT ADVICE", R, y - 6, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(110, 99, 128); doc.text(`${a.advice_no} · ${a.date}`, R, y + 8, { align: "right" });
  y += 24; doc.setFontSize(8.5);
  doc.text(doc.splitTextToSize(`${a.operator.name || ""} · GSTIN ${a.operator.gstin || ""} · ${a.operator.addr || ""}`, R - L), L, y); y += 30;
  doc.setFillColor(246, 242, 251); doc.roundedRect(L, y, R - L, 54, 6, 6, "F"); doc.setTextColor(17, 17, 17); doc.setFontSize(10);
  doc.setFont("helvetica", "bold"); doc.text("Paid to:", L + 10, y + 18); doc.setFont("helvetica", "normal");
  doc.text(`${a.payee.name} · Code ${a.payee.code} · PAN ${a.payee.pan || "not given"}`, L + 55, y + 18);
  doc.text(a.payee.bank ? `Bank: ${a.payee.bank}` : `UPI: ${a.payee.upi || "—"}`, L + 10, y + 36); y += 74;
  const cols = [["Shop", L], ["Date", 190], ["Plan", 300], ["GST", 360], ["After GST", 425], ["%", 470], ["Commission", R]];
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(110, 99, 128);
  cols.forEach(([t, cx], i) => doc.text(t, cx, y, i >= 2 ? { align: "right" } : {})); y += 6; doc.setDrawColor(230, 225, 239); doc.line(L, y, R, y); y += 14;
  doc.setFont("helvetica", "normal"); doc.setTextColor(17, 17, 17);
  for (const l of a.lines) {
    if (y > 740) { doc.addPage(); y = 50; }
    const vals = [String(l.shop || "—").slice(0, 26) + (l.kind === "ADJUST" ? " (refund adj.)" : ""), String(l.date || ""), rs(l.plan), rs(l.gst), rs(l.after), String(l.pct), rs(l.amount)];
    cols.forEach(([, cx], i) => doc.text(vals[i], cx, y, i >= 2 ? { align: "right" } : {})); y += 16;
  }
  y += 4; doc.line(L, y, R, y); y += 20;
  const tot = (k, v, b) => { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(b ? 12 : 10); doc.text(k, 300, y); doc.text(v, R, y, { align: "right" }); y += b ? 20 : 16; };
  tot("Gross commission", rs(a.gross)); tot(Number(a.tds) > 0 ? `TDS u/s 194H @ ${a.tds_rate || ""}%` : "TDS (below Rs 20,000 a year)", "- " + rs(a.tds)); tot("Net paid", rs(a.net), true);
  y += 6; doc.setFillColor(232, 248, 239); doc.roundedRect(L, y, R - L, 28, 6, 6, "F"); doc.setFontSize(10); doc.setFont("helvetica", "bold");
  doc.text(`Payment: ${a.mode || "—"} · UTR ${a.utr || "—"} · ${a.date}`, L + 10, y + 18); y += 48;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(110, 99, 128);
  doc.text(doc.splitTextToSize("TDS deducted will be deposited with the Income Tax Department and will appear in your Form 26AS / AIS. Form 16A is issued quarterly. This is a computer-generated advice.", R - L), L, y);
  doc.save(`${String(a.advice_no).replace(/\//g, "-")}.pdf`);
}
