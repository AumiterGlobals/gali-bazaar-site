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
    igas:       ["#0E1235", "#141941", "#28365D", "#F27E03", "Igas Bagwal ki bhaut badhai 🔥", "🔥🪔✨🔥", "igas"],
    phooldei:   ["#C4E2FC", "#DAEDFC", "#90AACD", "#D22D29", "Phool Dei, chhammaa Dei 🌸", "🌸🌼🌺🌸", "phooldei"],
    harela:     ["#1F6624", "#26722A", "#398A3D", "#3A923E", "Harela ki shubhkamnayein 🌱", "🌱🌿🌳🌱", "harela"],
    ghughutiya: ["#FEE5BD", "#FFF0D9", "#C5CAE8", "#7F6157", "Kale kauva kale! Uttarayani ki badhai", "🐦‍⬛🌾🍯🐦‍⬛", "ghughutiya"]
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
  var NAMES = { igas: "Igas Bagwal", phooldei: "Phool Dei", ghughutiya: "Ghughutiya", harela: "Harela", diwali: "Diwali" };
  if (q) fest = { name: NAMES[q] || q.charAt(0).toUpperCase() + q.slice(1), theme: q, day: today, greeting: null, preview: true };
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

  // ---- 3) drawn scenes: 4 layers (sky / far / near / people) for parallax; original simple SVG art, no images ----
  // each theme: its own scene key (T[k][6]); people are faceless silhouettes
  function R(seed) { var x = seed || 7; return function () { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }
  var INK = "rgba(20,10,30,.55)";
  function person(x, y, s, pose, col) {   // standing figure, base at (x,y), height ~ 90*s
    col = col || INK; var h = 'transform="translate(' + x + " " + y + ") scale(" + s + ')"', arm;
    if (pose === "bhailo") arm = '<path d="M6 -62 L30 -86" stroke="' + col + '" stroke-width="6" stroke-linecap="round"/><path d="M30 -86 Q48 -70 52 -48" stroke="' + col + '" stroke-width="2" fill="none"/><circle class="tw" cx="52" cy="-44" r="9" fill="#FFB347"/><circle cx="52" cy="-44" r="16" fill="#FFB347" opacity=".25"/>';
    else if (pose === "plant") arm = '<path d="M4 -58 L26 -36" stroke="' + col + '" stroke-width="6" stroke-linecap="round"/><path d="M30 -2 v-22 m0 8 q-10 -8 -14 -2 m14 -4 q10 -8 14 -2" stroke="#3A923E" stroke-width="3" fill="none"/>';
    else if (pose === "basket") arm = '<path d="M5 -60 L22 -44" stroke="' + col + '" stroke-width="6" stroke-linecap="round"/><path d="M14 -46 h22 l-4 14 h-14z" fill="#B7793E"/><circle cx="19" cy="-48" r="4" fill="#FF7AA8"/><circle cx="27" cy="-49" r="4" fill="#FFD23F"/><circle cx="33" cy="-47" r="3.5" fill="#fff"/>';
    else if (pose === "mala") arm = '<path d="M-6 -62 L-20 -40 M6 -62 L20 -40" stroke="' + col + '" stroke-width="6" stroke-linecap="round"/><path d="M-12 -70 Q0 -30 12 -70" stroke="#C98A3A" stroke-width="3" fill="none" stroke-dasharray="3 4"/>';
    else arm = '<path d="M-6 -60 L-14 -34 M6 -60 L14 -34" stroke="' + col + '" stroke-width="6" stroke-linecap="round"/>';
    return '<g ' + h + '><circle cx="0" cy="-80" r="9" fill="' + col + '"/><path d="M-10 -68 Q0 -72 10 -68 L12 -30 L-12 -30 Z" fill="' + col + '"/><path d="M-6 -30 L-8 0 M6 -30 L8 0" stroke="' + col + '" stroke-width="6" stroke-linecap="round"/>' + arm + "</g>";
  }
  function peaks(y, col, snow, seed) { var r = R(seed), d = "M0 " + (y + 60), x = 0, top = []; while (x < 1260) { var px = x + 80 + r() * 90, py = y - 40 - r() * 70; d += " L" + px.toFixed(0) + " " + py.toFixed(0); top.push([px, py]); x = px + 60 + r() * 60; d += " L" + x.toFixed(0) + " " + (y + 10 + r() * 30).toFixed(0); }
    d += " L1260 520 L0 520Z"; var s = '<path d="' + d + '" fill="' + col + '"/>';
    if (snow) top.forEach(function (p) { s += '<path d="M' + (p[0] - 22).toFixed(0) + " " + (p[1] + 26).toFixed(0) + " L" + p[0].toFixed(0) + " " + p[1].toFixed(0) + " L" + (p[0] + 22).toFixed(0) + " " + (p[1] + 26).toFixed(0) + ' q-11 -8 -22 0 q-11 -8 -22 0z" fill="#F4F8FF"/>'; }); return s; }
  function hills(y, col, seed) { var r = R(seed), d = "M0 " + y; for (var x = 0; x <= 1260; x += 140) d += " Q" + (x + 70) + " " + (y - 40 - r() * 50).toFixed(0) + " " + (x + 140) + " " + (y + r() * 20 - 10).toFixed(0); return '<path d="' + d + ' L1260 520 L0 520Z" fill="' + col + '"/>'; }
  function deodar(x, y, s, col) { return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')"><path d="M0 -120 L26 -70 L14 -70 L34 -34 L18 -34 L40 0 L-40 0 L-18 -34 L-34 -34 L-14 -70 L-26 -70Z" fill="' + col + '"/><rect x="-4" y="0" width="8" height="12" fill="' + col + '"/></g>'; }
  function pahariHouse(x, y, s) { return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')"><rect x="-46" y="-44" width="92" height="44" fill="#8C6A4F"/><path d="M-56 -44 L0 -78 L56 -44Z" fill="#6E7781"/><path d="M-50 -48 L0 -74 M-40 -46 L0 -70 M0 -74 L50 -48" stroke="#555E68" stroke-width="2"/><rect x="-12" y="-30" width="24" height="30" fill="#3E2B1F"/><rect x="-36" y="-34" width="14" height="12" fill="#FFD27A"/><rect x="22" y="-34" width="14" height="12" fill="#FFD27A"/><rect x="-46" y="-6" width="92" height="6" fill="#5A4636"/></g>'; }
  function terraces(y, cols) { var s = ""; for (var i = 0; i < 6; i++) s += '<path d="M0 ' + (y + i * 34) + " Q600 " + (y + i * 34 - 18) + " 1260 " + (y + i * 34) + ' L1260 520 L0 520Z" fill="' + cols[i % cols.length] + '"/>'; return s; }
  function jhalar(y) { var s = "", r = R(11); for (var k = 0; k < 4; k++) { var x0 = k * 320 - 20, x1 = x0 + 340; s += '<path d="M' + x0 + " " + y + " Q" + (x0 + 170) + " " + (y + 60) + " " + x1 + " " + y + '" stroke="#5A3B1A" stroke-width="2" fill="none"/>';
      for (var t = .06; t < 1; t += .08) { var bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * (x0 + 170) + t * t * x1, by = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + 60) + t * t * y; s += '<circle class="tw" cx="' + bx.toFixed(0) + '" cy="' + (by + 6).toFixed(0) + '" r="4.5" fill="' + ["#FFD23F", "#FF5C8A", "#5CD6FF", "#7CFF8A"][Math.floor(r() * 4)] + '"/>'; } } return s; }
  function rangoli(x, y, s) { var g = '<g transform="translate(' + x + " " + y + ") scale(" + s + ')">', c = ["#FF3682", "#FFC21A", "#37C684", "#3BA9FF", "#A855F7"];
    for (var i = 0; i < 8; i++) { var a = i * 45; g += '<ellipse cx="0" cy="-38" rx="14" ry="30" fill="' + c[i % 5] + '" transform="rotate(' + a + ')" opacity=".9"/>'; }
    for (i = 0; i < 8; i++) g += '<circle cx="0" cy="-58" r="5" fill="#fff" transform="rotate(' + (i * 45 + 22) + ')"/>';
    return g + '<circle r="16" fill="#FFC21A"/><circle r="7" fill="#FF3682"/></g>'; }
  function diyas(y, n, col) { var s = ""; for (var i = 0; i < n; i++) { var x = 80 + i * (1100 / (n - 1)); s += '<path d="M' + (x - 22) + ' ' + y + ' q22 22 44 0z" fill="#B5562A"/><path class="tw" d="M' + x + ' ' + (y - 2) + ' q-7 -14 0 -28 q7 14 0 28z" fill="' + col + '"/>'; } return s; }
  function crow(x, y, s) { return '<path transform="translate(' + x + " " + y + ") scale(" + s + ')" d="M-20 0 Q-10 -10 0 0 Q10 -10 20 0 Q10 -4 0 4 Q-10 -4 -20 0Z" fill="#1A1A22"/>'; }
  function flower(x, y, r, col) { var p = ""; for (var k = 0; k < 5; k++) { var an = k * 1.2566; p += '<circle cx="' + (x + Math.cos(an) * r).toFixed(1) + '" cy="' + (y + Math.sin(an) * r).toFixed(1) + '" r="' + (r * .62).toFixed(1) + '" fill="' + col + '"/>'; } return p + '<circle cx="' + x + '" cy="' + y + '" r="' + (r * .45).toFixed(1) + '" fill="#FFE29A"/>'; }

  function layers(s, t) {   // -> [far, mid, near, front] SVG bodies
    var a = t[3], r = R(5), i, L = ["", "", "", ""];
    if (s === "igas") {
      for (i = 0; i < 30; i++) L[0] += '<circle class="tw" cx="' + (r() * 1260).toFixed(0) + '" cy="' + (r() * 200).toFixed(0) + '" r="' + (.8 + r() * 1.6).toFixed(1) + '" fill="#FFF7D6"/>';
      L[0] += peaks(250, "#2E3D63", true, 3);
      L[1] = hills(360, "#1D2746", 9) + deodar(150, 380, .9, "#0F1A2E") + deodar(240, 392, .7, "#0F1A2E") + deodar(1040, 382, .85, "#0F1A2E") + deodar(1150, 396, .65, "#0F1A2E");
      L[2] = pahariHouse(380, 430, 1) + pahariHouse(860, 440, .85) + '<path d="M0 450 Q630 420 1260 450 L1260 520 L0 520Z" fill="#141B33"/>';
      L[3] = person(560, 470, 1, "bhailo", "#0A0F1E") + person(690, 474, .92, "bhailo", "#0A0F1E") + person(780, 478, .7, "", "#0A0F1E") + person(470, 478, .75, "", "#0A0F1E");
    } else if (s === "ghughutiya") {
      L[0] = '<circle cx="980" cy="150" r="60" fill="#FFD48A" opacity=".9"/>' + peaks(280, "#C5CAE8", true, 4);
      L[1] = hills(380, "#A9B4D9", 12) + crow(300, 150, 1) + crow(360, 120, .8) + crow(820, 110, .9) + crow(900, 160, .7);
      L[2] = '<path d="M0 440 Q630 410 1260 440 L1260 520 L0 520Z" fill="#7F6157"/>' + pahariHouse(1060, 446, .8);
      L[3] = person(420, 482, .78, "mala", "#3B2A24") + person(520, 486, .7, "mala", "#3B2A24") + person(610, 484, .74, "", "#3B2A24") + crow(560, 360, 1.1);
    } else if (s === "phooldei") {
      L[0] = peaks(260, "#B8D3F2", true, 6);
      L[1] = hills(370, "#9CC98A", 4); for (i = 0; i < 10; i++) L[1] += flower(80 + r() * 1100, 350 + r() * 40, 5 + r() * 4, ["#FF7AA8", "#FFD23F", "#fff"][i % 3]);
      L[2] = pahariHouse(860, 452, 1.05) + '<rect x="812" y="446" width="96" height="10" fill="#C9A27A"/>' + flower(830, 444, 6, "#FF7AA8") + flower(856, 444, 6, "#FFD23F") + flower(884, 444, 6, "#D22D29") + '<path d="M0 452 Q630 430 1260 452 L1260 520 L0 520Z" fill="#6E9F5C"/>';
      L[3] = person(520, 486, .8, "basket", "#3A2A40") + person(610, 488, .72, "basket", "#3A2A40") + person(690, 490, .66, "", "#3A2A40");
    } else if (s === "harela") {
      L[0] = peaks(250, "#9BC9A0", false, 8);
      L[1] = terraces(300, ["#7BBF6A", "#5FA850", "#4C9A40", "#3D8A34", "#357A2E", "#2E6B28"]);
      L[2] = deodar(1040, 420, .9, "#1F4D22") + deodar(150, 430, .7, "#1F4D22");
      L[3] = person(470, 496, .85, "plant", "#18331A") + person(590, 498, .8, "plant", "#18331A") + person(720, 500, .72, "", "#18331A");
    } else if (s === "lights") {   // Diwali: jhalar + rangoli + diyas
      for (i = 0; i < 26; i++) L[0] += '<circle class="tw" cx="' + (r() * 1260).toFixed(0) + '" cy="' + (r() * 240).toFixed(0) + '" r="' + (1 + r() * 2).toFixed(1) + '" fill="#FFE29A"/>';
      L[0] += jhalar(30);
      L[1] = jhalar(110).replace(/r="4.5"/g, 'r="3.5"');
      L[2] = rangoli(170, 420, 1) + rangoli(1110, 440, .7);
      L[3] = diyas(486, 9, a);
    } else if (s === "colors") { var cs = ["#FF3682", "#37C684", "#FFC21A", "#3BA9FF", "#A855F7", "#FF7A1A"]; for (i = 0; i < 18; i++) L[i % 3] += '<circle cx="' + (r() * 1260).toFixed(0) + '" cy="' + (r() * 500).toFixed(0) + '" r="' + (14 + r() * 60).toFixed(0) + '" fill="' + cs[i % 6] + '" opacity=".16"/>';
      L[3] = person(1000, 500, .8, "", "rgba(176,24,110,.35)") + person(1080, 504, .7, "", "rgba(59,169,255,.35)"); }
    else if (s === "flag") { L[1] = '<path d="M0 360 Q300 320 600 360 T1260 360 V420 Q900 380 600 420 T0 420Z" fill="#FF9933" opacity=".35"/><path d="M0 420 Q300 380 600 420 T1260 420 V470 Q900 430 600 470 T0 470Z" fill="#FFFFFF" opacity=".7"/><path d="M0 470 Q300 430 600 470 T1260 470 V520 H0Z" fill="#138808" opacity=".35"/>'; L[2] = '<circle cx="630" cy="445" r="16" fill="none" stroke="#0B3D91" stroke-width="3" opacity=".6"/>'; }
    else if (s === "snow") { L[1] = hills(420, "rgba(255,255,255,.18)", 2); L[2] = '<path d="M0 500 Q300 460 630 490 T1260 480 V520 H0Z" fill="#fff" opacity=".9"/>' + deodar(1080, 488, 1.1, "#0B4F3A") + '<circle class="tw" cx="1080" cy="380" r="5" fill="#FFD23F"/>'; }
    else if (s === "moon") { L[0] = '<circle cx="980" cy="110" r="46" fill="#FDE68A"/><circle cx="1000" cy="96" r="42" fill="' + t[1] + '"/>'; for (i = 0; i < 24; i++) L[0] += '<circle class="tw" cx="' + (r() * 1260).toFixed(0) + '" cy="' + (r() * 300).toFixed(0) + '" r="' + (1 + r() * 1.8).toFixed(1) + '" fill="#FFF7D6"/>';
      L[2] = '<path d="M120 520V420q40-50 80 0v100M260 520V440h60v80M520 520V400q50-70 100 0v120" fill="#000" opacity=".18"/>'; }
    else if (s === "sunset") { L[0] = '<circle cx="860" cy="360" r="190" fill="#FFE29A" opacity=".28"/><circle cx="860" cy="360" r="78" fill="#FFB347"/>'; L[1] = '<rect y="360" width="1260" height="160" fill="#000" opacity=".12"/>';
      for (i = 0; i < 6; i++) L[2] += '<rect x="' + (760 + r() * 160).toFixed(0) + '" y="' + (380 + i * 18) + '" width="' + (40 + r() * 90).toFixed(0) + '" height="3" rx="2" fill="#FFE29A" opacity=".55"/>';
      L[3] = person(340, 470, .8, "basket", "rgba(60,20,10,.55)") + person(420, 474, .74, "", "rgba(60,20,10,.55)"); }
    else if (s === "kites") { var kc = ["#F97417", "#EC2C5D", "#FFAC06", "#7C3AED"]; for (i = 0; i < 6; i++) { var kx = 120 + r() * 1000, ky = 50 + r() * 240; L[i % 2 + 1] += '<g class="tw"><path d="M' + kx + ' ' + ky + ' l22 26 l-22 26 l-22 -26z" fill="' + kc[i % 4] + '"/><path d="M' + kx + ' ' + (ky + 52) + ' q10 40 -10 80" stroke="#fff" fill="none" opacity=".6"/></g>'; } L[0] = hills(430, "rgba(255,255,255,.25)", 3); }
    else { var fc = [a, "#FFC21A", "#FF7AA8", "#fff"]; for (i = 0; i < 16; i++) L[i % 3] += '<g opacity=".3">' + flower(r() * 1260, r() * 500, 8 + r() * 14, fc[i % 4]) + "</g>"; }
    return L;
  }
  function sceneHTML(s, t) {
    var L = layers(s, t), dep = [2, 4, 7, 10];
    return L.map(function (body, i) { return body ? '<svg class="gbf-l" data-depth="' + dep[i] + '" viewBox="0 0 1260 520" preserveAspectRatio="xMidYMax meet" aria-hidden="true">' + body + "</svg>" : ""; }).join("") +
      '<canvas class="gbf-p" aria-hidden="true"></canvas>';
  }
  // parallax (mouse + scroll, max ~10 px) and particles (max 60, slower after 8 s, off when the tab is hidden or reduced motion)
  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function animate(hero, kind) {
    if (RM) return;
    var ls = hero.querySelectorAll(".gbf-l"), mx = 0, my = 0, sy = 0;
    function apply() { ls.forEach(function (l) { var d = +l.getAttribute("data-depth"); l.style.transform = "translate3d(" + (mx * d).toFixed(1) + "px," + (my * d - sy * d * .04).toFixed(1) + "px,0)"; }); }
    hero.addEventListener("mousemove", function (e) { var b = hero.getBoundingClientRect(); mx = ((e.clientX - b.left) / b.width - .5); my = ((e.clientY - b.top) / b.height - .5); apply(); }, { passive: true });
    addEventListener("scroll", function () { sy = Math.min(scrollY, 300) / 30; apply(); }, { passive: true });
    var cv = hero.querySelector(".gbf-p"); if (!cv || !kind) return;
    var cx = cv.getContext("2d"), W, H, P = [], t0 = performance.now(), run = true, raf;
    function size() { W = cv.width = hero.clientWidth; H = cv.height = hero.clientHeight; }
    size(); addEventListener("resize", size);
    var conf = { sparks: ["#FFD27A", "#FFB347", "#FFF2C2"], gulal: ["#FF3682", "#37C684", "#FFC21A", "#3BA9FF", "#A855F7"], snow: ["#FFFFFF"], petals: ["#FF7AA8", "#FFD23F", "#FFFFFF", "#D22D29"] }[kind];
    function spawn() { var up = kind === "sparks"; return { x: Math.random() * W, y: up ? H + 10 : -10, vx: (Math.random() - .5) * (kind === "gulal" ? 1.2 : .5), vy: up ? -(0.6 + Math.random() * 1.4) : (0.4 + Math.random() * 1.1),
      r: kind === "gulal" ? 2 + Math.random() * 4 : 1.2 + Math.random() * 2.4, c: conf[Math.floor(Math.random() * conf.length)], a: .5 + Math.random() * .5, w: Math.random() * 6 }; }
    for (var i = 0; i < 60; i++) { var p = spawn(); p.y = Math.random() * H; P.push(p); }
    function frame(now) {
      if (!run) return;
      var slow = now - t0 > 8000 ? .45 : 1, n = slow < 1 ? 30 : 60;
      cx.clearRect(0, 0, W, H);
      for (var i = 0; i < n; i++) { var p = P[i]; p.x += (p.vx + Math.sin((now / 900) + p.w) * .3) * slow; p.y += p.vy * slow;
        if (p.y < -12 || p.y > H + 12 || p.x < -12 || p.x > W + 12) { P[i] = spawn(); continue; }
        cx.globalAlpha = p.a; cx.fillStyle = p.c; cx.beginPath();
        if (kind === "petals") cx.ellipse(p.x, p.y, p.r * 1.6, p.r, p.w + now / 1500, 0, 6.283); else cx.arc(p.x, p.y, p.r, 0, 6.283);
        cx.fill(); }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", function () { if (document.hidden) { run = false; cancelAnimationFrame(raf); } else if (!run) { run = true; raf = requestAnimationFrame(frame); } });
  }
  var PARTICLES = { diwali: "sparks", igas: "sparks", holi: "gulal", christmas: "snow", phooldei: "petals" };
  var ENGINE = { igas: 1, diwali: 1, phooldei: 1, harela: 1, ghughutiya: 1 };   // scenes drawn by fest-engine.js (others: layered SVG for now)

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
    var home = P === "/" || P === "/index.html";
    if (hero && home && ENGINE[L.key] && !hero.querySelector(".gbf-scene")) {
      // the full scene engine (assets/fest-engine.js — same drawing as the app's FestEngine.kt), home hero only
      document.documentElement.classList.add("gbf-engine");
      var sc0 = document.createElement("div"); sc0.className = "gbf-scene"; sc0.innerHTML = '<canvas class="gbf-e" aria-hidden="true"></canvas><div class="gbf-shade"></div>';
      hero.insertBefore(sc0, hero.firstChild);
      var js = document.createElement("script"); js.src = "/assets/fest-engine.js?v=1795920000";
      js.onload = function () { window.GBFestEngine.run(sc0.querySelector("canvas"), L.key, { hover: hero, still: /[?&]still=1/.test(location.search) }); };
      document.head.appendChild(js);
    } else if (hero && !hero.querySelector(".gbf-scene")) {
      var sc = document.createElement("div"); sc.className = "gbf-scene"; sc.innerHTML = sceneHTML(t[6], t); hero.insertBefore(sc, hero.firstChild);
      if (P === "/" || P === "/index.html") animate(hero, PARTICLES[L.key]);   // moving parts only on the home page
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
