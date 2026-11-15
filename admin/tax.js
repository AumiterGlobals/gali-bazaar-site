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
      ${chk("ecom_tds_on", "TDS on — on the 1st, last month's sales are worked out and a TDS recovery note goes to each shop", s.ecom_tds_on ?? true)}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
        ${f("ecom_tds_rate", "Rate %", s.ecom_tds_rate, "0.1", "number")}${f("ecom_tds_no_pan_rate", "Rate % without PAN", s.ecom_tds_no_pan_rate, "5", "number")}
        ${f("ecom_tds_threshold", "Individual / HUF yearly threshold ₹", s.ecom_tds_threshold, "500000", "number")}</div>
      ${chk("ecom_tds_catch_up", "Catch-up (on): in the month an individual / HUF crosses ₹5 lakh, TDS on the whole year's sales so far (off = only on the part above the threshold)", s.ecom_tds_catch_up ?? true)}
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

// ---------------- update-74: challans, monthly / quarterly files, Form 131 certificates ----------------
async function taxReports() {
  const [{ data: due }, chal, runs, certs, shops] = await Promise.all([db.rpc("tds_challans_due"), q("tds_challans", "*", x => x.order("month", { ascending: false }).limit(24)),
    q("statement_runs", "*", x => x.order("sent_at", { ascending: false }).limit(12)), q("tds_certificates", "*", x => x.order("created_at", { ascending: false }).limit(50)),
    q("shops", "id,name", x => x.eq("kyc", "APPROVED").order("name"))]);
  const rets = await q("tds_returns", "*", x => x.order("fy", { ascending: false }).limit(16));
  const kindL = k => k === "ecom" ? "E-commerce TDS (shops)" : "Commission TDS (sales partners)";
  const fy = (() => { const d = new Date(); const y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(); return `${String(y).slice(2)}-${String(y + 1).slice(2)}`; })();
  $("#txMore").innerHTML = `
    <div class="box" ${(due || []).length ? 'style="border:2px solid #E5484D;background:#FFF5F6"' : ""}><h3>TDS challans</h3>
      ${(due || []).length ? `<div class="sub" style="color:#B0144F;margin-bottom:10px">Enter the challan once you have paid — the banner stays until then.</div>` : `<div class="sub">All challans entered ✓</div>`}
      ${(due || []).map((d, i) => `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;padding:10px 0;border-top:1px solid #F1ECF4">
        <div style="min-width:220px;flex:1"><b>${kindL(d.kind)} · ${txMon(d.month)}</b><div class="sub" style="margin:2px 0 0">TDS ${inr(d.tds)} · deposit by ${esc(d.due_by)}</div></div>
        <input class="in" id="ch_a${i}" type="number" value="${d.tds}" style="width:110px" title="Amount">
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
      <div class="sub">Download each shop's certificate from TRACES after the quarterly return, then upload it here — the shop sees it in Subscription &amp; bills → TDS.</div>
      <div class="sub" style="margin-top:4px;color:#B26A00">TRACES se download kiya hua hi upload karein.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:10px">
        <select class="in" id="ce_s" style="min-width:200px">${shops.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
        <input class="in" id="ce_fy" value="${fy}" style="width:90px" title="FY"><select class="in" id="ce_q" style="width:90px">${[1, 2, 3, 4].map(n => `<option value="${n}">Q${n}</option>`).join("")}</select>
        <input class="in" id="ce_f" type="file" accept="application/pdf" style="max-width:240px"><button class="btn pink" onclick="taxCert()">Upload</button></div>
      ${certs.length ? `<table style="margin-top:12px"><tbody>${certs.map(c => `<tr><td>${esc(shops.find(s => s.id === c.shop)?.name || "Shop")}</td><td>FY ${esc(c.fy)} · Q${c.quarter}</td><td>${new Date(c.created_at).toLocaleDateString("en-IN")}</td></tr>`).join("")}</tbody></table>` : ""}</div>`;
}
async function taxChallan(i, month, kind) {
  const { error } = await db.rpc("admin_tds_challan", { p_month: month, p_kind: kind, p_amount: +$("#ch_a" + i).value, p_paid_on: $("#ch_d" + i).value || null,
    p_bsr: $("#ch_b" + i).value, p_serial: $("#ch_s" + i).value, p_utr: $("#ch_u" + i).value || null, p_receipt: TX.receipt?.[i] || null });
  if (error) return alert(error.message); taxPage(); taxBanner();
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
  if (error || !data?.ok) return alert("Couldn't send: " + (error?.message || data?.note || "check the admin email in Settings"));
  alert("Sent to the admin email"); taxPage();
}
async function taxReturn() {
  const { error } = await db.rpc("admin_tds_return", { p_fy: $("#rt_fy").value.trim(), p_quarter: +$("#rt_q").value, p_filed_on: $("#rt_d").value || null, p_token: $("#rt_t").value });
  if (error) return alert(error.message); taxPage();
}
async function taxCert() {
  const f = $("#ce_f").files[0]; if (!f) return alert("Choose the PDF"); if (f.size > 2 * 1024 * 1024) return alert("PDF must be under 2 MB");
  const shop = $("#ce_s").value, fy = $("#ce_fy").value.trim(), qn = +$("#ce_q").value, path = `${shop}/form131-${fy}-Q${qn}.pdf`;
  const up = await db.storage.from("tds-certs").upload(path, f, { contentType: "application/pdf", upsert: false });
  if (up.error) return alert(up.error.message);
  const { error } = await db.from("tds_certificates").insert({ shop, fy, quarter: qn, path }); if (error) return alert(error.message);
  taxPage();
}
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
