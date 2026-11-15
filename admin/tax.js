// ---------------- Tax & TDS (update-73) ----------------
// Settings the CA decides are kept here, not in code: TAN, deductor name, rates, threshold, catch-up, payment codes.
const TX = {};
const txMon = d => new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" });

// red strip on every admin page while the TAN is empty
async function taxBanner() {
  const { data } = await db.from("settings").select("tan, tax_report_emails").eq("id", 1).maybeSingle();
  let b = document.getElementById("taxbar");
  const noTan = data && "tan" in data && !(data.tan || "").trim(), noMail = data && "tax_report_emails" in data && !(data.tax_report_emails || []).length;
  if (!noTan && !noMail) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("div"); b.id = "taxbar"; document.body.prepend(b); }
  b.style.cssText = "position:sticky;top:0;z-index:49;background:#B0144F;color:#fff;padding:9px 16px;font-weight:600;cursor:pointer;font-size:14px";
  b.onclick = () => go("tax");
  b.textContent = noTan ? "TAN is empty — TDS can't be deposited or filed. Open Tax & TDS and enter the TAN."
    : "Tax mail list is empty — statements and reminders can't be emailed. Open Tax & TDS → Tax team & mail list.";
}
setTimeout(() => taxBanner().catch(() => {}), 1500);

