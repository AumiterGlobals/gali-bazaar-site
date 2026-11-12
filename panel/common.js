// Shared helpers for the Gali Bazaar web panels (sales / seller). Each panel keeps its OWN session
// (separate storage key), so a seller and a sales login in the same browser never clash.
const SB_URL = "https://airbbnopqgubftqjzkjr.supabase.co", SB_KEY = "sb_publishable_fImHal0lfTgi_3jCJ9w67Q_6-JB4US1";
const OTP_LEN = 8;   // Supabase → Auth → Email OTP length (currently 8). Change both if you switch to 6.
const LOGO = '<span class="logo"><span class="g">गली</span> Bazaar<span class="d">.</span></span>';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (n, d = 0) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const inr2 = n => { const v = Number(n || 0); return v % 1 ? "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : inr(v); };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dmy = s => { if (!s) return "—"; const d = new Date(s); return isNaN(d) ? "—" : `${d.getDate()} ${MON[d.getMonth()]}`; };
const dmyy = s => { if (!s) return "—"; const d = new Date(s); return isNaN(d) ? "—" : `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
const dt = s => { if (!s) return "—"; const d = new Date(s); return isNaN(d) ? "—" : `${d.getDate()} ${MON[d.getMonth()]}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`; };
function fyStart(d = new Date()) { const y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(); return new Date(y, 3, 1); }
function fyLabel(d = new Date()) { const y = fyStart(d).getFullYear(); return `FY ${y}–${String(y + 1).slice(2)}`; }
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function makeClient(storageKey) { return supabase.createClient(SB_URL, SB_KEY, { auth: { storageKey, persistSession: true, autoRefreshToken: true } }); }
function niceErr(e) { const m = (e && (e.message || e.error_description || e)) + ""; return m.replace(/^.*?exception:\s*/i, "").slice(0, 200); }
function phoneLink(p) { const d = String(p || "").replace(/\D/g, "").slice(-10); return d ? `tel:+91${d}` : null; }
function csvDownload(name, rows) {
  const s = rows.map(r => r.map(v => { v = String(v ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + s], { type: "text/csv" })); a.download = name; a.click();
}
/** OTP boxes: returns {el, value(), clear(), focus()}. Paste fills all. */
function codeBoxes(holder, onFull) {
  holder.innerHTML = `<div class="codes">${Array.from({ length: OTP_LEN }, () => `<input inputmode="numeric" maxlength="1" autocomplete="one-time-code">`).join("")}</div>`;
  const ins = $$("input", holder);
  ins.forEach((inp, i) => {
    inp.oninput = () => {
      const v = inp.value.replace(/\D/g, "");
      if (v.length > 1) { v.split("").slice(0, OTP_LEN - i).forEach((c, j) => ins[i + j].value = c); ins[Math.min(i + v.length, OTP_LEN - 1)].focus(); }
      else { inp.value = v; if (v && i < OTP_LEN - 1) ins[i + 1].focus(); }
      const all = ins.map(x => x.value).join(""); if (all.length === OTP_LEN && onFull) onFull(all);
    };
    inp.onkeydown = e => { if (e.key === "Backspace" && !inp.value && i > 0) ins[i - 1].focus(); };
    inp.onpaste = e => { e.preventDefault(); const v = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, OTP_LEN); v.split("").forEach((c, j) => { if (ins[j]) ins[j].value = c; }); ins[Math.min(v.length, OTP_LEN - 1)].focus(); if (v.length === OTP_LEN && onFull) onFull(v); };
  });
  return { value: () => ins.map(x => x.value).join(""), clear: () => ins.forEach(x => x.value = ""), focus: () => ins[0].focus(), ok: on => $(".codes", holder).classList.toggle("ok", on) };
}
/** "Resend in 0:45" countdown. */
function countdown(el, secs, onDone) {
  let s = secs; const tick = () => { if (s <= 0) { clearInterval(t); onDone(); return; } el.textContent = `Resend in 0:${String(s).padStart(2, "0")}`; s--; };
  const t = setInterval(tick, 1000); tick(); return () => clearInterval(t);
}
/** Live sync: subscribe to tables; calls onChange (debounced). Returns status setter element updates. */
function liveSync(db, name, tables, onChange) {
  let t = null; const fire = () => { clearTimeout(t); t = setTimeout(onChange, 400); };
  let ch = db.channel(name + "-" + Math.random().toString(36).slice(2, 7));
  tables.forEach(x => { const [table, filter] = Array.isArray(x) ? x : [x]; ch = ch.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, fire); });
  let wasDown = false;
  ch.subscribe(st => {
    const el = document.getElementById("livepill");
    if (el) { el.className = "live" + (st === "SUBSCRIBED" ? "" : " off"); el.textContent = st === "SUBSCRIBED" ? "Live" : "Reconnecting…"; }
    if (st === "SUBSCRIBED") { if (wasDown) fire(); wasDown = false; } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") wasDown = true;
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") fire(); });
  return ch;
}
