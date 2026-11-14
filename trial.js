// Fills free-trial days (.td) and plan price (.pp) from Admin → Settings, so the site never shows old numbers.
(function () {
  fetch("https://airbbnopqgubftqjzkjr.supabase.co/rest/v1/settings?id=eq.1&select=plan_price,trial_days", { headers: { apikey: "sb_publishable_fImHal0lfTgi_3jCJ9w67Q_6-JB4US1" } })
    .then(r => r.json()).then(j => { const s = j && j[0]; if (!s) return;
      if (s.trial_days != null) document.querySelectorAll(".td").forEach(e => e.textContent = s.trial_days);
      if (s.plan_price) document.querySelectorAll(".pp").forEach(e => e.textContent = "₹" + s.plan_price);
    }).catch(() => {});
})();
