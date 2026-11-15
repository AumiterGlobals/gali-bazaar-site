// ---------------- Setup checklist (Admin home + top of Settings) ----------------
// Shows what is still not set up and what breaks without it. Hidden when everything required is done.
async function setupItems() {
  const [{ data: st }, codes, team, inbox, health] = await Promise.all([
    db.from("settings").select("tan,tax_report_emails,backup_email,firebase_web,seller_terms_otp,setup_done,tds_rate").eq("id", 1).maybeSingle(),
    q("tds_codes", "key,code").catch(() => null), q("tax_team", "email").catch(() => null), q("tds_inbox", "id", x => x.limit(1)).catch(() => []),
    db.functions.invoke("push", { body: { action: "health" } }).then(r => r.data?.secrets || null).catch(() => null)]);
  const s = st || {}, done = s.setup_done || {}, H = health || {};
  const sec = k => health ? !!H[k] : null;   // null = couldn't check
  return [
    { k: "mails", ok: (s.tax_report_emails || []).length > 0, t: "Tax mail list", why: "Monthly TDS / GST statements and tax reminders go to nobody.", go: "tax", el: "tm_l" },
    { k: "tan", ok: !!(s.tan || "").trim(), t: "TAN", why: "TDS can't be deposited and the TDS return can't be filed.", go: "tax", el: "tx_tan" },
    { k: "commrate", ok: Number(s.tds_rate) === 2, t: `Commission TDS rate = 2%${s.tds_rate != null && Number(s.tds_rate) !== 2 ? ` (now ${s.tds_rate}%)` : ""}`, why: "Sales partner payouts deduct the wrong TDS (s.393(1) Sl. 1(ii) is 2% with PAN).", go: "tax", el: "tx_tds_rate" },
    { k: "codes", ok: codes ? codes.length > 0 && codes.every(c => (c.code || "").trim()) : false, t: "TDS payment codes (from your CA)", why: "Statements show \"Fill code\" instead of the payment code.", go: "tax", el: "[id^=tc_]" },
    { k: "backup", ok: !!(s.backup_email || "").trim(), t: "Backup email", why: "The nightly PDF of payment screenshots isn't emailed.", go: "settings", el: "st_backup_email" },
    { k: "team", ok: (team || []).length > 0, t: "Accountant (tax team)", why: "Only you can enter challans, returns and Form 131.", go: "tax", el: "tt_e", optional: true },
    { k: "mailkey", ok: sec("GMAIL_APP_PASSWORD") || sec("BREVO_API_KEY"), t: "Email secret (GMAIL_APP_PASSWORD or BREVO_API_KEY)", why: "No email goes out — invoices, statements, OTP-free notices.", go: null, secret: true },
    { k: "fcm", ok: sec("FCM_SERVICE_ACCOUNT"), t: "Push secret (FCM_SERVICE_ACCOUNT)", why: "No push notifications; phone OTP for Seller Terms can't be checked.", go: null, secret: true },
    { k: "inboundkey", ok: sec("TDS_INBOUND_SECRET"), t: "tds@ secret (TDS_INBOUND_SECRET)", why: "Mails to tds@galibazaar.site are refused.", go: null, secret: true },
    { k: "tds_inbound", ok: !!done.tds_inbound || inbox.length > 0, t: "tds@galibazaar.site routing (Cloudflare worker + Email Routing)", why: "Form 131 / challan mails don't reach Tax & TDS.", go: null, tick: true,
      help: "Steps: cloudflare/tds-inbound/README.md in the app repo. Turns green by itself when the first mail arrives, or tick it." },
    { k: "otp", ok: !!s.firebase_web && !!s.seller_terms_otp, t: "Seller Terms phone OTP", why: "Sellers sign the Terms without a phone OTP.", go: "settings", el: "st_tos_otp", optional: true },
  ];
}
async function setupCard(where) {
  const items = await setupItems().catch(() => null); if (!items) return;
  const need = items.filter(i => !i.ok && !i.optional), opt = items.filter(i => !i.ok && i.optional);
  const old = document.getElementById("setupCard"); if (old) old.remove();
  if (!need.length && !opt.length) return;
  const red = need.some(i => ["mails", "tan", "mailkey"].includes(i.k));
  const box = document.createElement("div"); box.id = "setupCard"; box.className = "box";
  box.style.cssText = `border:2px solid ${red ? "#E5484D" : "#F2DDB8"};background:${red ? "#FFF5F6" : "#FFF9EF"}`;
  box.innerHTML = `<h3 style="margin-bottom:4px">Setup checklist · ${items.filter(i => i.ok).length} of ${items.length} done</h3>
    <div class="sub" style="margin-bottom:8px">${need.length ? `${need.length} thing${need.length === 1 ? "" : "s"} still needed` : "Only optional items left"} — each line says what doesn't work without it. Secrets are set in Supabase → Edge Functions → Secrets (we only check whether they exist).</div>
    ${items.map(i => `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid #F1ECF4">
      <span style="font-size:16px;line-height:20px">${i.ok ? "✅" : i.ok === null ? "❔" : i.optional ? "🟡" : "❌"}</span>
      <div style="flex:1"><b>${esc(i.t)}</b>${i.optional ? ' <span class="sub" style="margin:0;display:inline">(optional)</span>' : ""}
        ${i.ok ? "" : `<div class="sub" style="margin:2px 0 0">${i.ok === null ? "Couldn't check — the push function may need a redeploy." : esc(i.why)}${i.help ? " " + esc(i.help) : ""}</div>`}</div>
      ${i.ok ? "" : i.go ? `<button class="btn ghost" style="padding:6px 12px" onclick="setupGo('${i.go}', '${i.el || ""}')">Open</button>` : i.tick ? `<button class="btn ghost" style="padding:6px 12px" onclick="setupTick('${i.k}')">Mark done</button>` : ""}</div>`).join("")}`;
  const main = document.getElementById("main"); if (!main) return;
  const top = main.querySelector(".top"); if (top) top.after(box); else main.prepend(box);
  if (where === "dashboard" && !need.length) box.querySelectorAll("div[style*='border-top']").forEach(d => { if (d.textContent.includes("✅")) d.remove(); });
}
async function setupTick(k) {
  const { data } = await db.from("settings").select("setup_done").eq("id", 1).maybeSingle();
  const done = Object.assign({}, data?.setup_done || {}, { [k]: true });
  const { error } = await db.from("settings").update({ setup_done: done }).eq("id", 1);
  if (error) return alert(error.message); setupCard(page);
}

// "Open": go to the page (only if not already there), then scroll to the field and highlight it
async function setupGo(pg, el) {
  if (page !== pg) { if (location.hash.slice(1) === pg) go(pg); else location.hash = pg; }
  if (!el) return window.scrollTo({ top: 0, behavior: "smooth" });
  const sel = /^[a-z_]+$/i.test(el) ? "#" + el : el;
  for (let t = 0; t < 40; t++) {
    const n = [...document.querySelectorAll(sel)].find(x => !x.value || x.type === "checkbox") || document.querySelector(sel);
    if (n) { n.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => n.focus({ preventScroll: true }), 350);
      n.style.boxShadow = "0 0 0 3px #F0287A66"; setTimeout(() => n.style.boxShadow = "", 2500); return; }
    await new Promise(r => setTimeout(r, 150));
  }
  alert("This field isn't on the page yet — the database update for it may not be run.");
}
