// update-88: operator + Grievance Officer line in every footer, read from admin Settings (legal_info) so the app,
// the website and the complaint emails always say the same. The HTML already has the current values; this only
// refreshes them if the owner changes them in Settings.
(function () {
  var SB = "https://airbbnopqgubftqjzkjr.supabase.co", KEY = "sb_publishable_fImHal0lfTgi_3jCJ9w67Q_6-JB4US1";
  function line(L) {
    return "Operated by " + L.legal_name + (L.legal_gstin ? " · GSTIN " + L.legal_gstin : "") + (L.legal_address ? " · " + L.legal_address : "") +
      " · Grievance Officer: " + L.go_name + ", " + L.go_designation + ", " + L.go_email + (L.go_phone ? ", " + L.go_phone : "");
  }
  try {
    fetch(SB + "/rest/v1/rpc/legal_info", { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body: "{}" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (L) {
        if (!L || !L.legal_name) return;
        document.querySelectorAll("[data-legal-line]").forEach(function (el) { el.textContent = line(L); });
        document.querySelectorAll("[data-go-phone]").forEach(function (el) { el.textContent = L.go_phone || ""; el.style.display = L.go_phone ? "" : "none"; });
      }).catch(function () {});
  } catch (e) {}
  // update-93: Legal page → "What changed" (newest first), from the same list the app shows before re-accepting
  var box = document.querySelector("[data-terms-changes]");
  if (box) try {
    fetch(SB + "/rest/v1/terms_changes?select=version,doc,ord,en,hi&order=version.desc,doc.asc,ord.asc&limit=200", { headers: { apikey: KEY, Authorization: "Bearer " + KEY } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!rows || !rows.length) return;
        var hi = /^hi/i.test(navigator.language || "") || new URLSearchParams(location.search).get("lang") === "hi";
        var names = { terms: ["Terms of Use", "उपयोग की शर्तें"], "seller-terms": ["Seller Terms", "सेलर नियम"], "partner-terms": ["Delivery Partner Terms", "डिलीवरी पार्टनर नियम"],
          "sales-terms": ["Sales Partner Terms", "सेल्स पार्टनर नियम"], privacy: ["Privacy Policy", "प्राइवेसी पॉलिसी"] };
        var e = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
        var byV = {}; rows.forEach(function (r) { (byV[r.version] = byV[r.version] || []).push(r); });
        box.innerHTML = "<h2>" + (hi ? "क्या बदला" : "What changed") + "</h2>" + Object.keys(byV).sort().reverse().map(function (v) {
          var d = new Date(v.slice(0, 10) + "T00:00:00+05:30").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) + (v.length > 10 ? " · update " + (Number(v.split(".")[1] || 0) + 1) : "");
          return "<p><b>" + e(d) + "</b></p><ul>" + byV[v].map(function (r) {
            return "<li><b>" + e((names[r.doc] || [r.doc, r.doc])[hi ? 1 : 0]) + ":</b> " + e(hi ? r.hi : r.en) + "</li>"; }).join("") + "</ul>";
        }).join("");
        box.style.display = "";
      }).catch(function () {});
  } catch (e) {}
})();
