/* Admin console · Accounts & books — trial balance, P&L, balance sheet, day book, ledgers, parties (vendors),
   vendor bills with GST + TDS, vendor payments, sales-team payouts with a TDS choice, CA downloads.
   Uses the accounting RPCs (accounting.sql + update-31-admin-books.sql). */
let AC = { tab: "reports", from: null, to: null, acc: [], parties: [] };
const fy0 = (d = new Date()) => { const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01`; };
const n2 = v => Number(v || 0).toFixed(2);
const inr2 = v => "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const drcr = v => v >= 0 ? `${inr2(v)} Dr` : `${inr2(-v)} Cr`;
function csvDl(name, rows) {
  const s = rows.map(r => r.map(v => { v = String(v ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + s], { type: "text/csv" })); a.download = name; a.click();
}
async function rpc(fn, args) { const { data, error } = await db.rpc(fn, args || {}); if (error) throw error; return data; }

async function accounts() {
  AC.from = AC.from || fy0(); AC.to = AC.to || today();
  AC.acc = await q("accounts", "*", x => x.eq("active", true).order("code"));
  AC.parties = await q("parties", "*", x => x.eq("active", true).order("name")).catch(() => []);
  const tabs = [["reports", "TB · P&L · Balance sheet"], ["day", "Day book"], ["ledger", "Ledger"], ["parties", "Vendors & parties"], ["bill", "＋ Vendor bill"], ["pay", "＋ Payment"], ["payout", "Sales payouts (TDS)"]];
  $("#main").innerHTML = head("Accounts & books", "Double-entry books — plan payments, commission and payouts post by themselves",
    `<input type="date" class="in" id="acF" value="${AC.from}" style="width:auto"> <input type="date" class="in" id="acT" value="${AC.to}" style="width:auto">`) +
    `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${tabs.map(([k, l]) => `<button class="btn ${AC.tab === k ? "pink" : "ghost"}" onclick="AC.tab='${k}';accounts()">${l}</button>`).join("")}</div><div id="acBody"><div class="sub">Loading…</div></div>`;
  $("#acF").onchange = e => { AC.from = e.target.value; accounts(); };
  $("#acT").onchange = e => { AC.to = e.target.value; accounts(); };
  try { await ({ reports: acReports, day: acDay, ledger: acLedger, parties: acParties, bill: acBill, pay: acPay, payout: acPayout })[AC.tab](); }
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
  const rows = [["Party", "Type", "GSTIN", "PAN", "We owe them", "TDS deducted this FY"], ...bal.map(p => [p.name, kinds[p.kind] || p.kind, p.gstin || "", p.pan || "", n2(-Number(p.balance)), n2(p.tds_fy)])];
  AC.dl = { parties: rows };
  $("#acBody").innerHTML = `<div class="box"><h3>Vendors &amp; parties <span>• sellers and sales people are added by themselves</span>
      <button class="edit" onclick="acPartyForm()">＋ New vendor</button> <button class="edit" onclick="csvDl('parties-${today()}.csv',AC.dl.parties)">⬇ Excel</button></h3>
    <table><thead><tr><th>PARTY</th><th>TYPE</th><th>GSTIN / PAN</th><th style="text-align:right">WE OWE</th><th style="text-align:right">TDS THIS FY</th><th></th></tr></thead><tbody>${bal.map(p => `<tr>
      <td><b>${esc(p.name)}</b></td><td><span class="pill ${p.kind === "VENDOR" ? "warn" : p.kind === "SALES" ? "ok" : "grey"}">${kinds[p.kind] || p.kind}</span></td>
      <td class="sub">${esc(p.gstin || "—")} / ${esc(p.pan || "—")}</td><td style="text-align:right"><b>${inr2(-Number(p.balance))}</b></td><td style="text-align:right">${inr2(p.tds_fy)}</td>
      <td><button class="edit" onclick="acPartyLedger('${p.id}')">Ledger</button> <button class="edit" onclick="acPartyForm('${p.id}')">Edit</button></td></tr>`).join("")}</tbody></table></div>`;
}
function acPartyForm(id) {
  const p = AC.parties.find(x => x.id === id) || { kind: "VENDOR" };
  const el = $("#panel"); el.classList.add("open"); document.body.classList.add("po");
  el.innerHTML = `<h2><span>${id ? "Edit party" : "New vendor"}</span><button class="x" onclick="closeForm()">×</button></h2>
    <label>NAME</label><input class="in" id="pn" value="${esc(p.name || "")}" placeholder="e.g. GoDaddy India, Supabase, CA Sharma & Co">
    <label>GSTIN</label><input class="in" id="pg" value="${esc(p.gstin || "")}" maxlength="15">
    <label>PAN</label><input class="in" id="pp" value="${esc(p.pan || "")}" maxlength="10">
    <label>STATE</label><input class="in" id="ps" value="${esc(p.state || "")}">
    <label>EMAIL / PHONE</label><input class="in" id="pe" value="${esc(p.email || "")}"><input class="in" id="ph" value="${esc(p.phone || "")}" style="margin-top:6px">
    <label>TDS SECTION / RATE % (if you deduct TDS for this vendor)</label><div style="display:flex;gap:6px"><input class="in" id="pts" value="${esc(p.tds_section || "")}" placeholder="194J / 194C / 194H"><input class="in" id="ptr" value="${p.tds_rate ?? ""}" inputmode="decimal" placeholder="10"></div>
    <div class="msg" id="pm"></div><button class="btn pink full" style="margin-top:14px" id="psv">Save</button>`;
  $("#psv").onclick = async () => {
    const row = { name: $("#pn").value.trim(), gstin: $("#pg").value.trim().toUpperCase() || null, pan: $("#pp").value.trim().toUpperCase() || null, state: $("#ps").value.trim() || null,
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
    <label><input type="checkbox" id="btd"> Deduct TDS</label><div id="btw" style="display:none;grid-template-columns:1fr 1fr;gap:8px"><div><label>TDS %</label><input class="in" id="btr" inputmode="decimal" value="10"></div><div><label>TDS ₹</label><input class="in" id="bta" inputmode="decimal"></div></div>
    <label>PAID?</label><select class="in" id="bp"><option value="">Not yet — pay later</option>${AC.acc.filter(a => ["1000", "1010"].includes(a.code)).map(a => `<option value="${a.code}">Paid now from ${esc(a.name)}</option>`).join("")}</select>
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
  const pick = () => { const p = AC.parties.find(x => x.id === $("#bv").value) || {}; if (p.tds_rate) { $("#btd").checked = true; $("#btr").value = p.tds_rate; } $("#btw").style.display = $("#btd").checked ? "grid" : "none"; calc(); };
  ["#bt", "#bg", "#btr"].forEach(s => $(s).oninput = calc); $("#bg").onchange = calc; $("#bv").onchange = pick;
  $("#bta").oninput = () => { $("#bta").dataset.own = "1"; calc(); };
  $("#btd").onchange = () => { $("#btw").style.display = $("#btd").checked ? "grid" : "none"; calc(); };
  pick();
  $("#bsv").onclick = async () => {
    const { t, g, tds } = calc(); if (!t) return $("#bm").textContent = "Enter the taxable value";
    $("#bsv").disabled = true;
    try {
      await rpc("admin_vendor_bill", { p_party: $("#bv").value, p_date: $("#bd").value, p_bill_no: $("#bn").value.trim() || null, p_head: $("#bh").value,
        p_taxable: t, p_gst: g, p_tds: tds, p_paid_from: $("#bp").value || null, p_pay_date: null, p_narr: $("#bx").value.trim() || null, p_attachment: null });
      AC.tab = "parties"; accounts();
    } catch (e) { $("#bm").textContent = e.message; $("#bsv").disabled = false; }
  };
}

function acPay() {
  const vend = AC.parties.filter(p => p.kind !== "SELLER");
  $("#acBody").innerHTML = `<div class="box" style="max-width:560px"><h3>Pay a vendor <span>• against their bills (part or full)</span></h3>
    <label>VENDOR</label><select class="in" id="yv">${vend.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>AMOUNT ₹</label><input class="in" id="ya" inputmode="decimal"></div><div><label>DATE</label><input class="in" type="date" id="yd" value="${today()}"></div></div>
    <label>PAID FROM</label><select class="in" id="yf">${AC.acc.filter(a => ["1000", "1010"].includes(a.code)).map(a => `<option value="${a.code}">${esc(a.name)}</option>`).join("")}</select>
    <label>UTR / CHEQUE / REF</label><input class="in" id="yr"><div class="msg" id="ym"></div><button class="btn pink full" id="ysv" style="margin-top:12px">Save payment</button></div>`;
  $("#ysv").onclick = async () => {
    const a = Number($("#ya").value || 0); if (!a) return $("#ym").textContent = "Enter the amount";
    try { await rpc("admin_vendor_payment", { p_party: $("#yv").value, p_date: $("#yd").value, p_amount: a, p_from: $("#yf").value, p_ref: $("#yr").value.trim() || null }); AC.tab = "parties"; accounts(); }
    catch (e) { $("#ym").textContent = e.message; }
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
    <label>UTR / REF</label><input class="in" id="or"><label>DATE</label><input class="in" type="date" id="od" value="${today()}">
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
