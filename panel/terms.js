// Gali Bazaar — Terms checkbox + "We've updated our Terms" sheet for the web panels (update-47).
// One checkbox, never pre-ticked. Links open the legal page and do NOT tick the box; tapping the rest ticks it.
(function () {
  const LEGAL = "https://galibazaar.site/legal/";
  const HI = /^hi/i.test(navigator.language || "") || new URLSearchParams(location.search).get("lang") === "hi";
  const T = {
    en: {
      seller: "I am the owner of this shop. I agree to the [Seller Terms](#seller-terms) and [Privacy Policy](#privacy), and I am responsible for my goods, prices, licences (FSSAI/GST) and bills.",
      sales: "I agree to the [Sales Partner Terms](#sales-terms) and [Privacy Policy](#privacy).",
      rider: "I agree to the [Delivery Partner Terms](#partner-terms) and [Privacy Policy](#privacy) and will use customer details only for delivery.",
      customer: "I am 18+ and I agree to the [Terms of Use](#terms) and [Privacy Policy](#privacy).",
      tick: "Please tick to continue", title: "We've updated our Terms", sub: "Please read and accept them to continue.", btn: "Accept & continue", out: "Sign out",
    },
    hi: {
      seller: "मैं इस दुकान का मालिक हूँ। मैं [सेलर नियम](#seller-terms) और [प्राइवेसी पॉलिसी](#privacy) से सहमत हूँ, और अपने सामान, दाम, लाइसेंस (FSSAI/GST) और बिल की ज़िम्मेदारी मेरी है।",
      sales: "मैं [सेल्स पार्टनर नियम](#sales-terms) और [प्राइवेसी पॉलिसी](#privacy) से सहमत हूँ।",
      rider: "मैं [डिलीवरी पार्टनर नियम](#partner-terms) और [प्राइवेसी पॉलिसी](#privacy) से सहमत हूँ और ग्राहक की जानकारी सिर्फ़ डिलीवरी के लिए इस्तेमाल करूँगा।",
      customer: "मैं 18+ हूँ और [नियम व शर्तें](#terms) और [प्राइवेसी पॉलिसी](#privacy) से सहमत हूँ।",
      tick: "आगे बढ़ने के लिए टिक करें", title: "हमने अपने नियम अपडेट किए हैं", sub: "आगे बढ़ने के लिए कृपया नए नियम पढ़कर स्वीकार करें।", btn: "स्वीकार करें और आगे बढ़ें", out: "साइन आउट",
    },
  };
  const L = HI ? T.hi : T.en;
  const css = `.gbt{display:flex;gap:10px;align-items:flex-start;text-align:left;margin:4px 0 12px;cursor:pointer;user-select:none}
.gbt .bx{flex:none;width:22px;height:22px;border-radius:6px;border:1.5px solid #CFC4DF;background:#fff;display:grid;place-items:center;margin-top:1px;transition:background .12s}
.gbt.on .bx{background:#6A1BB0;border-color:#6A1BB0}.gbt .bx svg{display:none}.gbt.on .bx svg{display:block}
.gbt .tx{font-size:12.5px;line-height:18px;color:#6B6380}.gbt .tx a{color:#6A1BB0;font-weight:600;text-decoration:underline}
.gbt-err{display:none;color:#E5383B;font-size:12px;font-weight:600;margin:-8px 0 10px 32px;text-align:left}.gbt-err.show{display:block}
@keyframes gbtsh{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(4px)}}
.gbt.shake{animation:gbtsh .32s}
.gbt-grey{background:#CFC9D9!important;border-color:#CFC9D9!important;color:#fff!important}
.gbt-sheet{position:fixed;inset:0;z-index:9999;background:rgba(29,15,48,.55);display:flex;align-items:center;justify-content:center;padding:18px}
.gbt-card{background:#fff;border-radius:22px;max-width:440px;width:100%;padding:24px 22px;box-shadow:0 30px 80px rgba(29,15,48,.3);font-family:Poppins,system-ui,sans-serif}
.gbt-card h2{margin:0 0 6px;font-size:22px;color:#1D0F30}.gbt-card p.s{margin:0 0 18px;color:#6B6380;font-size:13.5px}
.gbt-card .go{width:100%;border:0;border-radius:99px;padding:14px;font:inherit;font-weight:600;font-size:15px;background:#1D0F30;color:#fff;cursor:pointer}
.gbt-card .so{display:block;margin:10px auto 0;background:none;border:0;color:#6B6380;font:inherit;font-size:13px;cursor:pointer}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const linkify = t => esc(t).replace(/\[(.+?)\]\((#[a-z-]+)\)/g, (_, l, a) => `<a href="${LEGAL}${HI ? "?lang=hi" : ""}${a}" target="_blank" rel="noopener">${l}</a>`);

  /** HTML for one checkbox row (+ hidden red line) */
  function html(role, id) {
    return `<div class="gbt" id="${id}" role="checkbox" aria-checked="false" tabindex="0"><span class="bx"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span class="tx">${linkify(L[role])}</span></div><div class="gbt-err" id="${id}-err">${esc(L.tick)}</div>`;
  }
  /** Wire a checkbox to a button: button is grey until ticked; a click while grey shakes + shows the red line and is blocked. */
  function bind(id, btn) {
    const el = document.getElementById(id), err = document.getElementById(id + "-err");
    const paint = () => { const on = el.classList.contains("on"); el.setAttribute("aria-checked", on); btn && btn.classList.toggle("gbt-grey", !on); if (on) err.classList.remove("show"); };
    const toggle = e => { if (e.target.closest("a")) return; el.classList.toggle("on"); paint(); };
    el.addEventListener("click", toggle);
    el.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(e); } });
    if (btn) btn.addEventListener("click", e => { if (!el.classList.contains("on")) { e.stopImmediatePropagation(); e.preventDefault(); nag(); } }, true);
    function nag() { err.classList.add("show"); el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
    paint();
    return { ok: () => el.classList.contains("on"), nag };
  }
  async function accept(db, role) {
    const { data: { session } } = await db.auth.getSession();
    const { data: s } = await db.from("settings").select("terms_version").eq("id", 1).maybeSingle();
    const { error } = await db.from("terms_acceptances").insert({ profile: session.user.id, role, version: (s && s.terms_version) || "2026-11-14", platform: "web" });
    if (error) throw error;
  }
  // ---------- update-75: sellers sign — read the Seller Terms to the end, type the KYC name, phone OTP (when switched on) ----------
  const S2 = HI ? { t: "सेलर नियम", sub: "अंत तक पढ़ें, फिर नीचे साइन करें", scroll: "आगे बढ़ने के लिए नियम अंत तक स्क्रॉल करें", name: "अपना पूरा नाम लिखें (KYC / PAN जैसा)",
      send: "OTP भेजें", otp: "6 अंकों का OTP", sign: "मैं सहमत हूँ — साइन करके स्वीकार करें", end: "— सेलर नियम समाप्त —",
      law: "यह आईटी एक्ट, 2000 (धारा 10A) के तहत आपका इलेक्ट्रॉनिक साइन है। इसकी कॉपी आपको ईमेल होगी।", app: "फ़ोन OTP के लिए कृपया Gali Bazaar ऐप में स्वीकार करें।" }
    : { t: "Seller Terms", sub: "Read to the end, then sign below", scroll: "Scroll to the end of the terms to continue", name: "Type your full name (as in KYC / PAN)",
      send: "Send OTP", otp: "6-digit OTP", sign: "I agree — sign & accept", end: "— End of the Seller Terms —",
      law: "This is your electronic signature under the IT Act, 2000 (s.10A). A copy is emailed to you.", app: "Phone OTP isn't set up on the website yet — please accept in the Gali Bazaar app." };
  const css2 = `.gbs{position:fixed;inset:0;z-index:9999;background:rgba(29,15,48,.55);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Poppins,system-ui,sans-serif}
.gbs-c{background:#fff;border-radius:22px;max-width:720px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(29,15,48,.3)}
.gbs-h{padding:20px 22px 10px}.gbs-h h2{margin:0;font-size:22px;color:#1D0F30}.gbs-h p{margin:2px 0 0;color:#6B6380;font-size:13px}
.gbs-t{flex:1;overflow:auto;margin:0 18px;padding:14px 16px;background:#FBF9FD;border:1px solid #EDE6F3;border-radius:14px;color:#3F3854;font-size:14px;line-height:1.65}
.gbs-t p{margin:0 0 8px}.gbs-t li{margin:0 0 6px 16px}.gbs-t b{color:#1D0F30}.gbs-t .e{text-align:center;color:#8E84A8;font-size:12px;margin-top:10px}
.gbs-f{padding:14px 22px 20px;display:flex;flex-direction:column;gap:10px}
.gbs-f input{padding:12px 13px;border:1px solid #E6DEEC;border-radius:12px;font:inherit;font-size:14.5px}.gbs-f input:focus{outline:none;border-color:#8B5CF6}
.gbs-f .w{color:#B26A00;font-size:12.5px;font-weight:600}.gbs-f .er{color:#E5383B;font-size:12.5px;font-weight:600}.gbs-f .lw{color:#8E84A8;font-size:11.5px}
.gbs-f button.go{border:0;border-radius:99px;padding:14px;font:inherit;font-weight:600;font-size:15px;background:#1D0F30;color:#fff;cursor:pointer}.gbs-f button.go:disabled{background:#CFC9D9}
.gbs-f button.so{background:none;border:0;color:#6B6380;font:inherit;font-size:13px;cursor:pointer}`;
  const st2 = document.createElement("style"); st2.textContent = css2; document.head.appendChild(st2);
  const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const loadJs = src => new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.append(s); });
  async function sellerSign(db, onSignOut, changes = "") {
    const [{ data: info }, terms] = await Promise.all([db.rpc("seller_terms_info"), fetch("/legal/seller-terms.json", { cache: "no-store" }).then(r => r.json()).catch(() => null)]);
    const otpOn = !!(info && info.otp), fb = info && info.firebase_web;
    return new Promise(res => {
      const w = document.createElement("div"); w.className = "gbs";
      const body = terms ? (HI ? terms.hi : terms.en).map(b => b.t === "li" ? `<li>${md(b.s)}</li>` : `<p>${md(b.s)}</p>`).join("") : `<p><a href="${LEGAL}#seller-terms" target="_blank">${esc(S2.t)}</a></p>`;
      w.innerHTML = `<div class="gbs-c"><div class="gbs-h"><h2>${esc(S2.t)}</h2><p>${esc(S2.sub)}${info && info.version ? " · v" + esc(info.version) : ""}</p></div>
        ${changes ? `<div style="padding:0 16px">${changes}</div>` : ""}<div class="gbs-t" id="gbs-t">${body}<div class="e">${esc(S2.end)}</div></div>
        <div class="gbs-f"><div class="w" id="gbs-w">${esc(S2.scroll)}</div>
          <input id="gbs-n" placeholder="${esc(S2.name)}" disabled autocomplete="name">
          ${otpOn ? (fb ? `<div id="gbs-rc"></div><input id="gbs-o" placeholder="${esc(S2.otp)} · ••••${esc(info.phone_last4 || "")}" inputmode="numeric" maxlength="6" style="display:none">` : `<div class="er">${esc(S2.app)}</div>`) : ""}
          <div class="er" id="gbs-e"></div>
          <button class="go" id="gbs-go" disabled>${esc(otpOn && fb ? S2.send + " · ••••" + (info.phone_last4 || "") : S2.sign)}</button>
          <div class="lw">${esc(S2.law)}</div><button class="so" id="gbs-so">${esc(L.out)}</button></div></div>`;
      document.body.appendChild(w);
      const t = w.querySelector("#gbs-t"), n = w.querySelector("#gbs-n"), go = w.querySelector("#gbs-go"), er = w.querySelector("#gbs-e");
      let read = false, conf = null;
      const ready = () => { go.disabled = !read || n.value.trim().length < 3 || (otpOn && !fb); };
      const onScroll = () => { if (!read && t.scrollTop + t.clientHeight >= t.scrollHeight - 24) { read = true; n.disabled = false; w.querySelector("#gbs-w").style.display = "none"; ready(); } };
      t.addEventListener("scroll", onScroll); setTimeout(onScroll, 300); n.addEventListener("input", ready);
      const device = (navigator.userAgentData && navigator.userAgentData.platform ? navigator.userAgentData.platform + " · " : "") + navigator.userAgent.slice(0, 90);
      const fail = e => { er.textContent = (e && (e.message || e.error)) || "Couldn't save — please try again"; go.disabled = false; go.textContent = otpOn && fb && conf ? S2.sign : go.textContent; };
      go.onclick = async () => {
        er.textContent = ""; go.disabled = true;
        try {
          if (!otpOn) {
            const { error } = await db.rpc("accept_seller_terms", { p_typed_name: n.value.trim(), p_scrolled: true, p_device: device, p_platform: "web" });
            if (error) throw error; w.remove(); return res();
          }
          if (!conf) {   // send the OTP (Firebase phone sign-in, invisible reCAPTCHA)
            if (!window.firebase) { await loadJs("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"); await loadJs("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"); }
            if (!firebase.apps.length) firebase.initializeApp(fb);
            const v = new firebase.auth.RecaptchaVerifier("gbs-rc", { size: "invisible" });
            conf = await firebase.auth().signInWithPhoneNumber(info.phone, v);
            w.querySelector("#gbs-o").style.display = ""; go.textContent = S2.sign; go.disabled = false; return;
          }
          const code = w.querySelector("#gbs-o").value.trim();
          const cred = await conf.confirm(code);
          const token = await cred.user.getIdToken(true);
          const { data, error } = await db.functions.invoke("push", { body: { action: "seller_terms_otp", typed_name: n.value.trim(), scrolled: true, device, platform: "web", firebase_token: token } });
          await firebase.auth().signOut().catch(() => {});
          if (error || !data || !data.ok) throw (data || error); w.remove(); res();
        } catch (e) { fail(e); }
      };
      w.querySelector("#gbs-so").onclick = async () => { await db.auth.signOut(); onSignOut ? onSignOut() : location.reload(); };
    });
  }

  /** update-93: "What changed" since this person last accepted (empty for a first acceptance). */
  async function whatsNew(db, role) {
    const { data, error } = await db.rpc("terms_whats_new", { p_role: role });
    if (error || !data || !data.length) return "";
    const names = HI ? { terms: "उपयोग की शर्तें", "seller-terms": "सेलर नियम", "partner-terms": "डिलीवरी पार्टनर नियम", "sales-terms": "सेल्स पार्टनर नियम", privacy: "प्राइवेसी पॉलिसी" }
      : { terms: "Terms of Use", "seller-terms": "Seller Terms", "partner-terms": "Delivery Partner Terms", "sales-terms": "Sales Partner Terms", privacy: "Privacy Policy" };
    const groups = {}; data.forEach(c => (groups[c.version + "|" + c.doc] = groups[c.version + "|" + c.doc] || []).push(c));
    const day = v => new Date(String(v).slice(0, 10) + "T00:00:00+05:30").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) + (String(v).length > 10 ? " · update " + (Number(String(v).split(".")[1] || 0) + 1) : "");
    return `<div class="gbw"><b>${HI ? "क्या बदला" : "What changed"}</b>${Object.entries(groups).map(([k, l]) => `<div class="gbw-h">${esc(names[k.split("|")[1]] || k.split("|")[1])} · ${esc(day(k.split("|")[0]))}</div><ul>${l.map(c => `<li>${esc(HI ? c.hi : c.en)}</li>`).join("")}</ul>`).join("")}</div>`;
  }
  const st3 = document.createElement("style");
  st3.textContent = `.gbw{background:#F4EEFF;border-radius:14px;padding:12px 14px;margin:0 0 12px;max-height:220px;overflow:auto;font-size:13px;line-height:1.5;color:#3F3854;text-align:left}.gbw>b{color:#6A1BB0;font-size:14px}.gbw-h{font-weight:600;margin-top:8px;color:#1D0F30}.gbw ul{margin:4px 0 0 18px;padding:0}`;
  document.head.appendChild(st3);

  /** Resolves once this person has accepted the current version for [role] (shows the sheet if needed). */
  async function gate(db, role, onSignOut) {
    const { data, error } = await db.rpc("terms_ok", { p_role: role });
    if (error || data !== false) return;   // DB not updated yet / offline → don't block
    const changes = await whatsNew(db, role);
    if (role === "seller") return sellerSign(db, onSignOut, changes);
    return new Promise(res => {
      const w = document.createElement("div"); w.className = "gbt-sheet";
      w.innerHTML = `<div class="gbt-card"><h2>${esc(L.title)}</h2><p class="s">${esc(L.sub)}</p>${changes}${html(role, "gbt-gate")}<button class="go" id="gbt-go">${esc(L.btn)}</button><button class="so" id="gbt-so">${esc(L.out)}</button></div>`;
      document.body.appendChild(w);
      const go = w.querySelector("#gbt-go"); bind("gbt-gate", go);
      go.onclick = async () => {
        go.disabled = true; go.textContent = "…";
        try { await accept(db, role); w.remove(); res(); }
        catch (e) { go.disabled = false; go.textContent = L.btn; alert("Couldn't save — check your internet and try again."); }
      };
      w.querySelector("#gbt-so").onclick = async () => { await db.auth.signOut(); onSignOut ? onSignOut() : location.reload(); };
    });
  }
  window.GBTerms = { LEGAL, html, bind, accept, gate };
})();
