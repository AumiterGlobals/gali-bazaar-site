// ---------------- Tax & TDS (update-73) ----------------
// Settings the CA decides are kept here, not in code: TAN, deductor name, rates, threshold, catch-up, payment codes.
const TX = {};
const txMon = d => new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });

// red strip on every admin page while the TAN is empty
async function taxBanner() {
  const { data } = await db.from("settings").select("tan").eq("id", 1).maybeSingle();
  let b = document.getElementById("taxbar");
  if (!data || "tan" in data === false || (data.tan || "").trim()) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("div"); b.id = "taxbar"; document.body.prepend(b); }
  b.style.cssText = "position:sticky;top:0;z-index:49;background:#B0144F;color:#fff;padding:9px 16px;font-weight:600;cursor:pointer;font-size:14px";
  b.onclick = () => go("tax");
  b.textContent = "TAN is empty — TDS can't be deposited or filed. Open Tax & TDS and enter the TAN.";
}
setTimeout(() => taxBanner().catch(() => {}), 1500);

async function taxPage() {
  const [{ data: st }, codes, recs] = await Promise.all([db.from("settings").select("*").eq("id", 1).maybeSingle(),
    q("tds_codes", "*", x => x.order("key")), q("tds_recoveries", "month,tds,sales,status,recovered,entity", x => x.order("month", { ascending: false }).limit(2000))]);
  TX.st = st || {};
  const byM = {};
  recs.forEach(r => { const k = r.month; byM[k] = byM[k] || { shops: 0, sales: 0, tds: 0, rec: 0 }; if (+r.tds > 0) byM[k].shops++; byM[k].sales += +r.sales; byM[k].tds += +r.tds; byM[k].rec += +r.recovered; });
  const s = TX.st, f = (k, label, v, ph = "", type = "text") => `<div style="flex:1;min-width:200px"><div class="sub" style="margin:0 0 4px">${label}</div><input class="in" id="tx_${k}" type="${type}" value="${esc(v ?? "")}" placeholder="${esc(ph)}"></div>`;
  const chk = (k, label, on) => `<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-top:10px"><input type="checkbox" id="tx_${k}" ${on ? "checked" : ""}>${label}</label>`;
  $("#main").innerHTML = head("Tax & TDS", "E-commerce TDS on shop sales (s.393(1) Sl. 8(v), earlier 194-O) and TDS on sales-partner commission (Sl. 1(ii), earlier 194H)") + `
    ${(s.tan || "").trim() ? "" : `<div class="box" style="background:#FDE7EE;border-color:#F6B9CC"><b style="color:#B0144F">TAN is empty.</b> <span class="sub" style="color:#6B1233">Enter it below — challans, returns and Form 131 need it.</span></div>`}
    <div class="box"><h3>Deductor</h3><div style="display:flex;gap:10px;flex-wrap:wrap">
      ${f("tan", "TAN", s.tan, "e.g. MRTA12345B")}${f("deductor_name", "Deductor name", s.deductor_name)}</div></div>
    <div class="box"><h3>E-commerce TDS on shop sales</h3>
      ${chk("ecom_tds_on", "TDS on — on the 1st, last month's sales are worked out and a TDS recovery note goes to each shop", s.ecom_tds_on)}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
        ${f("ecom_tds_rate", "Rate %", s.ecom_tds_rate, "0.1", "number")}${f("ecom_tds_no_pan_rate", "Rate % without PAN", s.ecom_tds_no_pan_rate, "5", "number")}
        ${f("ecom_tds_threshold", "Individual / HUF yearly threshold ₹", s.ecom_tds_threshold, "500000", "number")}</div>
      ${chk("ecom_tds_catch_up", "Catch-up: in the month an individual / HUF crosses the threshold, TDS on the whole year so far (off = only on the part above the threshold)", s.ecom_tds_catch_up)}
      <div class="sub" style="margin-top:8px">Firm, company, LLP, trust etc. (PAN 4th letter not P / H): from the first rupee. Food Corner is left out (customers call the shop). Sales = delivered orders − credit notes.</div></div>
    <div class="box"><h3>Sales-partner commission</h3>${chk("comm_tds_first_rupee", "TDS from the first payout", s.comm_tds_first_rupee ?? true)}</div>
    <button class="btn pink" onclick="taxSave()">Save</button><span id="tx_m" style="margin-left:10px"></span>
    <div class="box" style="margin-top:16px"><h3>TDS payment codes</h3><div class="sub">Fill the codes your CA gives you — they go into the challan and return files.</div>
      <table><thead><tr><th>Payment</th><th>Section</th><th>Code</th><th></th></tr></thead><tbody>${codes.map(c => `<tr><td>${esc(c.label)}</td><td>${esc(c.section_new)}${c.section_old ? ` <span class="sub">(earlier ${esc(c.section_old)})</span>` : ""}</td>
        <td><input class="in" id="tc_${c.key}" value="${esc(c.code || "")}" placeholder="Fill code" style="max-width:140px;${c.code ? "" : "border-color:#E5484D"}"></td>
        <td><button class="btn ghost" onclick="taxCode('${c.key}')">Save</button></td></tr>`).join("")}</tbody></table></div>
    <div class="box"><h3>Monthly TDS on shop sales</h3>
      <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:10px"><div><div class="sub" style="margin:0 0 4px">Run a past month by hand</div><input class="in" type="month" id="tx_run"></div>
        <button class="btn" onclick="taxRun()">Work out TDS</button></div>
      ${Object.keys(byM).length ? `<table><thead><tr><th>Month</th><th style="text-align:right">Shops with TDS</th><th style="text-align:right">Sales</th><th style="text-align:right">TDS</th><th style="text-align:right">Recovered</th><th style="text-align:right">Still due</th></tr></thead><tbody>
        ${Object.entries(byM).map(([m, v]) => `<tr><td><b>${txMon(m)}</b></td><td style="text-align:right">${v.shops}</td><td style="text-align:right">${inr(v.sales)}</td><td style="text-align:right">${inr(v.tds)}</td>
          <td style="text-align:right">${inr(v.rec)}</td><td style="text-align:right;${v.tds - v.rec > 0 ? "color:#B0144F;font-weight:700" : ""}">${inr(v.tds - v.rec)}</td></tr>`).join("")}</tbody></table>` : `<div class="sub">Nothing yet.</div>`}</div>
    <div id="txMore"></div>`;
  if (window.taxReports) taxReports();   // update-74: challans + monthly files
}
async function taxSave() {
  const v = k => $("#tx_" + k).value, c = k => $("#tx_" + k).checked;
  const tan = v("tan").trim().toUpperCase();
  if (tan && !/^[A-Z]{4}[0-9]{5}[A-Z]$/.test(tan)) { $("#tx_m").innerHTML = `<span class="msg err">TAN looks like ABCD12345E</span>`; return; }
  const row = { tan: tan || null, deductor_name: v("deductor_name").trim() || null, ecom_tds_on: c("ecom_tds_on"), ecom_tds_rate: +v("ecom_tds_rate") || 0.1,
    ecom_tds_no_pan_rate: +v("ecom_tds_no_pan_rate") || 5, ecom_tds_threshold: +v("ecom_tds_threshold") || 0, ecom_tds_catch_up: c("ecom_tds_catch_up"), comm_tds_first_rupee: c("comm_tds_first_rupee") };
  const { error } = await db.from("settings").update(row).eq("id", 1);
  $("#tx_m").innerHTML = `<span class="msg ${error ? "err" : "ok"}">${esc(error ? error.message : "Saved")}</span>`;
  taxBanner();
}
async function taxCode(k) { const { error } = await db.rpc("admin_tds_code", { p_key: k, p_code: $("#tc_" + k).value }); if (error) alert(error.message); else taxPage(); }
async function taxRun() {
  const m = $("#tx_run").value; if (!m) return alert("Pick the month");
  if (!confirm(`Work out TDS for ${m}? Shops get a TDS recovery note. A month is done only once.`)) return;
  const { data, error } = await db.rpc("admin_tds_run", { p_month: m + "-01" }); if (error) return alert(error.message);
  alert(`${data} shop${data === 1 ? "" : "s"} got a TDS note`); taxPage();
}
