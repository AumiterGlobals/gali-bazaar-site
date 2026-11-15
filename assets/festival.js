// Gali Bazaar — festival theme for the website (same as the app; Themes.kt FEST_THEMES + ALIAS, Api.festivalNow()).
// Rule: festivals.active is not false and the festival day (India date) is today … today + 2 — the first one wins.
// Controlled only by the admin's festival switch (Admin → Festivals): no separate website setting.
// Not on legal pages, /pay, admin, printed invoices / notes or emails. Preview any theme with ?fest=diwali (nothing is saved).
(function () {
  "use strict";
  var P = location.pathname;
  if (/^\/(legal|terms|privacy|refund-policy|delivery-policy|disclaimer|pay|admin)(\/|$)/.test(P)) return;

  var T = {   // key: [top, mid, low, accent, greeting, deco, scene]
    diwali:     ["#320847", "#3D0A43", "#61104A", "#FA9D00", "शुभ दीपावली ✨", "🪔✨🎆🪔", "lights"],
    holi:       ["#FFF8EE", "#FFF8EE", "#FFF4EC", "#E135AB", "Bura na mano, Holi hai! 🎨", "🎨💦🌈🎉", "colors"],
    eid:        ["#0F3B44", "#0C4A57", "#0D625F", "#0D726A", "Eid Mubarak 🌙", "🌙✨🕌🌙", "moon"],
    christmas:  ["#850C15", "#9C0F22", "#BF282F", "#CC2129", "Merry Christmas 🎄", "🎄🎅❄️🎁", "snow"],
    navratri:   ["#B80441", "#BB0D4A", "#E32354", "#E12F49", "Shubh Navratri 🌺", "🪔🌺🌼🏹", "flowers"],
    ganesh:     ["#FC8B00", "#EC7C00", "#E7660B", "#F17708", "Ganpati Bappa Morya 🙏", "🌺🪔🌼🌺", "flowers"],
    india:      ["#FFFEFC", "#FBFFFF", "#FFFAF4", "#C99528", "Jai Hind 🇮🇳", "🇮🇳🎈🇮🇳", "flag"],
    sankranti:  ["#58C6F7", "#6ECDF9", "#9ADCFC", "#F97417", "Happy Sankranti 🪁", "🪁🌾🔥🪁", "kites"],
    rakhi:      ["#FC85AF", "#FA7499", "#E6588A", "#E05085", "Happy Raksha Bandhan 💛", "🧵🎁🍬💝", "flowers"],
    chhath:     ["#FE794E", "#FE8B70", "#E17FA5", "#E26249", "Chhath Puja ki shubhkamnayein 🌅", "🌅🪔🌾🪷", "sunset"],
    igas:       ["#0E1235", "#141941", "#28365D", "#F27E03", "Igas Bagwal ki bhaut badhai 🔥", "🔥🪔✨🔥", "lights"],
    phooldei:   ["#C4E2FC", "#DAEDFC", "#90AACD", "#D22D29", "Phool Dei, chhammaa Dei 🌸", "🌸🌼🌺🌸", "flowers"],
    harela:     ["#1F6624", "#26722A", "#398A3D", "#3A923E", "Harela ki shubhkamnayein 🌱", "🌱🌿🌳🌱", "leaves"],
    ghughutiya: ["#FEE5BD", "#FFF0D9", "#C5CAE8", "#7F6157", "Kale kauva kale! Uttarayani ki badhai", "🐦‍⬛🌾🍯🐦‍⬛", "sunset"]
  };
  var ALIAS = { independence: "india", republic: "india", newyear: "christmas", xmas: "christmas", lohri: "sankranti", pongal: "sankranti",
    janmashtami: "ganesh", durga: "navratri", uttarayani: "ghughutiya" };

  var SB = "https://airbbnopqgubftqjzkjr.supabase.co", KEY = "sb_publishable_fImHal0lfTgi_3jCJ9w67Q_6-JB4US1";
  var istDay = function (plus) { return new Date(Date.now() + 19800000 + (plus || 0) * 864e5).toISOString().slice(0, 10); };
  var today = istDay(0), CK = "gb_fest_" + today;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
                set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var HI = document.documentElement.lang === "hi" || /[?&]lang=hi/.test(location.search);

  function lum(hex) { var n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---- 1) which festival (cached for the day; ?fest= preview) ----
  var q = new URLSearchParams(location.search).get("fest");
  var fest = null;
  if (q) fest = { name: q.charAt(0).toUpperCase() + q.slice(1), theme: q, day: today, greeting: null, preview: true };
  else { var c = store.get(CK); if (c) { try { var o = JSON.parse(c); fest = o.f || null; } catch (e) {} } }

  // ---- 2) apply the colours at once (the script is in <head>: no flash of the plain look) ----
  function look(f) { var k = T[f.theme] ? f.theme : ALIAS[f.theme]; return k ? { key: k, t: T[k] } : null; }
  function vars(f) {
    var L = look(f), r = document.documentElement;
    r.classList.add("gbf-has");
    if (!L) return null;   // unknown theme: greeting strip only
    var t = L.t, dark = lum(t[1]) < .45;   // same test as the app (FestTheme.darkHeader)
    r.classList.add("gbf-on"); if (dark) r.classList.add("gbf-dark");
    r.setAttribute("data-fest", L.key);
    r.style.setProperty("--fest-top", t[0]); r.style.setProperty("--fest-mid", t[1]); r.style.setProperty("--fest-low", t[2]);
    r.style.setProperty("--fest-accent", t[3]); r.style.setProperty("--fest-ink", dark ? "#FFFFFF" : "#1A1130");
    return L;
  }
  if (fest) vars(fest);

  // ---- 3) light SVG scenes (drawn, no images) ----
  function scene(s, t) {
    var a = t[3], i, out = "";
    var rnd = (function () { var x = 7; return function () { x = (x * 9301 + 49297) % 233280; return x / 233280; }; })();
    if (s === "lights") { for (i = 0; i < 26; i++) out += '<circle class="tw" cx="' + (rnd() * 1200).toFixed(0) + '" cy="' + (rnd() * 260).toFixed(0) + '" r="' + (1 + rnd() * 2.2).toFixed(1) + '" fill="#FFE29A"/>';
      for (i = 0; i < 9; i++) { var x = 140 + i * 120; out += '<path d="M' + (x - 22) + ' 470 q22 26 44 0 z" fill="#C9692A"/><path class="tw" d="M' + x + ' 468 q-7 -14 0 -28 q7 14 0 28z" fill="' + a + '"/>'; } }
    else if (s === "colors") { var cs = ["#FF3682", "#37C684", "#FFC21A", "#3BA9FF", "#A855F7", "#FF7A1A"]; for (i = 0; i < 18; i++) out += '<circle cx="' + (rnd() * 1200).toFixed(0) + '" cy="' + (rnd() * 500).toFixed(0) + '" r="' + (14 + rnd() * 60).toFixed(0) + '" fill="' + cs[i % 6] + '" opacity=".18"/>'; }
    else if (s === "flag") { out = '<path d="M0 360 Q300 320 600 360 T1200 360 V420 Q900 380 600 420 T0 420Z" fill="#FF9933" opacity=".35"/><path d="M0 420 Q300 380 600 420 T1200 420 V470 Q900 430 600 470 T0 470Z" fill="#FFFFFF" opacity=".7"/><path d="M0 470 Q300 430 600 470 T1200 470 V520 H0Z" fill="#138808" opacity=".35"/><circle cx="600" cy="445" r="16" fill="none" stroke="#0B3D91" stroke-width="3" opacity=".6"/>'; }
    else if (s === "snow") { for (i = 0; i < 40; i++) out += '<circle class="fall" cx="' + (rnd() * 1200).toFixed(0) + '" cy="' + (rnd() * 480).toFixed(0) + '" r="' + (1.5 + rnd() * 2.5).toFixed(1) + '" fill="#fff" opacity=".8"/>';
      out += '<path d="M0 500 Q300 460 600 490 T1200 480 V520 H0Z" fill="#fff" opacity=".9"/>'; }
    else if (s === "moon") { out = '<circle cx="980" cy="110" r="46" fill="#FDE68A"/><circle cx="1000" cy="96" r="42" fill="' + t[1] + '"/>';
      for (i = 0; i < 24; i++) out += '<circle class="tw" cx="' + (rnd() * 1200).toFixed(0) + '" cy="' + (rnd() * 300).toFixed(0) + '" r="' + (1 + rnd() * 1.8).toFixed(1) + '" fill="#FFF7D6"/>';
      out += '<path d="M120 520V420q40-50 80 0v100M260 520V440h60v80M520 520V400q50-70 100 0v120" fill="#000" opacity=".18"/>'; }
    else if (s === "sunset") { out = '<circle cx="860" cy="360" r="190" fill="#FFE29A" opacity=".28"/><circle cx="860" cy="360" r="78" fill="#FFB347"/>' +
      '<rect y="360" width="1200" height="160" fill="#000" opacity=".12"/>';
      for (i = 0; i < 6; i++) out += '<rect x="' + (760 + rnd() * 160).toFixed(0) + '" y="' + (380 + i * 18) + '" width="' + (40 + rnd() * 90).toFixed(0) + '" height="3" rx="2" fill="#FFE29A" opacity=".55"/>'; }
    else if (s === "kites") { var kc = ["#F97417", "#EC2C5D", "#FFAC06", "#7C3AED"]; for (i = 0; i < 6; i++) { var kx = 120 + rnd() * 1000, ky = 50 + rnd() * 240;
      out += '<g class="tw"><path d="M' + kx + ' ' + ky + ' l22 26 l-22 26 l-22 -26z" fill="' + kc[i % 4] + '"/><path d="M' + kx + ' ' + (ky + 52) + ' q10 40 -10 80" stroke="#fff" fill="none" opacity=".6"/></g>'; } }
    else if (s === "leaves") { for (i = 0; i < 18; i++) { var lx = rnd() * 1200, ly = 260 + rnd() * 260; out += '<path d="M' + lx + ' ' + ly + ' q20 -30 40 0 q-20 30 -40 0z" fill="#9BE07A" opacity=".35" transform="rotate(' + (rnd() * 60 - 30).toFixed(0) + ' ' + lx + ' ' + ly + ')"/>'; } }
    else { var fc = [a, "#FFC21A", "#FF7AA8", "#fff"]; for (i = 0; i < 16; i++) { var fx = rnd() * 1200, fy = rnd() * 500, r = 8 + rnd() * 14, col = fc[i % 4], p = "";
      for (var k = 0; k < 5; k++) { var an = k * 72 * Math.PI / 180; p += '<circle cx="' + (fx + Math.cos(an) * r).toFixed(1) + '" cy="' + (fy + Math.sin(an) * r).toFixed(1) + '" r="' + (r * .62).toFixed(1) + '" fill="' + col + '"/>'; }
      out += '<g opacity=".28">' + p + '<circle cx="' + fx.toFixed(1) + '" cy="' + fy.toFixed(1) + '" r="' + (r * .45).toFixed(1) + '" fill="#FFE29A"/></g>'; } }
    return '<svg viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + out + "</svg>";
  }

  function dayText(f) {
    var left = Math.round((Date.parse(f.day + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 864e5);
    if (HI) return left > 1 ? f.name + " " + left + " दिन में" : left === 1 ? f.name + " कल है" : "आज " + f.name + " है";
    return left > 1 ? f.name + " in " + left + " days" : left === 1 ? f.name + " is tomorrow" : "Today is " + f.name;
  }

  // ---- 4) the page parts (after the page is parsed) ----
  function decorate(f) {
    var L = look(f), t = L ? L.t : null, deco = t ? t[5] : "🎉✨";
    var greet = f.greeting || (t ? t[4] : "Happy " + f.name + "!");
    // greeting strip on every page, dismissable for the day
    var dk = "gb_fest_x_" + today + "_" + f.theme;
    if (!document.querySelector(".gbf-strip") && (f.preview || store.get(dk) !== "1")) {
      var s = document.createElement("div"); s.className = "gbf-strip"; s.setAttribute("role", "status");
      if (!L) { s.style.background = "linear-gradient(90deg,#4B1C7A,#D6336C)"; s.style.color = "#fff"; }
      s.innerHTML = '<span class="gbf-deco">' + esc(Array.from(deco).slice(0, 2).join("")) + "</span><span>" + esc(greet) + " · " + esc(dayText(f)) + "</span>" +
        '<button class="gbf-x" aria-label="Close">×</button>';
      s.querySelector(".gbf-x").onclick = function () { store.set(dk, "1"); s.remove(); };
      document.body.insertBefore(s, document.body.firstChild);
    }
    if (!L) return;
    // home / guides hero: drawn scene + swinging decorations
    var hero = document.querySelector("header.hero, .hero");
    if (hero && !hero.querySelector(".gbf-scene")) {
      var sc = document.createElement("div"); sc.className = "gbf-scene"; sc.innerHTML = scene(t[6], t); hero.insertBefore(sc, hero.firstChild);
      var dr = document.createElement("div"); dr.className = "gbf-deco-row"; dr.innerHTML = Array.from(deco).filter(function (c) { return c.trim(); }).slice(0, 4).map(function (c) { return "<span>" + c + "</span>"; }).join("");
      hero.appendChild(dr);
    }
    // seller / sales panels: festive band at the top of the side bar (the panels draw it later, so watch for it)
    function band() {
      var side = document.querySelector(".side");
      if (!side || side.querySelector(".gbf-band")) return;
      var b = document.createElement("div"); b.className = "gbf-band";
      b.innerHTML = '<span class="gbf-deco">' + esc(Array.from(deco).slice(0, 4).join("")) + "</span>" + esc(greet);
      side.insertBefore(b, side.firstChild);
    }
    band();
    if (document.querySelector(".app, #app, .side") || /^\/(seller|sales)\//.test(P)) {
      var mo = new MutationObserver(band); mo.observe(document.body, { childList: true, subtree: true });
    }
  }
  function ready(fn) { if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }

  if (fest) ready(function () { decorate(fest); });
  if (q) return;   // preview: nothing fetched, nothing saved
  // known for today and checked in the last 30 min → nothing to do; otherwise ask again (an admin switch-off shows on the next page)
  try { var cached = JSON.parse(store.get(CK) || "null"); if (cached && Date.now() - cached.at < 18e5) return; } catch (e) {}
  fetch(SB + "/rest/v1/festivals?select=name,day,theme,greeting,active&day=gte." + today + "&day=lte." + istDay(2) + "&order=day.asc&limit=3",
    { headers: { apikey: KEY, Authorization: "Bearer " + KEY } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) {
      var f = (rows || []).filter(function (x) { return x.active !== false; })[0] || null;
      var had = !!fest;
      store.set(CK, JSON.stringify({ f: f, at: Date.now() }));
      if (f && !had) { vars(f); ready(function () { decorate(f); }); }
    }).catch(function () {});
})();
