/* Category cards from the admin's list (Supabase) — falls back to the cards already in the page. */
(function () {
  var SB = "https://airbbnopqgubftqjzkjr.supabase.co", KEY = "sb_publishable_fImHal0lfTgi_3jCJ9w67Q_6-JB4US1";
  var boxes = document.querySelectorAll("[data-cats]");
  if (!boxes.length) return;
  function get(path, opt) {
    return fetch(SB + path, Object.assign({ headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" } }, opt || {}))
      .then(function (r) { if (!r.ok) throw r; return r.json(); });
  }
  function esc(s) { return String(s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function shade(hex, f) { // f<1 darker, >1 lighter
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return hex;
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function c(v) { return Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))); }
    return "rgb(" + c(r) + "," + c(g) + "," + c(b) + ")";
  }
  Promise.all([
    get("/rest/v1/categories?select=*&visible=eq.true&order=sort.asc"),
    get("/rest/v1/rpc/category_stats", { method: "POST", body: "{}" }).catch(function () { return []; })
  ]).then(function (res) {
    var cats = res[0], live = {};
    (res[1] || []).forEach(function (x) { live[x.key] = x.shops; });
    if (!cats || !cats.length) return;
    boxes.forEach(function (box) {
      var forShops = box.getAttribute("data-cats") === "shops";
      var html = cats.map(function (c) {
        var isNew = c.created_at && (Date.now() - Date.parse(c.created_at)) < 21 * 864e5;
        var none = (live[c.key] || 0) === 0;
        var tag = isNew ? '<em class="ctag new">New</em>' : none ? '<em class="ctag soon">' + (forShops ? "Be the first in your area" : "Joining soon") + "</em>" : "";
        var img = /^https?:/.test(c.icon) ? c.icon : "/img/art/" + c.icon + ".webp";
        return '<div class="cat dyn" style="background:linear-gradient(120deg,' + shade(c.color, 1.35) + " 0%," + esc(c.color) + " 55%," + shade(c.color, .88) + ' 100%)">' +
          "<h3>" + esc(c.name) + "</h3>" + tag + (c.short_line ? "<p>" + esc(c.short_line) + "</p>" : "") +
          '<img src="' + esc(img) + '" alt="" loading="lazy"></div>';
      }).join("");
      if (forShops) html += '<a class="cat dyn req" href="/contact/?topic=category"><b>+</b><h3>Request a category</h3><p>Bakery, flowers, hardware…</p></a>';
      else html += '<div class="cat dyn more"><p>➕ New categories show up here automatically as shops join</p></div>';
      box.innerHTML = html;
      box.classList.add("cats-dyn");
    });
  }).catch(function () { /* keep the built-in cards */ });
})();
