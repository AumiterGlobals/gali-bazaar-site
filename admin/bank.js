// ---------------- Bank statement (update-72) ----------------
// The file is read here in the browser and never uploaded or saved. Only credit rows go to the server, and the server keeps only the
// rows that match a seller payment (date, UTR, amount, first 40 characters of the narration). Match = UTR (also inside the narration)
// + exact amount + date within 3 days. Payments the statement should contain (payment date + 2 days inside its dates) but doesn't
// are marked "Not found" and the seller is told to re-check the UTR.
const BK = { rows: [], head: [], map: null };
const bkDate = v => {
  if (v == null || v === "") return null;
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }   // Excel serial
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/\-. ](\d{1,2}|[A-Za-z]{3})[\/\-. ](\d{2,4})/);
  if (m) { const mon = isNaN(+m[2]) ? "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(m[2].toLowerCase()) / 3 + 1 : +m[2];
    const y = m[3].length === 2 ? "20" + m[3] : m[3]; return mon >= 1 ? `${y}-${String(mon).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null; }
  return null;
};
const bkNum = v => { if (typeof v === "number") return v; const n = parseFloat(String(v ?? "").replace(/[₹,\s]/g, "").replace(/(Cr|CR)$/, "")); return isNaN(n) ? 0 : n; };
const bkXlsx = () => window.XLSX ? Promise.resolve() : new Promise((ok, bad) => { const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; s.onload = ok; s.onerror = () => bad(new Error("Couldn't load the Excel reader")); document.head.append(s); });

async function bankPage() {
  const [{ data: st }, list] = await Promise.all([db.from("settings").select("bank_map").eq("id", 1).maybeSingle(),
    q("bank_statements", "*", x => x.order("created_at", { ascending: false }).limit(20))]);
  BK.map = st?.bank_map || null;
  $("#main").innerHTML = head("Bank statement", "Match seller plan payments with your bank statement. The file stays on this computer — only matched rows are kept.") + `
    <div class="box"><h3>1 · Choose the statement</h3>
      <div class="sub">Download the statement from your bank as CSV or Excel (.xlsx / .xls) and pick it here.</div>
      <input type="file" id="bkFile" accept=".csv,.xlsx,.xls,text/csv" class="in" style="margin-top:10px" onchange="bkRead(this.files[0])"></div>
    <div id="bkMap"></div><div id="bkRes"></div>
    <div class="box"><h3>Earlier statements</h3>${list.length ? `<table><thead><tr><th>Dates</th><th>Uploaded</th><th style="text-align:right">Credit rows</th><th style="text-align:right">Matched</th><th style="text-align:right">Not found</th></tr></thead><tbody>
      ${list.map(b => `<tr><td><b>${esc(b.from_date)} → ${esc(b.to_date)}</b></td><td>${new Date(b.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
        <td style="text-align:right">${b.credit_rows}</td><td style="text-align:right">${b.matched}</td><td style="text-align:right">${b.not_found}</td></tr>`).join("")}</tbody></table>` : `<div class="sub">None yet.</div>`}</div>`;
}

async function bkRead(f) {
  if (!f) return;
  try {
    await bkXlsx();
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: false, raw: false });
    const all = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    // the header row: the first row that has a date-like and an amount-like title
    let hi = all.findIndex(r => r.some(c => /date/i.test(c)) && r.some(c => /credit|deposit|amount|cr\b/i.test(c)));
    if (hi < 0) hi = 0;
    BK.head = all[hi].map((c, i) => String(c || `Column ${i + 1}`).trim());
    BK.rows = all.slice(hi + 1).filter(r => r.some(c => c !== ""));
    bkMapForm();
  } catch (e) { $("#bkMap").innerHTML = `<div class="box"><div class="msg err">${esc(e.message)}</div></div>`; }
}

function bkMapForm() {
  const m = BK.map || {}, guess = re => BK.head.findIndex(h => re.test(h));
  const pick = (k, re) => { const i = m[k] != null && BK.head[m[k]] === m[k + "_name"] ? m[k] : guess(re); return i; };
  const sel = (id, label, i, opt) => `<div style="flex:1;min-width:180px"><div class="sub" style="margin:0 0 4px">${label}</div><select class="in" id="${id}">${opt ? '<option value="-1">— none —</option>' : ""}
      ${BK.head.map((h, j) => `<option value="${j}" ${j === i ? "selected" : ""}>${esc(h)}</option>`).join("")}</select></div>`;
  $("#bkMap").innerHTML = `<div class="box"><h3>2 · Columns ${BK.map ? '<span class="pill ok" style="margin-left:6px">saved mapping used</span>' : ""}</h3>
    <div class="sub">Tell us once which column is which — it's remembered for next time. ${BK.rows.length} rows in the file.</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
      ${sel("bk_date", "Date", pick("date", /^(txn |transaction |value )?date/i))}
      ${sel("bk_cr", "Credit / deposit amount", pick("cr", /credit|deposit|cr amount|^cr$/i))}
      ${sel("bk_dr", "Debit / withdrawal amount (TDS challans)", pick("dr", /debit|withdraw|dr amount|^dr$/i), true)}
      ${sel("bk_ref", "UTR / reference no.", pick("ref", /ref|utr|chq|cheque/i), true)}
      ${sel("bk_nar", "Narration / description", pick("nar", /narration|description|particular|remark/i), true)}</div>
    <button class="btn pink" style="margin-top:14px" onclick="bkGo()">Check payments</button><div id="bkMsg"></div></div>`;
}

async function bkGo() {
  const c = id => +$("#" + id).value, map = { date: c("bk_date"), cr: c("bk_cr"), dr: c("bk_dr"), ref: c("bk_ref"), nar: c("bk_nar") };
  ["date", "cr", "dr", "ref", "nar"].forEach(k => map[k + "_name"] = BK.head[map[k]] ?? "");
  const base = r => ({ date: bkDate(r[map.date]), ref: map.ref >= 0 ? String(r[map.ref] ?? "") : "", narration: map.nar >= 0 ? String(r[map.nar] ?? "") : "" });
  const credits = BK.rows.map(r => ({ ...base(r), type: "CR", amount: bkNum(r[map.cr]) })).filter(r => r.date && r.amount > 0);
  // debits: only our own tax payments (TDS challans) are sent — nothing else leaves this computer
  const TAX = /(TAX|CBDT|ITD|TDS|CIN|TIN-?NSDL|E-?PAY)/i;
  const debits = map.dr >= 0 ? BK.rows.map(r => ({ ...base(r), type: "DR", amount: bkNum(r[map.dr]) })).filter(r => r.date && r.amount > 0 && TAX.test(r.narration + " " + r.ref)) : [];
  const rows = credits.concat(debits);
  if (!rows.length) { $("#bkMsg").innerHTML = `<div class="msg err">No credit rows found — check the Date and Credit columns.</div>`; return; }
  const ds = rows.map(r => r.date).sort(), from = ds[0], to = ds[ds.length - 1];
  if (!confirm(`${credits.length} credit rows${debits.length ? ` + ${debits.length} tax payments` : ""} from ${from} to ${to}. Check payments now?`)) return;
  await db.rpc("admin_save_bank_map", { p_map: map }); BK.map = map;
  const { data, error } = await db.rpc("admin_bank_statement", { p_from: from, p_to: to, p_rows: rows });
  BK.rows = []; $("#bkFile").value = ""; $("#bkMap").innerHTML = "";   // nothing of the file is kept here either
  if (error) { $("#bkRes").innerHTML = `<div class="box"><div class="msg err">${esc(error.message)}</div></div>`; return; }
  const ok = data.matched || [], nf = data.not_found || [];
  $("#bkRes").innerHTML = `<div class="box"><h3>Result · ${esc(from)} → ${esc(to)}</h3>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 12px">
      <div class="box" style="flex:1;min-width:160px;margin:0;background:#EEFBF4"><div class="sub" style="margin:0">Verified</div><div style="font-size:26px;font-weight:800;color:#0B7A47">${ok.length}</div></div>
      <div class="box" style="flex:1;min-width:160px;margin:0;background:#FDE7EE"><div class="sub" style="margin:0">Not found (seller told)</div><div style="font-size:26px;font-weight:800;color:#B0144F">${nf.length}</div></div>
      <div class="box" style="flex:1;min-width:160px;margin:0"><div class="sub" style="margin:0">TDS challans matched</div><div style="font-size:26px;font-weight:800">${data.tds_challans || 0}</div></div></div>
    ${ok.length ? `<table><thead><tr><th>UTR</th><th style="text-align:right">Amount</th><th>Result</th></tr></thead><tbody>${ok.map(x => `<tr><td>${esc(x.utr)}</td><td style="text-align:right">${inr(x.amount)}</td><td><span class="pill ok">Verified · invoice sent</span></td></tr>`).join("")}
      ${nf.map(x => `<tr><td>${esc(x.utr)}</td><td style="text-align:right">${inr(x.amount)}</td><td><span class="pill bad">Not found${x.times > 1 ? " ×" + x.times : ""}</span></td></tr>`).join("")}</tbody></table>`
      : nf.length ? `<table><tbody>${nf.map(x => `<tr><td>${esc(x.utr)}</td><td style="text-align:right">${inr(x.amount)}</td><td><span class="pill bad">Not found${x.times > 1 ? " ×" + x.times : ""}</span></td></tr>`).join("")}</tbody></table>` : `<div class="sub">No seller payment was waiting for these dates.</div>`}
    <div class="sub" style="margin-top:10px">Payments paid in the last 2 days of the statement stay "Checking" until the next statement.</div></div>`;
}