async function taxPage() {
  const [{ data: st }, codes, recs] = await Promise.all([db.from("settings").select("*").eq("id", 1).maybeSingle(),
    q("tds_codes", "*", x => x.order("key")), q("tds_recoveries", "month,tds,sales,status,recovered,entity", x => x.order("month", { ascending: false }).limit(2000))]);
  TX.st = st || {};
  const byM = {};
  recs.forEach(r => { const k = r.month; byM[k] = byM[k] || { shops: 0, sales: 0, tds: 0, rec: 0 }; if (+r.tds > 0) byM[k].shops++; byM[k].sales += +r.sales; byM[k].tds += Math.round(+r.tds); byM[k].rec += Math.round(+r.recovered); });
  const s = TX.st, f = (k, label, v, ph = "", type = "text") => `<div style="flex:1;min-width:200px"><div class="sub" style="margin:0 0 4px">${label}</div><input class="in" id="tx_${k}" type="${type}" value="${esc(v ?? "")}" placeholder="${esc(ph)}"></div>`;
  const chk = (k, label, on) => `<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-top:10px"><input type="checkbox" id="tx_${k}" ${on ? "checked" : ""}>${label}</label>`;
  $("#main").innerHTML = head("Tax & TDS", "E-commerce TDS on shop sales (s.393(1) Sl. 8(v), earlier 194-O) and TDS on sales-partner commission (Sl. 1(ii), earlier 194H)") + `
    ${(s.tan || "").trim() ? "" : `<div class="box" style="background:#FDE7EE;border-color:#F6B9CC"><b style="color:#B0144F">TAN is empty.</b> <span class="sub" style="color:#6B1233">Enter it below — challans, returns and Form 131 need it.</span></div>`}
    <div class="box"><h3>Deductor</h3><div style="display:flex;gap:10px;flex-wrap:wrap">
      ${f("tan", "TAN", s.tan, "e.g. MRTA12345B")}${f("deductor_name", "Deductor name", s.deductor_name)}</div></div>
    <div class="box"><h3>E-commerce TDS on shop sales</h3>
      ${chk("ecom_tds_on", "TDS on — on the 1st, last month's sales are worked out and a TDS recovery note goes to each shop", s.ecom_tds_on ?? true)}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
        ${f("ecom_tds_rate", "Rate %", s.ecom_tds_rate, "0.1", "number")}${f("ecom_tds_no_pan_rate", "Rate % without PAN", s.ecom_tds_no_pan_rate, "5", "number")}
        ${f("ecom_tds_threshold", "Individual / HUF yearly threshold ₹", s.ecom_tds_threshold, "500000", "number")}</div>
      ${chk("ecom_tds_catch_up", "Catch-up (on): in the month an individual / HUF crosses ₹5 lakh, TDS on the whole year's sales so far (off = only on the part above the threshold)", s.ecom_tds_catch_up ?? true)}
      <div class="sub" style="margin-top:8px">Firm, company, LLP, trust etc. (PAN 4th letter not P / H): from the first rupee. Food Corner is left out (customers call the shop). Sales = delivered orders − credit notes.</div></div>
    <div class="box"><h3>Sales partner commission TDS</h3>
      <div class="sub">s.393(1) Table Sl. 1(ii) (earlier 194H) — 2% with PAN since 1 Oct 2024; without PAN the higher rate (20%).</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">${f("tds_rate", "Rate % (with PAN)", s.tds_rate ?? 2, "2", "number")}${f("tds_rate_no_pan", "Rate % without PAN", s.tds_rate_no_pan ?? 20, "20", "number")}</div>
      ${Number(s.tds_rate ?? 2) !== 2 ? `<div class="sub" style="color:#B0144F;margin-top:6px"><b>Commission TDS is 2% under s.393(1) — change only if your CA says so.</b> Now: ${esc(s.tds_rate)}%.</div>` : ""}
      ${chk("comm_tds_first_rupee", "TDS from the first payout (no yearly limit)", s.comm_tds_first_rupee ?? true)}<div class="sub" style="margin-top:4px">Paid once a month: TDS on the month's payout total, rounded to the rupee (10 × ₹16.78 = ₹167.80 → 2% = ₹3.36 → ₹3).</div></div>
    ${window.ACCOUNTANT ? `<div class="sub">Only the admin can change these settings.</div>` : `<button class="btn pink" onclick="taxSave()">Save</button><span id="tx_m" style="margin-left:10px"></span>`}
    <div class="box" style="margin-top:16px"><h3>TDS payment codes</h3><div class="sub">Fill the codes your CA gives you — they go into the challan and return files.</div>
      <table><thead><tr><th>Payment</th><th>Section</th><th>Code</th><th></th></tr></thead><tbody>${codes.map(c => `<tr><td>${esc(c.label)}</td><td>${esc(c.section_new)}${c.section_old ? ` <span class="sub">(earlier ${esc(c.section_old)})</span>` : ""}</td>
        <td><input class="in" id="tc_${c.key}" value="${esc(c.code || "")}" placeholder="Fill code" style="max-width:140px;${c.code ? "" : "border-color:#E5484D"}"></td>
        <td>${window.ACCOUNTANT ? "" : `<button class="btn ghost" onclick="taxCode('${c.key}')">Save</button>`}</td></tr>`).join("")}</tbody></table></div>
    <div class="box"><h3>Monthly TDS on shop sales</h3>
      <div style="display:${window.ACCOUNTANT ? "none" : "flex"};gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:10px"><div><div class="sub" style="margin:0 0 4px">Run a past month by hand</div><input class="in" type="month" id="tx_run"></div>
        <button class="btn" onclick="taxRun()">Work out TDS</button></div>
      ${Object.keys(byM).length ? `<table><thead><tr><th>Month</th><th style="text-align:right">Shops with TDS</th><th style="text-align:right">Sales</th><th style="text-align:right">TDS</th><th style="text-align:right">Recovered</th><th style="text-align:right">Still due</th></tr></thead><tbody>
        ${Object.entries(byM).map(([m, v]) => `<tr><td><b>${txMon(m)}</b></td><td style="text-align:right">${v.shops}</td><td style="text-align:right">${inr(v.sales)}</td><td style="text-align:right">${inr(v.tds)}</td>
          <td style="text-align:right">${inr(v.rec)}</td><td style="text-align:right;${v.tds - v.rec > 0 ? "color:#B0144F;font-weight:700" : ""}">${inr(v.tds - v.rec)}</td></tr>`).join("")}</tbody></table>` : `<div class="sub">Nothing yet.</div>`}</div>
    <div id="txMore"></div><div id="txTeam"></div>`;
  if (window.ACCOUNTANT) $$("#main input:not([type=file]):not([id^=ch_]):not([id^=cu_]):not([id^=rt_]):not([id^=st_]):not([id^=ce_])").forEach(i => i.disabled = true);
  if (window.taxReports) taxReports().then(() => window.ACCOUNTANT && $$("#main .box:first-of-type input").forEach(i => i.disabled = true));   // update-74: challans + monthly files
  taxTeam();
}
async function taxSave() {
  const v = k => $("#tx_" + k).value, c = k => $("#tx_" + k).checked;
  const tan = v("tan").trim().toUpperCase();
  if (tan && !/^[A-Z]{4}[0-9]{5}[A-Z]$/.test(tan)) { $("#tx_m").innerHTML = `<span class="msg err">TAN looks like ABCD12345E</span>`; return; }
  const cr = +v("tds_rate"), cn = +v("tds_rate_no_pan");
  if (!(cr > 0 && cr <= 30) || !(cn > 0 && cn <= 40)) { $("#tx_m").innerHTML = `<span class="msg err">Enter the commission TDS rates</span>`; return; }
  if (cr !== 2 && !confirm(`Commission TDS is 2% under s.393(1) — change only if your CA says so.\n\nSave ${cr}% anyway?`)) return;
  const row = { tds_rate: cr, tds_rate_no_pan: cn, tan: tan || null, deductor_name: v("deductor_name").trim() || null, ecom_tds_on: c("ecom_tds_on"), ecom_tds_rate: +v("ecom_tds_rate") || 0.1,
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

// ---------------- update-74: challans, monthly / quarterly files, Form 131 certificates ----------------
async function taxReports() {
  const [{ data: due }, chal, runs, certs, shops] = await Promise.all([db.rpc("tds_challans_due"), q("tds_challans", "*", x => x.order("month", { ascending: false }).limit(24)),
    q("statement_runs", "*", x => x.order("sent_at", { ascending: false }).limit(12)), q("tds_certificates", "*", x => x.order("created_at", { ascending: false }).limit(50)),
    db.rpc("tax_shop_pans").then(r => r.data || [])]);
  TX.shops = shops;
  const [rets, inbox, mails] = await Promise.all([q("tds_returns", "*", x => x.order("fy", { ascending: false }).limit(16)),
    q("tds_inbox", "*", x => x.eq("status", "PENDING").order("at", { ascending: false }).limit(50)).catch(() => []),
    q("tax_mails", "id,at,kind,subject,files,sent_to,status,tries,last_error", x => x.order("at", { ascending: false }).limit(20)).catch(() => [])]);
  const lastQ = (() => { const m = new Date().getMonth(); return m < 3 ? 3 : m < 6 ? 4 : m < 9 ? 1 : 2; })();
  const kindL = k => k === "ecom" ? "E-commerce TDS (shops)" : "Commission TDS (sales partners)";
  // FY of the quarter that just ended (Form 131 is for that one)
  const fy = (() => { const d = new Date(), m = d.getMonth(); const y = m < 3 ? d.getFullYear() - 1 : m < 6 ? d.getFullYear() - 1 : d.getFullYear(); return `${String(y).slice(2)}-${String(y + 1).slice(2)}`; })();
  $("#txMore").innerHTML = `
    <div class="box" ${(due || []).length ? 'style="border:2px solid #E5484D;background:#FFF5F6"' : ""}><h3>TDS challans</h3>
      ${(due || []).length ? `<div class="sub" style="color:#B0144F;margin-bottom:10px">Enter the challan once you have paid — the banner stays until then.</div>` : `<div class="sub">All challans entered ✓</div>`}
      ${(due || []).map((d, i) => `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;padding:10px 0;border-top:1px solid #F1ECF4">
        <div style="min-width:220px;flex:1"><b>${kindL(d.kind)} · ${txMon(d.month)}</b><div class="sub" style="margin:2px 0 0">TDS ${inr(d.tds)} (whole rupees — sum of the month's rounded TDS) · deposit by ${esc(d.due_by)}</div></div>
        <input class="in" id="ch_a${i}" type="number" step="1" min="1" value="${Math.round(d.tds)}" data-want="${Math.round(d.tds)}" style="width:110px" title="Amount (whole rupees)">
        <input class="in" id="ch_d${i}" type="date" style="width:150px" title="Challan date">
        <input class="in" id="ch_b${i}" placeholder="BSR (7 digits)" style="width:130px">
        <input class="in" id="ch_s${i}" placeholder="Serial no." style="width:110px">
        <input class="in" id="ch_u${i}" placeholder="Bank UTR (optional)" style="width:170px">
        <label class="btn ghost" style="cursor:pointer;margin:0" title="The challan receipt PDF — BSR, serial and bank reference are read from it">Receipt PDF<input type="file" accept="application/pdf" id="ch_f${i}" style="display:none" onchange="taxReceipt(${i})"></label>
        <button class="btn pink" onclick="taxChallan(${i},'${d.month}','${d.kind}')">Save</button><span class="sub" id="ch_m${i}" style="margin:0;width:100%"></span></div>`).join("")}
      ${chal.length ? `<div style="overflow:auto"><table style="margin-top:12px"><thead><tr><th>Month</th><th>Type</th><th style="text-align:right">Amount</th><th>Challan date</th><th>BSR</th><th>Serial</th><th>Bank UTR</th><th>Receipt</th></tr></thead><tbody>
        ${chal.map(c => `<tr><td>${txMon(c.month)}</td><td>${kindL(c.kind)}</td><td style="text-align:right">${inr(c.amount)}</td><td>${esc(c.paid_on)}</td><td>${esc(c.bsr)}</td><td>${esc(c.serial)}</td>
          <td>${c.bank_matched ? `<b>${esc(c.bank_utr || "")}</b> <span class="pill ok">✓ matched</span>`
            : `${c.bank_utr ? `<b>${esc(c.bank_utr)}</b> <span class="pill grey">manual</span>` : `<input class="in" id="cu_${c.id}" placeholder="Enter bank UTR" style="width:150px;margin:0"> <button class="btn ghost" style="padding:6px 10px" onclick="taxUtr('${c.id}')">Save</button>`}
               <div class="sub" style="margin:2px 0 0;color:#B0144F">Not matched with the bank statement</div>`}</td>
          <td>${c.receipt_path ? `<button class="btn ghost" style="padding:6px 10px" onclick="taxOpen('${esc(c.receipt_path)}')">PDF</button>` : "—"}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>
    <div class="box"><h3>Statements for the CA</h3>
      <div class="sub">Sent by email automatically: the 1st (TDS + GST draft), the 9th (GST final, late entries marked) and after each quarter (TDS return data). Send again any time:</div>
      <div class="sub" style="margin-top:8px;color:#B26A00"><b>Form 140 (quarterly return data):</b> Columns ka order CA se ek baar check karwa lein.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:10px"><input class="in" type="month" id="st_m" style="width:170px">
        <button class="btn ghost" onclick="taxSend('draft')">Email draft</button><button class="btn ghost" onclick="taxSend('final')">Email final</button><button class="btn ghost" onclick="taxSend('quarter')">Email quarter (ending this month)</button></div>
      ${runs.length ? `<table style="margin-top:12px"><thead><tr><th>Month</th><th>File</th><th>Sent</th><th style="text-align:right">TDS</th><th style="text-align:right">GST</th></tr></thead><tbody>
        ${runs.map(r => `<tr><td>${txMon(r.month)}</td><td>${r.stage === "final" ? "Final" : r.stage === "quarter" ? "Quarter" : "Draft"}</td><td>${new Date(r.sent_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
          <td style="text-align:right">${inr(r.tds || 0)}</td><td style="text-align:right">${inr(r.gst || 0)}</td></tr>`).join("")}</tbody></table>` : ""}</div>
    <div class="box"><h3>Quarterly TDS return (Form 140)</h3>
      <div class="sub">After filing, enter the date and token no. — shops see only the filed date on their TDS cards.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:10px">
        <input class="in" id="rt_fy" value="${fy}" style="width:90px" title="FY"><select class="in" id="rt_q" style="width:150px">${[[1, "Q1 · Apr–Jun"], [2, "Q2 · Jul–Sep"], [3, "Q3 · Oct–Dec"], [4, "Q4 · Jan–Mar"]].map(([n, l]) => `<option value="${n}">${l}</option>`).join("")}</select>
        <input class="in" id="rt_d" type="date" style="width:160px" title="Filed on"><input class="in" id="rt_t" placeholder="Token no." style="width:160px">
        <button class="btn pink" onclick="taxReturn()">Save</button></div>
      ${rets.length ? `<table style="margin-top:12px"><thead><tr><th>FY</th><th>Quarter</th><th>Filed on</th><th>Token no.</th></tr></thead><tbody>${rets.map(r => `<tr><td>${esc(r.fy)}</td><td>Q${r.quarter}</td><td>${esc(r.filed_on)}</td><td>${esc(r.token_no || "—")}</td></tr>`).join("")}</tbody></table>` : ""}</div>
    <div class="box"><h3>Form 131 certificates (from TRACES)</h3>
      <div class="sub">Choose all the PDFs at once, or a ZIP of them. Each file is matched to a shop by the <b>PAN</b> in its name (or in the PDF text); FY and quarter come from the name, else from the boxes below. Matched shops get a push + email with their certificate.</div>
      <div class="sub" style="margin-top:4px;color:#B26A00">The ZIP you download from TRACES is password-locked — open it first, then choose the PDFs. You can also email them to <b>tds@galibazaar.site</b>.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:10px">
        <input class="in" id="ce_fy" value="${fy}" style="width:90px" title="FY (26-27)"><select class="in" id="ce_q" style="width:90px">${[1, 2, 3, 4].map(n => `<option value="${n}" ${n === lastQ ? "selected" : ""}>Q${n}</option>`).join("")}</select>
        <label class="btn pink" style="cursor:pointer;margin:0">Choose PDFs or ZIP<input type="file" accept="application/pdf,.pdf,application/zip,.zip" multiple id="ce_f" style="display:none" onchange="taxCerts()"></label></div>
      <div id="ce_res"></div>
      ${certs.length ? `<table style="margin-top:12px"><thead><tr><th>Shop</th><th>FY · Quarter</th><th>Added</th><th>From</th><th>Shop told</th><th></th></tr></thead><tbody>${certs.map(c => `<tr><td>${esc(shops.find(s => s.id === c.shop)?.name || "Shop")}</td><td>FY ${esc(c.fy)} · Q${c.quarter}</td><td>${new Date(c.created_at).toLocaleDateString("en-IN")}</td><td>${c.source === "email" ? "tds@ mail" : "Upload"}</td><td>${c.notified_at ? "✓" : "…"}</td><td><button class="btn ghost" style="padding:6px 10px" onclick="taxOpen('${esc(c.path)}')">PDF</button></td></tr>`).join("")}</tbody></table>` : ""}</div>
    ${inbox.length ? `<div class="box" style="border:2px solid #F5C27A;background:#FFF9EF"><h3>From tds@galibazaar.site — to check</h3>
      <table><thead><tr><th>Received</th><th>From</th><th>File</th><th>What</th><th></th></tr></thead><tbody>${inbox.map(x => `<tr><td>${new Date(x.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
        <td>${esc(x.sender)}</td><td><a href="#" onclick="event.preventDefault();taxOpen('${esc(x.path || "")}')">${esc(x.file_name || "")}</a><div class="sub" style="margin:0">${esc(x.note || "")}</div></td>
        <td>${x.kind === "challan" ? "Challan receipt" : "Form 131"}</td>
        <td style="white-space:nowrap">${x.kind === "challan" ? `<button class="btn pink" style="padding:6px 10px" onclick="taxUseReceipt('${x.id}','${esc(x.path)}')">Use for challan</button>`
          : `<select class="in" id="ib_s_${x.id}" style="width:170px;margin:0"><option value="">Pick shop…</option>${shops.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
             <button class="btn pink" style="padding:6px 10px" onclick="taxInboxAttach('${x.id}','${esc(x.path)}')">Attach</button>`}
          <button class="btn ghost" style="padding:6px 10px" onclick="taxInboxSet('${x.id}','SKIPPED')">Skip</button></td></tr>`).join("")}</tbody></table></div>` : ""}
    <div class="box"><h3>Tax mails</h3><div class="sub">Every statement and reminder. A failed mail is tried again every hour (12 times), then the admin gets a push.</div>
      ${mails.length ? `<div style="overflow:auto"><table style="margin-top:8px"><thead><tr><th>When</th><th>Mail</th><th>To</th><th>Status</th><th></th></tr></thead><tbody>${mails.map(m => `<tr><td>${new Date(m.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
        <td>${esc(m.subject)}</td><td class="sub" style="margin:0">${esc((m.sent_to || []).join(", ") || "—")}</td>
        <td>${m.status === "SENT" ? `<span class="pill ok">Sent</span>` : m.status === "FAILED" ? `<span class="pill bad">Failed</span><div class="sub" style="margin:0">${esc(m.last_error || "")}</div>` : `<span class="pill grey">Retrying · ${m.tries}/12</span>`}</td>
        <td style="white-space:nowrap">${(m.files || []).map(p => `<button class="btn ghost" style="padding:6px 10px" onclick="taxOpen('${esc(p)}')" title="${esc(p.split("/").pop())}">Download again</button>`).join(" ")}
          <button class="btn ghost" style="padding:6px 10px" onclick="taxResend('${m.id}',this)">Send mail again</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="sub">No tax mails yet.</div>`}</div></div>`;
}
async function taxChallan(i, month, kind) {
  const amt = +$("#ch_a" + i).value, want = +$("#ch_a" + i).dataset.want;
  if (amt !== Math.round(amt)) return alert("Challan amount is in whole rupees (e.g. 84, not 84.35).");
  if (want && amt !== want && !confirm(`Challan amount ₹${amt} is not this month's TDS ₹${want} (the sum of each note's / payout's rounded TDS).\n\nSave anyway?`)) return;
  const { error } = await db.rpc("admin_tds_challan", { p_month: month, p_kind: kind, p_amount: +$("#ch_a" + i).value, p_paid_on: $("#ch_d" + i).value || null,
    p_bsr: $("#ch_b" + i).value, p_serial: $("#ch_s" + i).value, p_utr: $("#ch_u" + i).value || null, p_receipt: TX.receipt?.[i] || null });
  if (error) return alert(error.message); TX.receipt = {}; taxPage(); taxBanner();
}
// challan receipt PDF: saved with the challan; BSR, serial, date, amount and the bank reference / UTR are read from its text and filled in
async function taxReceipt(i) {
  const f = $("#ch_f" + i).files[0], m = $("#ch_m" + i); if (!f) return;
  if (f.size > 2 * 1024 * 1024) return alert("PDF must be under 2 MB");
  m.textContent = "Reading the receipt…";
  const path = `challans/${Date.now()}-${f.name.replace(/[^A-Za-z0-9.]+/g, "-")}`;
  const up = await db.storage.from("tds-certs").upload(path, f, { contentType: "application/pdf", upsert: false });
  if (up.error) { m.textContent = up.error.message; return; }
  (TX.receipt = TX.receipt || {})[i] = path;
  let text = "";
  try {
    if (!window.pdfjsLib) await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"; s.onload = ok; s.onerror = bad; document.head.append(s); });
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
    for (let p = 1; p <= Math.min(pdf.numPages, 3); p++) text += " " + (await (await pdf.getPage(p)).getTextContent()).items.map(x => x.str).join(" ");
  } catch (_) { m.textContent = "Receipt saved — couldn't read its text, fill the fields by hand"; return; }
  const get = re => (text.match(re) || [])[1] || "";
  const set = (id, v) => { if (v && !$("#" + id).value) $("#" + id).value = v; };
  set("ch_b" + i, get(/BSR\s*code\s*:?\s*(\d{7})/i));
  set("ch_s" + i, get(/Challan\s*(?:Serial\s*)?No\.?\s*:?\s*(\d{1,5})\b/i));
  set("ch_u" + i, get(/(?:Bank\s*Reference\s*(?:No\.?|Number)?|UTR(?:\s*No\.?)?|Bank\s*Ref\.?\s*No\.?)\s*:?\s*([A-Za-z0-9]{6,30})/i));
  const dt = get(/(?:Tender|Deposit|Payment)\s*Date\s*:?\s*(\d{2}[\/-]\d{2}[\/-]\d{4}|\d{2}-[A-Za-z]{3}-\d{4})/i);
  if (dt && !$("#ch_d" + i).value && typeof bkDate === "function") { const iso = bkDate(dt); if (iso) $("#ch_d" + i).value = iso; }
  m.textContent = "Receipt saved · " + ($("#ch_u" + i).value ? "bank reference found: " + $("#ch_u" + i).value : "bank reference not found in the PDF — type it if you have it");
}
async function taxUtr(id) { const { error } = await db.rpc("admin_tds_challan_utr", { p_id: id, p_utr: $("#cu_" + id).value }); if (error) return alert(error.message); taxPage(); }
async function taxOpen(p) { const { data } = await db.storage.from("tds-certs").createSignedUrl(p, 600); if (data?.signedUrl) window.open(data.signedUrl); }
async function taxSend(stage) {
  const m = $("#st_m").value; if (!m) return alert("Pick the month");
  const { data, error } = await db.functions.invoke("push", { body: { action: "monthly_statements", stage, month: m } });
  if (error || !data?.ok) return alert("Couldn't send: " + (error?.message || data?.note || "check the tax mail list"));
  alert("Sent to the tax mail list"); taxPage();
}
async function taxReturn() {
  if (!fyOk($("#rt_fy").value.trim())) return alert("FY looks like 26-27");
  const { error } = await db.rpc("admin_tds_return", { p_fy: $("#rt_fy").value.trim(), p_quarter: +$("#rt_q").value, p_filed_on: $("#rt_d").value || null, p_token: $("#rt_t").value });
  if (error) return alert(error.message); taxPage();
}
const FY_RE = /^[0-9]{2}-[0-9]{2}$/, fyOk = v => FY_RE.test(v) && (+v.slice(0, 2) + 1) % 100 === +v.slice(3);
const PAN_RE = /\b([A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z])\b/;
async function loadJs(src, test) { if (test()) return; await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.append(s); }); }
async function pdfText(buf) {
  await loadJs("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js", () => window.pdfjsLib);
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise; let t = "";
  for (let p = 1; p <= Math.min(pdf.numPages, 2); p++) t += " " + (await (await pdf.getPage(p)).getTextContent()).items.map(x => x.str).join(" ");
  return t;
}
function fyQOf(t) {
  const q = t.match(/(?:\bQ|_Q|Quarter\s*)\s*([1-4])\b/i), y = t.match(/(20\d{2})\s*-\s*(?:20)?(\d{2})\b/);
  return { quarter: q ? +q[1] : null, fy: y ? `${y[1].slice(2)}-${y[2].slice(-2)}` : null };
}
// many Form 131 PDFs (or a ZIP) → match each to a shop by PAN → save; misses get a shop picker
async function taxCerts() {
  const input = $("#ce_f"), res = $("#ce_res"), fy0 = $("#ce_fy").value.trim(), q0 = +$("#ce_q").value;
  if (!fyOk(fy0)) { input.value = ""; return alert("FY looks like 26-27"); }
  res.innerHTML = `<div class="sub" style="margin-top:10px">Reading files…</div>`;
  const files = [];
  for (const f of input.files) {
    if (/\.zip$/i.test(f.name)) {
      await loadJs("https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js", () => window.fflate);
      try { const z = fflate.unzipSync(new Uint8Array(await f.arrayBuffer()));
        Object.entries(z).filter(([n]) => /\.pdf$/i.test(n)).forEach(([n, b]) => files.push({ name: n.split("/").pop(), buf: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) })); }
      catch (e) { res.innerHTML = `<div class="box" style="background:#FDE7EE;border-color:#F6B9CC;margin-top:10px"><b style="color:#B0144F">${esc(f.name)} is the original TRACES ZIP — it is password-locked.</b><div class="sub" style="color:#6B1233">Open it on your computer with the TRACES password, then choose the PDFs inside (or a new ZIP you make of them).</div></div>`; input.value = ""; return; }
    } else if (/\.pdf$/i.test(f.name)) files.push({ name: f.name, buf: await f.arrayBuffer() });
  }
  input.value = "";
  const byPan = new Map((TX.shops || []).map(s => [s.pan, s]));
  TX.pending = [];
  for (const f of files) {
    if (f.buf.byteLength > 2 * 1024 * 1024) { TX.pending.push({ ...f, err: "Over 2 MB" }); continue; }
    let pan = f.name.toUpperCase().match(PAN_RE)?.[1], fq = fyQOf(f.name), text = "";
    if (!pan || !fq.fy || !fq.quarter) { try { text = await pdfText(f.buf); } catch (_) {} }
    if (!pan) pan = [...text.toUpperCase().matchAll(new RegExp(PAN_RE, "g"))].map(m => m[1]).find(p => byPan.has(p));
    if (!fq.fy || !fq.quarter) { const t = fyQOf(text); fq = { fy: fq.fy || t.fy, quarter: fq.quarter || t.quarter }; }
    const fy = fq.fy && fyOk(fq.fy) ? fq.fy : fy0, quarter = fq.quarter || q0;
    TX.pending.push({ ...f, pan, shop: pan ? byPan.get(pan)?.id : null, fy, quarter });
  }
  // save the matched ones now
  let saved = 0;
  for (const p of TX.pending) if (p.shop && !p.err) { const e = await taxCertSave(p); if (e) p.err = e; else { p.done = true; saved++; } }
  const miss = TX.pending.filter(p => !p.done);
  res.innerHTML = `<div class="box" style="margin-top:10px;background:#F7FBF8;border-color:#BFE3CB"><b>${saved} of ${files.length} saved</b> — those shops got a push + email.
    ${miss.length ? `<div class="sub" style="color:#B0144F;margin-top:6px">${miss.length} need a shop — pick it and attach:</div>
    <table style="margin-top:6px"><tbody>${miss.map((p, i) => `<tr><td>${esc(p.name)}<div class="sub" style="margin:0">${esc(p.err || (p.pan ? `No shop with PAN ${p.pan}` : "No PAN found"))}</div></td>
      <td><select class="in" id="cm_s${i}" style="min-width:180px;margin:0"><option value="">Pick shop…</option>${(TX.shops || []).map(s => `<option value="${s.id}">${esc(s.name)} · ${esc(s.pan)}</option>`).join("")}</select></td>
      <td><input class="in" id="cm_fy${i}" value="${esc(p.fy)}" style="width:80px;margin:0"></td><td><select class="in" id="cm_q${i}" style="width:70px;margin:0">${[1, 2, 3, 4].map(n => `<option ${n === p.quarter ? "selected" : ""}>${n}</option>`).join("")}</select></td>
      <td><button class="btn pink" style="padding:6px 10px" onclick="taxCertManual(${TX.pending.indexOf(p)},${i})">Attach</button></td></tr>`).join("")}</tbody></table>` : ""}</div>`;
  if (saved) setTimeout(() => taxPage(), miss.length ? 600000 : 2500);
}
async function taxCertSave(p) {
  const path = `${p.shop}/form131-${p.fy}-Q${p.quarter}.pdf`;
  const up = await db.storage.from("tds-certs").upload(path, new Blob([p.buf], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true });
  if (up.error) return up.error.message;
  const { error } = await db.rpc("admin_tds_cert", { p_shop: p.shop, p_fy: p.fy, p_quarter: p.quarter, p_path: path, p_source: "upload" });
  return error ? error.message : null;
}
async function taxCertManual(k, i) {
  const p = TX.pending[k]; p.shop = $("#cm_s" + i).value; p.fy = $("#cm_fy" + i).value.trim(); p.quarter = +$("#cm_q" + i).value;
  if (!p.shop) return alert("Pick the shop"); if (!fyOk(p.fy)) return alert("FY looks like 26-27");
  const e = await taxCertSave(p); if (e) return alert(e);
  p.done = true; $("#cm_s" + i).closest("tr").innerHTML = `<td colspan="5">✓ ${esc(p.name)} attached — shop notified</td>`;
}
// tds@ inbox
async function taxInboxSet(id, st, shop) { const { error } = await db.rpc("tax_inbox_set", { p_id: id, p_status: st, p_shop: shop || null }); if (error) return alert(error.message); taxPage(); }
async function taxInboxAttach(id, path) {
  const shop = $("#ib_s_" + id).value; if (!shop) return alert("Pick the shop");
  const fy = $("#ce_fy").value.trim(), qn = +$("#ce_q").value; if (!fyOk(fy)) return alert("Set the FY (26-27) in the Form 131 box above");
  if (!confirm(`Attach as Form 131 FY ${fy} Q${qn}?`)) return;
  const { data: blob, error: de } = await db.storage.from("tds-certs").download(path); if (de) return alert(de.message);
  const e = await taxCertSave({ shop, fy, quarter: qn, buf: await blob.arrayBuffer() }); if (e) return alert(e);
  taxInboxSet(id, "DONE", shop);
}
function taxUseReceipt(id, path) {
  const n = $$("[id^=ch_f]").length; if (!n) return alert("No challan is due right now — skip it if it's already entered");
  (TX.receipt = TX.receipt || {})[0] = path; TX.receiptInbox = id;
  $("#ch_m0").textContent = "Receipt from tds@ mail attached to this row — check the fields, then Save.";
  db.storage.from("tds-certs").download(path).then(async ({ data }) => { if (!data) return; const t = await pdfText(await data.arrayBuffer()).catch(() => "");
    const get = re => (t.match(re) || [])[1] || "", set = (k, v) => { if (v && !$("#" + k).value) $("#" + k).value = v; };
    set("ch_b0", get(/BSR\s*code\s*:?\s*(\d{7})/i)); set("ch_s0", get(/Challan\s*(?:Serial\s*)?No\.?\s*:?\s*(\d{1,5})\b/i));
    set("ch_u0", get(/(?:Bank\s*Reference\s*(?:No\.?|Number)?|UTR(?:\s*No\.?)?)\s*:?\s*([A-Za-z0-9]{6,30})/i)); });
  $("#ch_m0").scrollIntoView({ behavior: "smooth", block: "center" });
}
async function taxResend(id, btn) {
  btn.disabled = true; btn.textContent = "Sending…";
  const { data, error } = await db.functions.invoke("push", { body: { action: "tax_mail_resend", id } });
  alert(error || !data?.ok ? "Couldn't send: " + (error?.message || data?.error || "") : "Sent to the tax mail list"); taxPage();
}
// admin: accountants + the tax mail list + what everyone did
async function taxTeam() {
  if (window.ACCOUNTANT) return;
  const [team, log, { data: st }] = await Promise.all([q("tax_team", "*", x => x.order("added_at")), q("tax_audit", "*", x => x.order("at", { ascending: false }).limit(30)).catch(() => []),
    db.from("settings").select("tax_report_emails").eq("id", 1).maybeSingle()]);
  const mails = st?.tax_report_emails || [];
  $("#txTeam").innerHTML = `<div class="box" ${mails.length ? "" : 'style="border:2px solid #E5484D;background:#FFF5F6"'}><h3>Tax team &amp; mail list</h3>
    <div class="sub"><b>Mail list</b> — every tax mail (statements, reminders, tds@ summaries) goes to these. Add your own email and the accountant's.</div>
    ${mails.length ? "" : `<div class="sub" style="color:#B0144F"><b>Empty — no tax mail can be sent.</b></div>`}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:8px"><input class="in" id="tm_l" value="${esc(mails.join(", "))}" placeholder="you@…, ca@…" style="flex:1;min-width:260px"><button class="btn pink" onclick="taxMailList()">Save list</button></div>
    <div class="sub" style="margin-top:14px"><b>Accountants</b> — they sign in at galibazaar.site/admin with this email and see only Tax &amp; TDS (challans, returns, Form 131, statements). They can't change rates, TAN or anything else.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:8px"><input class="in" id="tt_e" type="email" placeholder="accountant@…" style="min-width:240px"><button class="btn" onclick="taxTeamSet($('#tt_e').value,true)">Add accountant</button></div>
    ${team.length ? `<table style="margin-top:8px"><tbody>${team.map(t => `<tr><td>${esc(t.email)}</td><td>${new Date(t.added_at).toLocaleDateString("en-IN")}</td><td><button class="btn ghost" style="padding:6px 10px" onclick="taxTeamSet('${esc(t.email)}',false)">Remove</button></td></tr>`).join("")}</tbody></table>` : ""}</div>
    <div class="box"><h3>Tax activity log</h3>${log.length ? log.map(l => `<div style="padding:10px 0;border-top:1px solid #F0EAF7;overflow-wrap:anywhere">
      <div><b>${esc(TXACT[l.action] || (l.action || "").replace(/^./, c => c.toUpperCase()))}</b></div>
      <div class="sub" style="margin:2px 0 0">${new Date(l.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · ${esc(l.email || "system")}</div>
      ${(() => { const d = Object.entries(l.detail || {}).filter(([k]) => k !== "result").map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ").slice(0, 160); return d ? `<div class="sub" style="margin:2px 0 0">${esc(d)}</div>` : ""; })()}</div>`).join("") : `<div class="sub">Nothing yet.</div>`}</div>`;
}
const TXACT = { "tax mail list": "Tax mail list saved", "challan entered": "Challan entered", "challan UTR": "Challan UTR added", "return filed": "Return filed" };
async function taxMailList() { const { error } = await db.rpc("admin_tax_emails", { p_emails: $("#tm_l").value.split(/[\s,;]+/).filter(Boolean) }); if (error) return alert(error.message); taxBanner(); taxTeam(); }
async function taxTeamSet(e, add) { if (!add && !confirm(`Remove ${e}? They can't open Tax & TDS after this.`)) return; const { error } = await db.rpc("admin_tax_team", { p_email: e, p_add: add }); if (error) return alert(error.message); taxTeam(); }
// the banner also covers a TDS challan that hasn't been entered
const _taxBanner0 = taxBanner;
taxBanner = async function () {
  await _taxBanner0();
  if (document.getElementById("taxbar")) return;
  const { data } = await db.rpc("tds_challans_due"); if (!data || !data.length) return;
  const b = document.createElement("div"); b.id = "taxbar"; document.body.prepend(b);
  b.style.cssText = "position:sticky;top:0;z-index:49;background:#B0144F;color:#fff;padding:9px 16px;font-weight:600;cursor:pointer;font-size:14px";
  b.onclick = () => go("tax");
  b.textContent = `TDS challan not entered: ${data.map(d => `${d.kind === "ecom" ? "e-commerce" : "commission"} ${txMon(d.month)} ${inr(d.tds)} (by ${d.due_by})`).join(" · ")}`;
};
