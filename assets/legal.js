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
})();
