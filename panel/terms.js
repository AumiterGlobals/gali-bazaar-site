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
  /** Resolves once this person has accepted the current version for [role] (shows the sheet if needed). */
  async function gate(db, role, onSignOut) {
    const { data, error } = await db.rpc("terms_ok", { p_role: role });
    if (error || data !== false) return;   // DB not updated yet / offline → don't block
    return new Promise(res => {
      const w = document.createElement("div"); w.className = "gbt-sheet";
      w.innerHTML = `<div class="gbt-card"><h2>${esc(L.title)}</h2><p class="s">${esc(L.sub)}</p>${html(role, "gbt-gate")}<button class="go" id="gbt-go">${esc(L.btn)}</button><button class="so" id="gbt-so">${esc(L.out)}</button></div>`;
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
