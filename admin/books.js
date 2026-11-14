/* Admin console · Accounts & books — trial balance, P&L, balance sheet, day book, ledgers, parties (vendors),
   vendor bills with GST + TDS, vendor payments, sales-team payouts with a TDS choice, CA downloads.
   Uses the accounting RPCs (accounting.sql + update-31-admin-books.sql). */
const TDS_SEC = { "194H": "2100", "194C": "2101", "194J": "2102", "194I": "2104", "194Q": "2105", "192": "2106", "194O": "2107" };
const tdsHeads = () => AC.acc.filter(a => /^21\d\d$/.test(a.code));
let AC = { tab: "reports", from: null, to: null, acc: [], parties: [] };
const fy0 = (d = new Date()) => { const i = new Date(+d + 19800000), y = i.getUTCMonth() >= 3 ? i.getUTCFullYear() : i.getUTCFullYear() - 1; return `${y}-04-01`; };
const n2 = v => Number(v || 0).toFixed(2);
const inr2 = v => "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const drcr = v => v >= 0 ? `${inr2(v)} Dr` : `${inr2(-v)} Cr`;
function csvDl(name, rows) {
  const s = rows.map(r => r.map(v => { v = String(v ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + s], { type: "text/csv" })); a.download = name; a.click();
}
async function rpc(fn, args) { const { data, error } = await db.rpc(fn, args || {}); if (error) throw error; return data; }

function acFy(a, b) { AC.from = a; AC.to = b > today() ? today() : b; accounts(); }
async function accounts() {
  AC.from = AC.from || fy0(); AC.to = AC.to || today();
  await fyLoad(null);
  AC.acc = await q("accounts", "*", x => x.eq("active", true).order("code"));
  AC.parties = await q("parties", "*", x => x.eq("active", true).order("name")).catch(() => []);
  const tabs = [["inv", "Sales invoices"], ["reports", "TB · P&L · Balance sheet"], ["day", "Day book"], ["ledger", "Ledger"], ["parties", "Vendors & parties"], ["bill", "＋ Vendor bill"], ["pay", "＋ Receipt / payment"], ["gst", "GST paid"], ["tds", "TDS"], ["payout", "Sales payouts (TDS)"]];
  $("#main").innerHTML = head("Accounts & books", "Double-entry books — plan payments, commission and payouts post by themselves",
    `<button class="btn pink" onclick="acPartyForm()">＋ New vendor</button> <button class="btn ghost" onclick="AC.tab='pay';accounts()">＋ Payment / receipt</button> <button class="btn ghost" onclick="fyManage(null, accounts)">Financial years</button> ${fySelect(AC.from, AC.to, "acFy")} <input type="date" class="in" id="acF" value="${AC.from}" style="width:auto"> <input type="date" class="in" id="acT" value="${AC.to}" style="width:auto">`) +
    `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${tabs.map(([k, l]) => `<button class="btn ${AC.tab === k ? "pink" : "ghost"}" onclick="AC.tab='${k}';accounts()">${l}</button>`).join("")}</div><div id="acBody"><div class="sub">Loading…</div></div>`;
  $("#acF").onchange = e => { AC.from = e.target.value; accounts(); };
  $("#acT").onchange = e => { AC.to = e.target.value; accounts(); };
  try { await ({ inv: acInvoices, reports: acReports, day: acDay, ledger: acLedger, parties: acParties, bill: acBill, pay: acPay, gst: acGst, tds: acTds, payout: acPayout })[AC.tab](); }
  catch (e) { $("#acBody").innerHTML = `<div class="soon err">${esc(e.message || e)}<br><span class="sub">Have you run update-31-admin-books.sql in Supabase?</span></div>`; }
}

async function acReports() {
  const b = await rpc("account_balances", { p_from: AC.from, p_to: AC.to });
  const nominal = x => x.type === "INCOME" || x.type === "EXPENSE";
  // TB: real accounts closing; P&L accounts = period movement
  const tb = b.map(x => ({ ...x, bal: nominal(x) ? Number(x.debit) - Number(x.credit) : Number(x.closing) })).filter(x => Math.abs(x.bal) > 0.004);
  const earlier = b.filter(nominal).reduce((a, x) => a + Number(x.opening), 0);
  if (Math.abs(earlier) > 0.004) tb.push({ code: "3900", name: "Profit of earlier periods", type: "EQUITY", bal: earlier });
  const dr = tb.filter(x => x.bal > 0).reduce((a, x) => a + x.bal, 0), cr = -tb.filter(x => x.bal < 0).reduce((a, x) => a + x.bal, 0);
  const inc = tb.filter(x => x.type === "INCOME"), exp = tb.filter(x => x.type === "EXPENSE");
  const ti = -inc.reduce((a, x) => a + x.bal, 0), te = exp.reduce((a, x) => a + x.bal, 0), profit = ti - te;
  const as = tb.filter(x => x.type === "ASSET"), li = tb.filter(x => x.type === "LIABILITY"), eq = tb.filter(x => x.type === "EQUITY");
  const tl = -li.reduce((a, x) => a + x.bal, 0) - eq.reduce((a, x) => a + x.bal, 0) + profit, ta = as.reduce((a, x) => a + x.bal, 0);
  const rowsTB = [["Code", "Account", "Group", "Debit", "Credit"], ...tb.map(x => [x.code, x.name, x.type, x.bal > 0 ? n2(x.bal) : "", x.bal < 0 ? n2(-x.bal) : ""]), ["", "TOTAL", "", n2(dr), n2(cr)]];
  const rowsPL = [["Particulars", "Amount"], ["INCOME", ""], ...inc.map(x => [x.name, n2(-x.bal)]), ["Total income", n2(ti)], ["EXPENSES", ""], ...exp.map(x => [x.name, n2(x.bal)]), ["Total expenses", n2(te)], [profit >= 0 ? "NET PROFIT" : "NET LOSS", n2(profit)]];
  const rowsBS = [["Particulars", "Amount"], ["CAPITAL & LIABILITIES", ""], ...eq.map(x => [x.name, n2(-x.bal)]), ["Profit for the period", n2(profit)], ...li.map(x => [x.name, n2(-x.bal)]), ["Total", n2(tl)], ["ASSETS", ""], ...as.map(x => [x.name, n2(x.bal)]), ["Total", n2(ta)]];
  const tbl = rows => `<table><thead><tr>${rows[0].map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map((v, i) => `<td style="${/^-?\d+\.\d\d$/.test(v) ? "text-align:right" : ""};${/^[A-Z &]+$/.test(r[0]) || r[1] === "TOTAL" || /^Total/.test(r[0]) ? "font-weight:700" : ""}">${/^-?\d+\.\d\d$/.test(v) ? inr2(v) : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const p = `${AC.from}_to_${AC.to}`;
  AC.dl = { tb: rowsTB, pl: rowsPL, bs: rowsBS };
  $("#acBody").innerHTML = `<div class="box"><h3>Trial balance <span>• ${AC.from} to ${AC.to} · ${Math.abs(dr - cr) < 0.01 ? "✓ tallies" : "✗ does not tally"}</span> <button class="edit" onclick="csvDl('trial-balance-${p}.csv',AC.dl.tb)">⬇ Excel</button></h3>${tbl(rowsTB)}</div>
    <div class="box"><h3>Profit &amp; loss <span>• ${AC.from} to ${AC.to}</span> <button class="edit" onclick="csvDl('profit-loss-${p}.csv',AC.dl.pl)">⬇ Excel</button></h3>${tbl(rowsPL)}</div>
    <div class="box"><h3>Balance sheet <span>• as on ${AC.to} · ${Math.abs(tl - ta) < 0.01 ? "✓ tallies" : "difference " + inr2(tl - ta)}</span> <button class="edit" onclick="csvDl('balance-sheet-${AC.to}.csv',AC.dl.bs)">⬇ Excel</button></h3>${tbl(rowsBS)}</div>`;
}

async function acDay() {
  const vs = await q("vouchers", "*, voucher_lines(debit,credit,account,party)", x => x.gte("vdate", AC.from).lte("vdate", AC.to).order("vdate").order("vno").limit(2000));
  const an = id => (AC.acc.find(a => a.id === id) || {}).name || "?", pn = id => (AC.parties.find(p => p.id === id) || {}).name || "";
  const rows = [["Date", "Voucher", "Type", "Narration", "Ref / bill", "Account", "Party", "Debit", "Credit"]];
  vs.forEach(v => (v.voucher_lines || []).forEach((l, i) => rows.push([i ? "" : v.vdate, i ? "" : v.vno, i ? "" : v.vtype, i ? "" : v.narration, i ? "" : (v.ref || ""), an(l.account), pn(l.party), l.debit > 0 ? n2(l.debit) : "", l.credit > 0 ? n2(l.credit) : ""])));
  AC.dl = { day: rows };
  $("#acBody").innerHTML = `<div class="box"><h3>Day book <span>• ${vs.length} vouchers</span> <button class="edit" onclick="csvDl('day-book-${AC.from}_to_${AC.to}.csv',AC.dl.day)">⬇ Excel</button></h3>
    <table><thead><tr>${rows[0].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map(v => `<td>${/^\d+\.\d\d$/.test(v) ? inr2(v) : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>${vs.length ? "" : '<div class="sub">No entries in this period.</div>'}</div>`;
}

async function acLedger() {
  AC.ledAcc = AC.ledAcc || (AC.acc.find(a => a.code === "1000") || AC.acc[0] || {}).id;
  const rows = AC.ledAcc ? await rpc("ledger", { p_account: AC.ledAcc, p_from: AC.from, p_to: AC.to }) : [];
  const b = await rpc("account_balances", { p_from: AC.from, p_to: AC.to }); const me = b.find(x => x.id === AC.ledAcc) || { opening: 0 };
  let run = Number(me.opening);
  const out = [["Date", "Voucher", "Type", "Narration", "Ref", "Debit", "Credit", "Balance"], ["", "", "", "Opening", "", "", "", n2(run)],
    ...rows.map(r => { run += Number(r.debit) - Number(r.credit); return [r.vdate, r.vno, r.vtype, r.narration, r.ref || "", Number(r.debit) ? n2(r.debit) : "", Number(r.credit) ? n2(r.credit) : "", n2(run)]; })];
  AC.dl = { led: out }; const nm = (AC.acc.find(a => a.id === AC.ledAcc) || {}).name || "";
  $("#acBody").innerHTML = `<div class="box"><h3>Ledger <select class="in" style="width:auto;display:inline-block" onchange="AC.ledAcc=this.value;acLedger()">${AC.acc.map(a => `<option value="${a.id}" ${a.id === AC.ledAcc ? "selected" : ""}>${a.code} · ${esc(a.name)}</option>`).join("")}</select>
    <button class="edit" onclick="csvDl('ledger-${nm.replace(/\W+/g, "-")}-${AC.from}_to_${AC.to}.csv',AC.dl.led)">⬇ Excel</button></h3>
    <table><thead><tr>${out[0].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${out.slice(1).map(r => `<tr>${r.map((v, i) => `<td>${i === 7 ? drcr(Number(v)) : /^\d+\.\d\d$/.test(v) ? inr2(v) : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

async function acParties() {
  const bal = await rpc("party_balances");
  const kinds = { VENDOR: "Vendor", SALES: "Sales team (freelancer)", SELLER: "Seller shop" };
  const rows = [["Party", "Type", "GSTIN", "PAN", "We owe them", "Received from them", "TDS deducted this FY"], ...bal.map(p => [p.name, kinds[p.kind] || p.kind, p.gstin || "", p.pan || "", n2(-Number(p.balance)), n2(p.received), n2(p.tds_fy)])];
  AC.dl = { parties: rows };
  $("#acBody").innerHTML = `<div class="box"><h3>Vendors &amp; parties <span>• sellers and sales people are added by themselves</span>
      <button class="edit" onclick="acPartyForm()">＋ New vendor</button> <button class="edit" onclick="csvDl('parties-${today()}.csv',AC.dl.parties)">⬇ Excel</button></h3>
    <table><thead><tr><th>PARTY</th><th>TYPE</th><th>GSTIN / PAN</th><th style="text-align:right">WE OWE</th><th style="text-align:right">RECEIVED</th><th style="text-align:right">TDS THIS FY</th><th></th></tr></thead><tbody>${bal.map(p => `<tr>
      <td><b>${esc(p.name)}</b></td><td><span class="pill ${p.kind === "VENDOR" ? "warn" : p.kind === "SALES" ? "ok" : "grey"}">${kinds[p.kind] || p.kind}</span></td>
      <td class="sub">${esc(p.gstin || "—")} / ${esc(p.pan || "—")}</td><td style="text-align:right"><b>${inr2(-Number(p.balance))}</b></td><td style="text-align:right">${inr2(p.received)}</td><td style="text-align:right">${inr2(p.tds_fy)}</td>
      <td><button class="edit" onclick="acPartyLedger('${p.id}')">Ledger</button> <button class="edit" onclick="acPartyForm('${p.id}')">Edit</button></td></tr>`).join("")}</tbody></table></div>`;
}
function acPartyForm(id) {
  const p = AC.parties.find(x => x.id === id) || { kind: "VENDOR" };
  const el = $("#panel"); el.classList.add("open"); document.body.classList.add("po");
  el.innerHTML = `<h2><span>${id ? "Edit party" : "New vendor"}</span><button class="x" onclick="closeForm()">×</button></h2>
    <label>NAME</label><input class="in" id="pn" value="${esc(p.name || "")}" placeholder="e.g. GoDaddy India, Supabase, CA Sharma & Co">
    <label>GSTIN</label><input class="in" id="pg" value="${esc(p.gstin || "")}" maxlength="15">
    <label>PAN</label><input class="in" id="pp" value="${esc(p.pan || "")}" maxlength="10">
    <label>ADDRESS</label><textarea class="in" id="pa" rows="2">${esc(p.addr || "")}</textarea>
    <label>STATE</label><input class="in" id="ps" value="${esc(p.state || "")}">
    <label>EMAIL / PHONE</label><input class="in" id="pe" value="${esc(p.email || "")}"><input class="in" id="ph" value="${esc(p.phone || "")}" style="margin-top:6px">
    <label>TDS SECTION / RATE % (if you deduct TDS for this vendor)</label><div style="display:flex;gap:6px"><input class="in" id="pts" value="${esc(p.tds_section || "")}" placeholder="194J / 194C / 194H"><input class="in" id="ptr" value="${p.tds_rate ?? ""}" inputmode="decimal" placeholder="10"></div>
    <div class="msg" id="pm"></div><button class="btn pink full" style="margin-top:14px" id="psv">Save</button>`;
  $("#psv").onclick = async () => {
    const row = { name: $("#pn").value.trim(), gstin: $("#pg").value.trim().toUpperCase() || null, pan: $("#pp").value.trim().toUpperCase() || null, state: $("#ps").value.trim() || null, addr: $("#pa").value.trim() || null,
      email: $("#pe").value.trim() || null, phone: $("#ph").value.trim() || null, tds_section: $("#pts").value.trim() || null, tds_rate: $("#ptr").value ? Number($("#ptr").value) : null };
    if (!row.name) return $("#pm").textContent = "Enter a name";
    const { error } = id ? await db.from("parties").update(row).eq("id", id) : await db.from("parties").insert({ ...row, kind: "VENDOR" });
    if (error) return $("#pm").textContent = error.message;
    closeForm(); accounts();
  };
}
async function acPartyLedger(id) {
  const p = AC.parties.find(x => x.id === id) || {};
  const rows = await rpc("party_ledger", { p_party: id, p_from: AC.from, p_to: AC.to });
  let run = 0;
  const out = [["Date", "Voucher", "Narration", "Ref / bill", "Account", "Debit", "Credit", "Balance"], ...rows.map(r => { run += Number(r.debit) - Number(r.credit); return [r.vdate, r.vno, r.narration, r.ref || "", r.account, Number(r.debit) ? n2(r.debit) : "", Number(r.credit) ? n2(r.credit) : "", n2(run)]; })];
  AC.dl = { pl2: out };
  const el = $("#panel"); el.classList.add("open"); document.body.classList.add("po");
  el.innerHTML = `<h2><span>${esc(p.name || "Party")}</span><button class="x" onclick="closeForm()">×</button></h2><div class="sub">${AC.from} to ${AC.to}</div>
    <button class="btn ghost" style="margin:10px 0" onclick="csvDl('party-ledger-${(p.name || "").replace(/\W+/g, "-")}.csv',AC.dl.pl2)">⬇ Excel</button>
    ${out.slice(1).map(r => `<div class="req"><b>${esc(r[2])}<br><span>${r[0]} · ${r[1]} · ${esc(r[4])}${r[3] ? " · " + esc(r[3]) : ""}</span></b><b style="flex:0;white-space:nowrap">${r[5] ? inr2(r[5]) + " Dr" : inr2(r[6]) + " Cr"}</b></div>`).join("") || '<div class="sub">No entries.</div>'}`;
}

function acBill() {
  const heads = AC.acc.filter(a => a.type === "EXPENSE" || a.type === "ASSET" && a.code === "1200");
  const vend = AC.parties.filter(p => p.kind !== "SELLER");
  $("#acBody").innerHTML = `<div class="box" style="max-width:640px"><h3>Vendor bill <span>• domain, storage, CA fees, ads … with GST input credit and TDS</span></h3>
    <label>VENDOR</label><select class="in" id="bv">${vend.map(p => `<option value="${p.id}">${esc(p.name)}${p.kind === "SALES" ? " (sales team)" : ""}</option>`).join("")}</select>
    <button class="edit" onclick="acPartyForm()">＋ New vendor</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>INVOICE NO</label><input class="in" id="bn"></div><div><label>INVOICE DATE</label><input class="in" type="date" id="bd" value="${today()}"></div></div>
    <label>EXPENSE HEAD</label><select class="in" id="bh">${heads.map(a => `<option value="${a.code}">${a.code} · ${esc(a.name)}</option>`).join("")}</select>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>TAXABLE VALUE ₹</label><input class="in" id="bt" inputmode="decimal"></div>
      <div><label>GST %</label><select class="in" id="bg">${[0, 5, 12, 18, 28, 40].map(r => `<option value="${r}" ${r === 18 ? "selected" : ""}>${r === 0 ? "Nil / 0" : r}%</option>`).join("")}</select></div></div>
    <label><input type="checkbox" id="btd"> Deduct TDS</label><div id="btw" style="display:none;grid-template-columns:1fr 1fr;gap:8px"><div style="grid-column:1/3"><label>TDS HEAD (SECTION)</label><select class="in" id="bth">${tdsHeads().map(a => `<option value="${a.code}">${esc(a.name)}</option>`).join("")}</select></div>
      <div><label>TDS %</label><input class="in" id="btr" inputmode="decimal" value="10"></div><div><label>TDS ₹</label><input class="in" id="bta" inputmode="decimal"></div></div>
    <label>PAID?</label><select class="in" id="bp"><option value="">Not yet — pay later</option>${AC.acc.filter(a => ["1000", "1010"].includes(a.code)).map(a => `<option value="${a.code}">Paid now from ${esc(a.name)}</option>`).join("")}</select>
    <div id="bpw" style="display:none;grid-template-columns:1fr 1fr;gap:8px"><div><label>UTR / CHEQUE NO</label><input class="in" id="bu"></div><div><label>UTR (PAYMENT) DATE</label><input class="in" type="date" id="bud" value="${today()}"></div></div>
    <label>NOTE</label><input class="in" id="bx" placeholder="e.g. galibazaar.site renewal 1 year">
    <div class="sub" id="bsum" style="margin-top:10px"></div><div class="msg" id="bm"></div><button class="btn pink full" id="bsv" style="margin-top:12px">Save bill</button></div>`;
  const calc = () => {
    const t = Number($("#bt").value || 0), g = Math.round(t * Number($("#bg").value) ) / 100;
    const p = AC.parties.find(x => x.id === $("#bv").value) || {};
    if ($("#btd").checked && !$("#bta").dataset.own) $("#bta").value = (Math.round(t * Number($("#btr").value || 0)) / 100).toFixed(2);
    const tds = $("#btd").checked ? Number($("#bta").value || 0) : 0;
    $("#bsum").innerHTML = `Taxable ${inr2(t)} + GST ${inr2(g)} = <b>${inr2(t + g)}</b>${tds ? ` · TDS ${inr2(tds)} · pay ${esc(p.name || "")} <b>${inr2(t + g - tds)}</b>` : ""}`;
    return { t, g, tds };
  };
  const pick = () => { const p = AC.parties.find(x => x.id === $("#bv").value) || {}; if (p.tds_rate) { $("#btd").checked = true; $("#btr").value = p.tds_rate; }
    const sec = String(p.tds_section || (p.kind === "SALES" ? "194H" : "")).toUpperCase().replace(/\s/g, ""); if (TDS_SEC[sec]) $("#bth").value = TDS_SEC[sec]; $("#btw").style.display = $("#btd").checked ? "grid" : "none"; calc(); };
  ["#bt", "#bg", "#btr"].forEach(s => $(s).oninput = calc); $("#bg").onchange = calc; $("#bv").onchange = pick;
  $("#bta").oninput = () => { $("#bta").dataset.own = "1"; calc(); };
  $("#btd").onchange = () => { $("#btw").style.display = $("#btd").checked ? "grid" : "none"; calc(); };
  $("#bp").onchange = () => $("#bpw").style.display = $("#bp").value ? "grid" : "none";
  pick();
  $("#bsv").onclick = async () => {
    const { t, g, tds } = calc(); if (!t) return $("#bm").textContent = "Enter the taxable value";
    $("#bsv").disabled = true;
    try {
      await rpc("admin_vendor_bill", { p_party: $("#bv").value, p_date: $("#bd").value, p_bill_no: $("#bn").value.trim() || null, p_head: $("#bh").value,
        p_taxable: t, p_gst: g, p_tds: tds, p_paid_from: $("#bp").value || null, p_pay_date: $("#bp").value ? $("#bud").value : null, p_narr: $("#bx").value.trim() || null, p_attachment: null,
        p_utr: $("#bp").value ? ($("#bu").value.trim() || null) : null, p_tds_code: $("#bth").value });
      AC.tab = "parties"; accounts();
    } catch (e) { $("#bm").textContent = e.message; $("#bsv").disabled = false; }
  };
}

function acPay() {
  const money = AC.acc.filter(a => ["1000", "1010", "1020"].includes(a.code));
  $("#acBody").innerHTML = `<div class="box" style="max-width:600px"><h3>Receipt / payment <span>• money received from, or paid to, anyone</span></h3>
    <div style="display:flex;gap:6px"><button class="btn pink" id="yk1">Paid to</button><button class="btn ghost" id="yk2">Received from</button></div>
    <label>PARTY (optional)</label><select class="in" id="yv"><option value="">— none —</option>${AC.parties.map(p => `<option value="${p.id}">${esc(p.name)} · ${p.kind === "SELLER" ? "seller" : p.kind === "SALES" ? "sales team" : "vendor"}</option>`).join("")}</select>
    <label id="yal">AGAINST (WHAT IS THIS FOR)</label><select class="in" id="yg">${AC.acc.filter(a => !["1000", "1010", "1020"].includes(a.code)).map(a => `<option value="${a.code}">${a.code} · ${esc(a.name)}</option>`).join("")}</select>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>AMOUNT ₹</label><input class="in" id="ya" inputmode="decimal"></div><div><label>UTR / PAYMENT DATE</label><input class="in" type="date" id="yd" value="${today()}"></div></div>
    <label id="yml">PAID FROM</label><select class="in" id="yf">${money.map(a => `<option value="${a.code}">${esc(a.name)}</option>`).join("")}</select>
    <label>UTR / CHEQUE NO</label><input class="in" id="yr" placeholder="12-digit UTR"><label>NOTE</label><input class="in" id="yx">
    <div class="msg" id="ym"></div><button class="btn pink full" id="ysv" style="margin-top:12px">Save</button></div>`;
  let kind = "PAYMENT";
  const set = k => { kind = k; $("#yk1").className = "btn " + (k === "PAYMENT" ? "pink" : "ghost"); $("#yk2").className = "btn " + (k === "RECEIPT" ? "pink" : "ghost");
    $("#yml").textContent = k === "PAYMENT" ? "PAID FROM" : "RECEIVED INTO"; dflt(); };
  const dflt = () => { const p = AC.parties.find(x => x.id === $("#yv").value); $("#yg").value = !p ? (kind === "PAYMENT" ? "2300" : "4100") : p.kind === "SALES" ? "2000" : p.kind === "SELLER" ? (kind === "RECEIPT" ? "4000" : "4100") : "2300"; };
  $("#yk1").onclick = () => set("PAYMENT"); $("#yk2").onclick = () => set("RECEIPT"); $("#yv").onchange = dflt; set("PAYMENT");
  $("#ysv").onclick = async () => {
    const a = Number($("#ya").value || 0); if (!a) return $("#ym").textContent = "Enter the amount";
    try { await rpc("admin_money", { p_kind: kind, p_date: $("#yd").value, p_amount: a, p_mode: $("#yf").value, p_against: $("#yg").value, p_party: $("#yv").value || null, p_ref: $("#yr").value.trim() || null, p_narr: $("#yx").value.trim() || null });
      AC.tab = "day"; accounts(); }
    catch (e) { $("#ym").textContent = e.message; }
  };
}

async function acGst() {
  const b = await rpc("account_balances", { p_from: AC.from, p_to: AC.to });
  const bal = c => Number((b.find(x => x.code === c) || {}).closing || 0);
  const out = { c: -bal("2201"), s: -bal("2202"), i: -bal("2203") }, itc = bal("1100");
  $("#acBody").innerHTML = `<div class="box" style="max-width:640px"><h3>GST paid (GSTR-3B) <span>• output GST cleared with input credit + cash</span></h3>
    <div class="sub">As on ${AC.to}: output CGST ${inr2(out.c)} · SGST ${inr2(out.s)} · IGST ${inr2(out.i)} · input credit available ${inr2(itc)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div><label>CGST ₹</label><input class="in" id="gc" value="${n2(Math.max(out.c, 0))}"></div><div><label>SGST ₹</label><input class="in" id="gs" value="${n2(Math.max(out.s, 0))}"></div><div><label>IGST ₹</label><input class="in" id="gi" value="${n2(Math.max(out.i, 0))}"></div></div>
    <label>INPUT CREDIT USED ₹</label><input class="in" id="gt" value="${n2(Math.max(0, Math.min(itc, out.c + out.s + out.i)))}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>PAID FROM</label><select class="in" id="gf">${AC.acc.filter(a => ["1000", "1010"].includes(a.code)).map(a => `<option value="${a.code}">${esc(a.name)}</option>`).join("")}</select></div><div><label>DATE</label><input class="in" type="date" id="gd" value="${today()}"></div></div>
    <label>CHALLAN / CPIN / CIN</label><input class="in" id="gr"><div class="sub" id="gsum" style="margin-top:8px"></div><div class="msg" id="gm"></div><button class="btn pink full" id="gsv" style="margin-top:12px">Record GST payment</button></div>`;
  const v = id => Number($(id).value || 0);
  const sum = () => $("#gsum").innerHTML = `Total GST ${inr2(v("#gc") + v("#gs") + v("#gi"))} − input credit ${inr2(v("#gt"))} = <b>cash ${inr2(v("#gc") + v("#gs") + v("#gi") - v("#gt"))}</b>`;
  ["#gc", "#gs", "#gi", "#gt"].forEach(x => $(x).oninput = sum); sum();
  $("#gsv").onclick = async () => {
    try { await rpc("admin_gst_payment", { p_date: $("#gd").value, p_cgst: v("#gc"), p_sgst: v("#gs"), p_igst: v("#gi"), p_itc: v("#gt"), p_mode: $("#gf").value, p_ref: $("#gr").value.trim() || null }); AC.tab = "reports"; accounts(); }
    catch (e) { $("#gm").textContent = e.message; }
  };
}

async function acTds() {
  AC.tdsAcc = AC.tdsAcc || "all";
  const heads = tdsHeads(), b = await rpc("account_balances", { p_from: AC.from, p_to: AC.to });
  const pick = AC.tdsAcc === "all" ? heads : heads.filter(h => h.code === AC.tdsAcc);
  const led = (await Promise.all(pick.map(h => rpc("ledger", { p_account: h.id, p_from: AC.from, p_to: AC.to }).then(r => r.map(x => ({ ...x, head: h.name })))))).flat()
    .sort((x, y) => (x.vdate + x.vno).localeCompare(y.vdate + y.vno));
  let run = pick.reduce((a, h) => a + Number((b.find(x => x.code === h.code) || {}).opening || 0), 0);
  const out = [["Date", "Voucher", "TDS head", "Narration", "Ref", "Deducted (Cr)", "Deposited (Dr)", "Balance to deposit"], ["", "", "", "Opening", "", "", "", n2(-run)],
    ...led.map(r => { run += Number(r.debit) - Number(r.credit); return [r.vdate, r.vno, r.head, r.narration, r.ref || "", Number(r.credit) ? n2(r.credit) : "", Number(r.debit) ? n2(r.debit) : "", n2(-run)]; })];
  const sum = heads.map(h => { const x = b.find(y => y.code === h.code) || {}; return [h.name, n2(x.credit), n2(x.debit), n2(-Number(x.closing || 0))]; });
  const bal = await rpc("party_balances");
  const pw = [["Party", "PAN", "TDS deducted this FY"], ...bal.filter(p => Number(p.tds_fy) > 0).map(p => [p.name, p.pan || "NO PAN", n2(p.tds_fy)])];
  const recv = b.find(x => x.code === "1150");
  AC.dl = { tds: out, tdsp: pw, tdss: [["TDS head", "Deducted", "Deposited", "To deposit"], ...sum] };
  $("#acBody").innerHTML = `<div class="box"><h3>TDS heads <span>• ${AC.from} to ${AC.to}</span> <button class="edit" onclick="csvDl('tds-summary-${AC.from}_to_${AC.to}.csv',AC.dl.tdss)">⬇ Excel</button></h3>
      <table><thead><tr><th>TDS HEAD</th><th style="text-align:right">DEDUCTED</th><th style="text-align:right">DEPOSITED</th><th style="text-align:right">TO DEPOSIT</th></tr></thead><tbody>${sum.map(r => `<tr><td>${esc(r[0])}</td><td style="text-align:right">${inr2(r[1])}</td><td style="text-align:right">${inr2(r[2])}</td><td style="text-align:right"><b>${inr2(r[3])}</b></td></tr>`).join("")}</tbody></table>
      ${recv ? `<div class="sub" style="margin-top:8px">TDS receivable (deducted by your customers, claim in your return): <b>${inr2(recv.closing)}</b></div>` : ""}</div>
    <div class="box"><h3>TDS ledger <select class="in" style="width:auto;display:inline-block" onchange="AC.tdsAcc=this.value;acTds()"><option value="all">All TDS heads</option>${heads.map(h => `<option value="${h.code}" ${AC.tdsAcc === h.code ? "selected" : ""}>${esc(h.name)}</option>`).join("")}</select>
      <button class="edit" onclick="csvDl('tds-ledger-${AC.from}_to_${AC.to}.csv',AC.dl.tds)">⬇ Excel</button></h3>
    <table><thead><tr>${out[0].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${out.slice(1).map(r => `<tr>${r.map(v => `<td>${/^-?\d+\.\d\d$/.test(v) ? inr2(v) : esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="box"><h3>TDS by party <span>• for Form 26Q / 16A</span> <button class="edit" onclick="csvDl('tds-party-wise-${today()}.csv',AC.dl.tdsp)">⬇ Excel</button></h3>
      ${pw.slice(1).map(r => `<div class="req"><b>${esc(r[0])}<br><span>PAN ${esc(r[1])}</span></b><b style="flex:0">${inr2(r[2])}</b></div>`).join("") || '<div class="sub">No TDS deducted this year.</div>'}</div>
    <div class="box" style="max-width:560px"><h3>TDS deposited (challan 281)</h3>
      <label>TDS HEAD</label><select class="in" id="tth">${heads.map(h => `<option value="${h.code}">${esc(h.name)}</option>`).join("")}</select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>AMOUNT ₹</label><input class="in" id="ta"></div><div><label>CHALLAN DATE</label><input class="in" type="date" id="td" value="${today()}"></div></div>
      <label>PAID FROM</label><select class="in" id="tf">${AC.acc.filter(a => ["1000", "1010"].includes(a.code)).map(a => `<option value="${a.code}">${esc(a.name)}</option>`).join("")}</select>
      <label>CHALLAN NO / BSR / CIN</label><input class="in" id="tr"><div class="msg" id="tm"></div><button class="btn pink full" id="tsv" style="margin-top:12px">Record TDS deposit</button></div>`;
  const fill = () => { const r = sum.find(x => x[0] === (heads.find(h => h.code === $("#tth").value) || {}).name); $("#ta").value = r ? Math.max(0, +r[3]).toFixed(2) : ""; };
  $("#tth").onchange = fill; fill();
  $("#tsv").onclick = async () => {
    const a = Number($("#ta").value || 0); if (!a) return $("#tm").textContent = "Enter the amount";
    try { await rpc("admin_money", { p_kind: "PAYMENT", p_date: $("#td").value, p_amount: a, p_mode: $("#tf").value, p_against: $("#tth").value, p_party: null, p_ref: $("#tr").value.trim() || null, p_narr: "TDS deposited (challan 281)" }); accounts(); }
    catch (e) { $("#tm").textContent = e.message; }
  };
}

async function acPayout() {
  const sp = await q("sales_people", "id,name,pan,upi,active", x => x.order("name"));
  const pv = await Promise.all(sp.map(p => rpc("tds_preview", { p_sales: p.id }).catch(() => null)));
  $("#acBody").innerHTML = `<div class="box"><h3>Sales-team payouts <span>• sales people are freelancers (vendor, TDS u/s 194H)</span></h3>
    <table><thead><tr><th>SALES PERSON</th><th>PAN</th><th style="text-align:right">DUE</th><th style="text-align:right">FY COMMISSION</th><th style="text-align:right">SUGGESTED TDS</th><th></th></tr></thead><tbody>${sp.map((p, i) => { const v = pv[i] || {}; return `<tr>
      <td><b>${esc(p.name)}</b><br><span class="sub">${esc(p.upi || "")}</span></td><td>${p.pan ? esc(p.pan) : '<span class="pill bad">No PAN — higher TDS</span>'}</td>
      <td style="text-align:right"><b>${inr2(v.due)}</b></td><td style="text-align:right">${inr2(v.fy_credited)}</td><td style="text-align:right">${inr2(v.tds)} <span class="sub">@${v.rate ?? ""}%</span></td>
      <td>${Number(v.due) > 0 ? `<button class="edit" onclick="acPayoutForm('${p.id}')">Pay</button>` : ""}</td></tr>`; }).join("")}</tbody></table>
    <div class="sub">TDS is suggested once a person's commission crosses the yearly limit (Settings). You can change it or pay without TDS.</div></div>`;
  AC.pv = Object.fromEntries(sp.map((p, i) => [p.id, { ...pv[i], name: p.name }]));
}
function acPayoutForm(id) {
  const v = AC.pv[id] || {};
  const el = $("#panel"); el.classList.add("open"); document.body.classList.add("po");
  el.innerHTML = `<h2><span>Pay ${esc(v.name)}</span><button class="x" onclick="closeForm()">×</button></h2>
    <div class="sub">Commission due ${inr2(v.due)} · FY commission ${inr2(v.fy_credited)}</div>
    <label>TDS</label><select class="in" id="ot"><option value="auto">Suggested — ${inr2(v.tds)} (@${v.rate}%)</option><option value="own">Own amount</option><option value="none">No TDS</option></select>
    <input class="in" id="oa" inputmode="decimal" style="display:none;margin-top:6px" placeholder="TDS ₹">
    <label>UTR NO</label><input class="in" id="or" placeholder="12-digit UTR"><label>UTR DATE</label><input class="in" type="date" id="od" value="${today()}">
    <div class="sub" id="os" style="margin-top:10px"></div><div class="msg" id="om"></div><button class="btn pink full" id="osv" style="margin-top:12px">Record payout</button>`;
  const tds = () => $("#ot").value === "none" ? 0 : $("#ot").value === "own" ? Number($("#oa").value || 0) : Number(v.tds || 0);
  const sum = () => { $("#oa").style.display = $("#ot").value === "own" ? "block" : "none"; $("#os").innerHTML = `Transfer <b>${inr2(Number(v.due) - tds())}</b> · TDS ${inr2(tds())} goes to TDS payable`; };
  $("#ot").onchange = sum; $("#oa").oninput = sum; sum();
  $("#osv").onclick = async () => {
    if (!$("#or").value.trim()) return $("#om").textContent = "Enter the UTR / reference";
    try { await rpc("pay_commissions_tds", { p_sales: id, p_ref: $("#or").value.trim(), p_date: $("#od").value, p_tds: tds() }); closeForm(); accounts(); }
    catch (e) { $("#om").textContent = e.message; }
  };
}


// ================= Sales invoices: plan / featured invoices (made when a UTR is approved) + your own invoices =================
async function acInvoices() {
  const [own, claims, shops, st] = await Promise.all([
    q("admin_invoices", "*", x => x.gte("inv_date", AC.from).lte("inv_date", AC.to).order("inv_date", { ascending: false })).catch(() => null),
    q("pay_claims", "*", x => x.eq("status", "APPROVED").gte("paid_on", AC.from).lte("paid_on", AC.to).order("paid_on", { ascending: false })),
    q("shops", "id,name,addr,locality,city,state,pin,gstin"), q("settings", "*", x => x.eq("id", 1))]);
  AC.st = st[0] || {}; AC.shops = shops; AC.own = own || []; AC.claims = claims;
  const rows = [["Invoice no", "Date", "Billed to", "For", "Taxable", "CGST", "SGST", "IGST", "Total", "Status", "UTR", "UTR date"],
    ...claims.map(c => { const sh = shops.find(x => x.id === c.shop) || {}; return [c.inv_no || "", c.paid_on, sh.name || "", c.purpose === "FEATURED" ? `Featured ${c.days}d` : `Plan ${c.months}m`, n2(c.taxable ?? c.amount), n2(c.cgst), n2(c.sgst), n2(c.igst), n2(c.amount), "Paid", c.utr, c.paid_on]; }),
    ...AC.own.map(i => [i.inv_no, i.inv_date, i.bill_to, (i.lines || []).map(l => l.d).join("; "), n2(i.taxable), n2(i.cgst), n2(i.sgst), n2(i.igst), n2(i.total), i.paid ? "Paid" : "To collect", i.utr || "", i.utr_date || ""])]
    ;
  AC.dl = { inv: rows };
  $("#acBody").innerHTML = `${own === null ? `<div class="soon err">Run update-33 in Supabase to make your own sales invoices.</div>` : ""}
    <div class="box"><h3>Sales invoices <span>• plan &amp; featured invoices are made by themselves when you approve a UTR</span>
      <button class="edit" onclick="acInvForm()">＋ New sales invoice</button> <button class="edit" onclick="csvDl('sales-invoices-${AC.from}_to_${AC.to}.csv',AC.dl.inv)">⬇ Excel</button></h3>
    <table><thead><tr><th>INVOICE</th><th>DATE</th><th>BILLED TO</th><th>FOR</th><th style="text-align:right">TOTAL</th><th>STATUS</th><th></th></tr></thead><tbody>
    ${AC.own.map(i => `<tr><td><b>${esc(i.inv_no)}</b></td><td>${i.inv_date}</td><td>${esc(i.bill_to)}</td><td class="sub">${esc((i.lines || []).map(l => l.d).join("; "))}</td>
      <td style="text-align:right"><b>${inr2(i.total)}</b></td><td>${i.paid ? `<span class="pill ok">Paid</span><br><span class="sub">${esc(i.utr || "")} ${i.utr_date || ""}</span>` : `<span class="pill warn">To collect</span>`}</td>
      <td style="white-space:nowrap"><button class="edit" onclick="acInvPrint('own','${i.id}')">Print / PDF</button>${i.paid ? "" : ` <button class="edit" onclick="acInvPaid('${i.id}')">Mark paid</button>`}</td></tr>`).join("")}
    ${claims.map(c => { const sh = shops.find(x => x.id === c.shop) || {}; return `<tr><td><b>${esc(c.inv_no || "—")}</b></td><td>${c.paid_on}</td><td>${esc(sh.name || "")}</td>
      <td class="sub">${c.purpose === "FEATURED" ? `Featured ${c.days} days` : `Seller plan ${c.months} month${c.months > 1 ? "s" : ""}`}</td><td style="text-align:right"><b>${inr2(c.amount)}</b></td>
      <td><span class="pill ok">Paid</span><br><span class="sub">UTR ${esc(c.utr)}</span></td><td><button class="edit" onclick="acInvPrint('plan','${c.id}')">Print / PDF</button></td></tr>`; }).join("")}
    </tbody></table>${claims.length + AC.own.length ? "" : '<div class="sub">No invoices in this period.</div>'}</div>`;
}
function acInvForm() {
  const el = $("#panel"); el.classList.add("open"); document.body.classList.add("po");
  const inc = AC.acc.filter(a => a.type === "INCOME");
  el.innerHTML = `<h2><span>New sales invoice</span><button class="x" onclick="closeForm()">×</button></h2>
    <label>BILL TO (party)</label><select class="in" id="iv"><option value="">— type a name below —</option>${AC.parties.map(p => `<option value="${p.id}">${esc(p.name)}${p.kind === "SELLER" ? " · seller" : p.kind === "SALES" ? " · sales" : ""}</option>`).join("")}</select>
    <input class="in" id="ivn" placeholder="Or customer name" style="margin-top:6px"><input class="in" id="iva" placeholder="Address (optional)" style="margin-top:6px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>CUSTOMER GSTIN</label><input class="in" id="ivg" maxlength="15"></div><div><label>STATE (place of supply)</label><input class="in" id="ivs" placeholder="${esc(AC.st.biz_state || "")}"></div></div>
    <label>INVOICE DATE</label><input class="in" type="date" id="ivd" value="${today()}">
    <label>ITEMS / SERVICES</label><div id="ivl"></div><button class="edit" onclick="acInvLine()">＋ Add line</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>GST %</label><select class="in" id="ivr">${[0, 5, 12, 18, 28, 40].map(r => `<option value="${r}" ${r === 18 && AC.st.gst_enabled ? "selected" : ""}>${r ? r + "%" : "Nil / 0%"}</option>`).join("")}</select></div>
      <div><label>INCOME HEAD</label><select class="in" id="ivi">${inc.map(a => `<option value="${a.code}" ${a.code === "4300" ? "selected" : ""}>${a.code} · ${esc(a.name)}</option>`).join("")}</select></div></div>
    <label>PAID?</label><select class="in" id="ivp"><option value="">Not yet — to collect</option><option value="1000">Received in Bank (UPI / transfer)</option><option value="1010">Received in Cash</option></select>
    <div id="ivpw" style="display:none;grid-template-columns:1fr 1fr;gap:8px"><div><label>UTR NO</label><input class="in" id="ivu"></div><div><label>UTR DATE</label><input class="in" type="date" id="ivud" value="${today()}"></div></div>
    <div class="sub" id="ivsum" style="margin-top:10px"></div><div class="msg" id="ivm"></div><button class="btn pink full" id="ivsv" style="margin-top:12px">Make invoice</button>`;
  acInvLine();
  $("#iv").onchange = () => { const p = AC.parties.find(x => x.id === $("#iv").value); if (p) { $("#ivn").value = p.name; $("#iva").value = p.addr || ""; $("#ivg").value = p.gstin || ""; $("#ivs").value = p.state || ""; } };
  $("#ivp").onchange = () => $("#ivpw").style.display = $("#ivp").value ? "grid" : "none";
  $("#ivr").onchange = acInvSum;
  $("#ivsv").onclick = async () => {
    const lines = [...document.querySelectorAll("#ivl .ivrow")].map(r => ({ d: r.querySelector(".d").value.trim(), sac: r.querySelector(".s").value.trim(), q: +r.querySelector(".q").value || 1, r: +r.querySelector(".r").value || 0 })).filter(l => l.d && l.r > 0);
    if (!lines.length) return $("#ivm").textContent = "Add at least one line with a rate";
    if (!$("#iv").value && !$("#ivn").value.trim()) return $("#ivm").textContent = "Choose a party or type the customer's name";
    $("#ivsv").disabled = true;
    try {
      const r = await rpc("admin_sales_invoice", { p_party: $("#iv").value || null, p_date: $("#ivd").value, p_lines: lines, p_gst_rate: +$("#ivr").value, p_income: $("#ivi").value,
        p_paid_from: $("#ivp").value || null, p_utr: $("#ivp").value ? ($("#ivu").value.trim() || null) : null, p_utr_date: $("#ivp").value ? $("#ivud").value : null,
        p_bill_to: $("#ivn").value.trim() || null, p_bill_addr: $("#iva").value.trim() || null, p_bill_gstin: $("#ivg").value.trim().toUpperCase() || null, p_state: $("#ivs").value.trim() || null });
      closeForm(); AC.tab = "inv"; await accounts(); acInvPrint("own", r.id);
    } catch (e) { $("#ivm").textContent = e.message; $("#ivsv").disabled = false; }
  };
}
function acInvLine() {
  const d = document.createElement("div"); d.className = "ivrow"; d.style.cssText = "display:grid;grid-template-columns:2fr 1fr .6fr 1fr;gap:6px;margin-bottom:6px";
  d.innerHTML = `<input class="in d" placeholder="Description e.g. Banner ad 1 month"><input class="in s" placeholder="SAC" value="998365"><input class="in q" value="1" inputmode="decimal"><input class="in r" placeholder="Rate ₹" inputmode="decimal">`;
  $("#ivl").appendChild(d); d.querySelectorAll("input").forEach(i => i.oninput = acInvSum);
}
function acInvSum() {
  const t = [...document.querySelectorAll("#ivl .ivrow")].reduce((a, r) => a + (+r.querySelector(".q").value || 1) * (+r.querySelector(".r").value || 0), 0), g = Math.round(t * +$("#ivr").value) / 100;
  $("#ivsum").innerHTML = `Taxable ${inr2(t)} + GST ${inr2(g)} = <b>${inr2(t + g)}</b>`;
}
function acInvPaid(id) {
  const el = $("#panel"); el.classList.add("open"); document.body.classList.add("po");
  const i = AC.own.find(x => x.id === id) || {};
  el.innerHTML = `<h2><span>Payment for ${esc(i.inv_no)}</span><button class="x" onclick="closeForm()">×</button></h2><div class="sub">${esc(i.bill_to)} · ${inr2(i.total)}</div>
    <label>RECEIVED IN</label><select class="in" id="pf"><option value="1000">Bank (UPI / transfer)</option><option value="1010">Cash</option></select>
    <label>UTR NO</label><input class="in" id="pu"><label>UTR DATE</label><input class="in" type="date" id="pd" value="${today()}">
    <label>TDS DEDUCTED BY CUSTOMER ₹ (if any)</label><input class="in" id="ptd" inputmode="decimal" placeholder="0"><div class="msg" id="pmm"></div>
    <button class="btn pink full" id="psv" style="margin-top:12px">Mark paid</button>`;
  $("#psv").onclick = async () => { try { await rpc("admin_invoice_paid", { p_id: id, p_from: $("#pf").value, p_utr: $("#pu").value.trim() || null, p_date: $("#pd").value, p_tds: +$("#ptd").value || 0 }); closeForm(); accounts(); } catch (e) { $("#pmm").textContent = e.message; } };
}
// printable invoice (Print → Save as PDF)
async function acInvPrint(kind, id) {
  const st = AC.st || {}; let inv;
  if (kind === "own") {
    const i = AC.own.find(x => x.id === id) || (await q("admin_invoices", "*", x => x.eq("id", id)))[0];
    inv = { no: i.inv_no, date: i.inv_date, to: i.bill_to, addr: i.bill_addr || "", gstin: i.bill_gstin || "", pos: i.place_of_supply || "", lines: (i.lines || []).map(l => ({ d: l.d, sac: l.sac, q: l.q, r: l.r, amt: l.q * l.r })),
      taxable: i.taxable, cgst: i.cgst, sgst: i.sgst, igst: i.igst, total: i.total, rate: i.gst_rate, paid: i.paid ? `Paid${i.utr ? " · UTR " + i.utr : ""}${i.utr_date ? " · " + i.utr_date : ""}` : "Payment due" };
  } else {
    const c = AC.claims.find(x => x.id === id), sh = AC.shops.find(x => x.id === c.shop) || {};
    const tx = Number(c.taxable ?? c.amount), d = c.purpose === "FEATURED" ? `Featured listing (sponsored placement) — ${c.days} days` : `Seller plan — ${c.months} month${c.months > 1 ? "s" : ""} listing & order tools`;
    inv = { no: c.inv_no, date: c.paid_on, to: sh.name, addr: [sh.addr, sh.locality, sh.city, sh.state, sh.pin].filter(Boolean).join(", "), gstin: sh.gstin || "", pos: c.place_of_supply || sh.state || "",
      lines: [{ d, sac: c.purpose === "FEATURED" ? "998365" : "998439", q: 1, r: tx, amt: tx }], taxable: tx, cgst: c.cgst, sgst: c.sgst, igst: c.igst, total: c.amount, rate: null, paid: `Paid · UTR ${c.utr} · ${c.paid_on}` };
  }
  const gst = Number(inv.cgst) + Number(inv.sgst) + Number(inv.igst) > 0;
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(inv.no)}</title><style>
    body{font-family:Arial,sans-serif;color:#1D0F30;max-width:760px;margin:24px auto;padding:0 16px}.top{display:flex;justify-content:space-between;align-items:flex-start;border-top:6px solid #6A1BB0;padding-top:16px}
    h1{margin:0;font-size:22px}.tag{background:#6A1BB0;color:#fff;padding:8px 16px;border-radius:8px;font-weight:700}.muted{color:#6B6380;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}th{background:#F4EDFC;text-align:left;padding:8px}td{padding:8px;border-bottom:1px solid #eee}.r{text-align:right}
    .box{display:flex;gap:16px;margin-top:16px}.box div{flex:1;background:#FAF8FC;border-radius:10px;padding:10px;font-size:13px}.tot{margin-left:auto;width:300px;font-size:14px}.tot div{display:flex;justify-content:space-between;padding:4px 0}
    .grand{font-weight:800;font-size:17px;border-top:2px solid #1D0F30;margin-top:6px;padding-top:8px}@media print{button{display:none}}</style></head><body>
    <div class="top"><div><h1>${esc(st.biz_name || "Gali Bazaar")}</h1><div class="muted">${esc(st.biz_addr || "")}<br>${esc(st.biz_email || "")}${st.biz_gstin ? `<br><b>GSTIN: ${esc(st.biz_gstin)}</b>` : ""}</div></div><div class="tag">${gst ? "TAX INVOICE" : "INVOICE"}</div></div>
    <div class="box"><div><b>Invoice no</b><br>${esc(inv.no || "")}<br><b>Date</b><br>${esc(inv.date)}${gst ? `<br><b>Place of supply</b><br>${esc(inv.pos)}` : ""}</div>
      <div><b>Billed to</b><br>${esc(inv.to)}<br><span class="muted">${esc(inv.addr)}</span>${inv.gstin ? `<br>GSTIN: ${esc(inv.gstin)}` : ""}</div></div>
    <table><thead><tr><th>#</th><th>Description</th><th>SAC</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>
      ${inv.lines.map((l, k) => `<tr><td>${k + 1}</td><td>${esc(l.d)}</td><td>${esc(l.sac || "")}</td><td class="r">${l.q}</td><td class="r">${n2(l.r)}</td><td class="r">${n2(l.amt)}</td></tr>`).join("")}</tbody></table>
    <div class="tot"><div><span>Taxable value</span><span>₹${n2(inv.taxable)}</span></div>
      ${Number(inv.cgst) > 0 ? `<div><span>CGST</span><span>₹${n2(inv.cgst)}</span></div><div><span>SGST</span><span>₹${n2(inv.sgst)}</span></div>` : ""}${Number(inv.igst) > 0 ? `<div><span>IGST</span><span>₹${n2(inv.igst)}</span></div>` : ""}
      <div class="grand"><span>Total</span><span>₹${n2(inv.total)}</span></div><div class="muted">${esc(inv.paid)}</div></div>
    ${gst ? "" : `<p class="muted">Supplier not registered under GST; no GST charged.</p>`}<p class="muted">Computer-generated invoice — no signature needed.</p>
    <button onclick="print()" style="padding:10px 18px;border:0;border-radius:10px;background:#6A1BB0;color:#fff;font-weight:700">Print / Save as PDF</button></body></html>`);
  w.document.close();
}
