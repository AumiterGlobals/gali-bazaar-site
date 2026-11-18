/* Seller panel · Books & expenses — same books as the app (Accounts → Books):
   P&L, trial balance, balance sheet, cash & bank book, udhaar, vendor bills (GST input, pay later), day book, CA downloads. */
const BK = { CASH: "Cash in hand", BANK: "UPI / Bank", DEBT: "Customers (udhaar)", INGST: "GST input credit", CGST: "Output CGST", SGST: "Output SGST",
  VEND: "Vendors (bills to pay)", CAP: "Owner's capital", DRAW: "Owner's drawings", SALES: "Sales", DEL: "Delivery charges", RET: "Sales returns (credit notes)", PLAN: "Gali Bazaar subscription", EARLIER: "Profit of earlier years" };
const bkType = a => [BK.CASH, BK.BANK, BK.DEBT, BK.INGST].includes(a) ? "ASSET" : [BK.CGST, BK.SGST, BK.VEND].includes(a) ? "LIABILITY" : [BK.CAP, BK.DRAW, BK.EARLIER].includes(a) ? "EQUITY" : [BK.SALES, BK.DEL, BK.RET].includes(a) ? "INCOME" : "EXPENSE";
const bkNom = a => ["INCOME", "EXPENSE"].includes(bkType(a));
const dupMsg = e => { const m = niceErr(e); return /no_dup_bill/.test(m) ? "This vendor invoice is already entered" : /no_dup_utr/.test(m) ? "This UTR is already entered" : m; };
const r2 = v => Math.round(v * 100) / 100, f2 = v => Number(v || 0).toFixed(2);
const bkDay = ts => { if (!ts) return ""; const d = new Date(ts); return isNaN(d) ? String(ts).slice(0, 10) : istIso(d); };
const bkMoney = m => /^cash/i.test(m || "CASH") ? BK.CASH : BK.BANK;
let BKD = { from: null, to: null, tab: "pl" };

function bkSale(items, fee, gstOn) {
  const goods = items.reduce((a, l) => a + l.p * l.q, 0);
  const gTax = gstOn ? items.reduce((a, l) => a + (l.g > 0 ? l.p * l.q * l.g / (100 + l.g) : 0), 0) : 0;
  const main = [...items].sort((a, b) => b.p * b.q - a.p * a.q)[0], fr = gstOn && fee > 0 ? (main?.g || 0) : 0, fTax = fr > 0 ? fee * fr / (100 + fr) : 0;
  const tax = r2(gTax + fTax), c = r2(tax / 2), sg = r2(tax - c), gross = r2(goods + fee), del = r2(fee - fTax), sal = r2(gross - del - tax);
  return [{ a: BK.DEBT, dr: gross }, { a: BK.SALES, cr: sal }, del > 0 && { a: BK.DEL, cr: del }, c > 0 && { a: BK.CGST, cr: c }, sg > 0 && { a: BK.SGST, cr: sg }].filter(Boolean);
}
function bkBuild(x) {
  const gstOn = !!(S.gst_billing && S.gstin), out = [], E = (date, type, ref, text, lines) => out.push({ date, type, ref: ref || "", text, lines });
  x.orders.filter(o => o.status === "DELIVERED" && o.bill_no).forEach(o => {
    const d = bkDay(o.delivered_at || o.created_at), items = o.items || [];
    E(d, "Sale", o.bill_no, `Bill to ${o.cust_name} (app order)`, bkSale(items, Number(o.fee || 0), gstOn));
    const paid = r2(items.filter(l => !(o.returned || []).includes(l.n)).reduce((a, l) => a + l.p * l.q, 0) + Number(o.fee || 0));
    if (paid > 0) E(d, "Receipt", o.bill_no, `${o.pay_mode === "UPI" ? "UPI" : "Cash"} received · bill ${o.bill_no}`, [{ a: bkMoney(o.pay_mode), dr: paid }, { a: BK.DEBT, cr: paid }]);
  });
  x.counter.filter(c => c.bill_no).forEach(c => {
    const d = bkDay(c.created_at);
    E(d, "Sale", c.bill_no, `Counter bill to ${c.cust_name}`, bkSale(c.items || [], Number(c.fee || 0), gstOn));
    if (c.pay_mode !== "CREDIT") E(d, "Receipt", c.bill_no, `${c.pay_mode === "UPI" ? "UPI" : "Cash"} received · bill ${c.bill_no}`, [{ a: bkMoney(c.pay_mode), dr: r2(c.total) }, { a: BK.DEBT, cr: r2(c.total) }]);
  });
  x.cns.filter(n => n.kind !== "REPLACEMENT" && n.amount > 0).forEach(n => {
    const d = n.cn_date || bkDay(n.created_at), gross = (n.items || []).reduce((a, l) => a + l.p * l.q, 0);
    const itTax = gstOn ? (n.items || []).reduce((a, l) => a + (l.g > 0 ? l.p * l.q * l.g / (100 + l.g) : 0), 0) : 0;
    const tax = gross > 0 ? r2(n.amount * itTax / gross) : 0, c = r2(tax / 2), sg = r2(tax - c);
    E(d, "Credit note", n.cn_no, `Return · ${n.reason || n.kind}`, [{ a: BK.RET, dr: r2(n.amount - tax) }, c > 0 && { a: BK.CGST, dr: c }, sg > 0 && { a: BK.SGST, dr: sg }, { a: BK.DEBT, cr: r2(n.amount) }].filter(Boolean));
    const auto = n.auto || n.refund_mode === "NOT_CHARGED";
    if (!auto && ["CASH", "UPI"].includes(String(n.refund_mode).toUpperCase())) E(d, "Refund", n.cn_no, `Refund paid · ${n.cn_no || ""}`, [{ a: BK.DEBT, dr: r2(n.amount) }, { a: bkMoney(n.refund_mode), cr: r2(n.amount) }]);
  });
  const adj = id => r2((x.rets || []).filter(r => r.expense_id === id && r.mode === "ADJUST").reduce((a, r) => a + Number(r.amount), 0));
  x.exps.forEach(e => {
    const gst = gstOn ? r2(e.gst || 0) : 0, later = e.paid === false || (e.paid_on && e.paid_on !== e.on_date), toPay = r2(e.amount - adj(e.id));
    const who = [e.vendor, e.bill_no && "bill " + e.bill_no].filter(Boolean).join(" · ");
    E(e.on_date, later ? "Purchase (credit)" : "Expense", e.bill_no, e.head + (who ? " — " + who : ""), [{ a: e.head, dr: r2(e.amount - gst) }, gst > 0 && { a: BK.INGST, dr: gst }, { a: later ? BK.VEND : bkMoney(e.mode), cr: r2(e.amount) }].filter(Boolean));
    if (e.paid !== false && later && toPay > 0) E(e.paid_on || e.on_date, "Payment", e.bill_no, `Paid ${e.vendor || e.head}`, [{ a: BK.VEND, dr: toPay }, { a: bkMoney(e.paid_mode || e.mode), cr: toPay }]);
  });
  // purchase return (debit note): set off against the bill, or the vendor paid back; input GST on it is reversed
  (x.rets || []).forEach(r => {
    const e = x.exps.find(z => z.id === r.expense_id); if (!e) return;
    const amt = r2(r.amount), gst = gstOn ? r2(r.gst || 0) : 0;
    E(r.on_date, "Purchase return", r.ref || e.bill_no, `Return to ${e.vendor || "vendor"}${e.bill_no ? " · bill " + e.bill_no : ""}${r.mode === "ADJUST" ? " (taken off the bill)" : ` (${r.mode} received)`}`,
      [{ a: r.mode === "ADJUST" ? BK.VEND : bkMoney(r.mode), dr: amt }, { a: e.head, cr: r2(amt - gst) }, gst > 0 && { a: BK.INGST, cr: gst }].filter(Boolean));
  });
  x.claims.filter(c => c.status === "APPROVED").forEach(c => {
    const gst = gstOn ? r2(Number(c.cgst || 0) + Number(c.sgst || 0) + Number(c.igst || 0)) : 0;
    E(c.paid_on, "Expense", c.inv_no || c.utr, `Gali Bazaar plan ${c.months || ""}m · UTR ${c.utr}`, [{ a: BK.PLAN, dr: r2(c.amount - gst) }, gst > 0 && { a: BK.INGST, dr: gst }, { a: BK.BANK, cr: Number(c.amount) }].filter(Boolean));
  });
  x.recs.forEach(r => {
    const a = Number(r.amount);
    if (r.kind === "CAPITAL") E(r.on_date, "Owner money in", "", r.note || "Owner put money in", [{ a: bkMoney(r.mode), dr: a }, { a: BK.CAP, cr: a }]);
    else if (r.kind === "DRAWINGS") E(r.on_date, "Owner money out", "", r.note || "Owner took money out", [{ a: BK.DRAW, dr: a }, { a: bkMoney(r.mode), cr: a }]);
    else { const c = x.counter.find(s => s.id === r.sale_id); E(r.on_date, "Receipt", c?.bill_no, "Udhaar collected" + (c ? " · " + c.cust_name : ""), [{ a: bkMoney(r.mode), dr: a }, { a: BK.DEBT, cr: a }]); }
  });
  return out.sort((a, b) => (a.date + a.type).localeCompare(b.date + b.type));
}
function bkNet(es, from, to) { const m = {}; es.filter(e => e.date >= from && e.date <= to).forEach(e => e.lines.forEach(l => m[l.a] = r2((m[l.a] || 0) + (l.dr || 0) - (l.cr || 0)))); return m; }
function bkTrial(es, to) {
  const fy = (() => { const d = new Date(to); const y = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear(); return `${y}-04-01`; })();
  const real = bkNet(es, "0000", to), nom = bkNet(es, fy, to), before = bkNet(es, "0000", new Date(new Date(fy).getTime() - 864e5).toISOString().slice(0, 10));
  const all = {}; Object.entries(real).forEach(([a, v]) => !bkNom(a) && (all[a] = v)); Object.entries(nom).forEach(([a, v]) => bkNom(a) && (all[a] = v));
  const earlier = Object.entries(before).filter(([a]) => bkNom(a)).reduce((s, [, v]) => s + v, 0); if (Math.abs(earlier) > .004) all[BK.EARLIER] = r2(earlier);
  const ord = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
  return Object.entries(all).filter(([, v]) => Math.abs(v) > .004).sort((a, b) => ord.indexOf(bkType(a[0])) - ord.indexOf(bkType(b[0])) || a[0].localeCompare(b[0]));
}

function bkFy(a, b) { BKD.from = a; BKD.to = b > todayStr() ? todayStr() : b; books(); }
async function books() {
  BKD.from = BKD.from || `${fyStart().getFullYear()}-04-01`; BKD.to = BKD.to || todayStr();
  await fyLoad(S.id);
  $("#main").innerHTML = head("Books & expenses", "Made automatically from your bills, counter sales, credit notes, payments and expenses",
    `<button class="btn pink" onclick="bkExpense()">＋ Expense / vendor bill</button><button class="btn ghost" onclick="bkVendor()">＋ New vendor</button><button class="btn ghost" onclick="bkOwner()">Owner money</button><button class="btn ghost" onclick="fyManage(S.id, books)">Financial years</button>`) +
    `<div class="bar2">${fySelect(BKD.from, BKD.to, "bkFy")}<label style="margin:0">FROM</label><input class="in" type="date" id="kf" value="${BKD.from}" style="width:auto"><label style="margin:0">TO</label><input class="in" type="date" id="kt" value="${BKD.to}" style="width:auto"></div><div id="kb"><div class="sub">Loading…</div></div>`;
  $("#kf").onchange = e => { BKD.from = e.target.value; books(); }; $("#kt").onchange = e => { BKD.to = e.target.value; books(); };
  const t = BKD.to + "T23:59:59";
  const [o, cs, cn, ex, rc, cl] = await Promise.all([
    db.from("orders").select("id,short_id,bill_no,cust_name,items,fee,total,returned,status,created_at,delivered_at,pay_mode").eq("shop", S.id).eq("status", "DELIVERED").lte("created_at", t).limit(5000),
    db.from("counter_sales").select("*").eq("shop", S.id).lte("created_at", t).limit(5000),
    db.from("credit_notes").select("*").eq("shop", S.id).lte("created_at", t).limit(3000),
    db.from("shop_expenses").select("*").eq("shop", S.id).lte("on_date", BKD.to).order("on_date").limit(5000),
    db.from("shop_receipts").select("*").eq("shop", S.id).lte("on_date", BKD.to).limit(5000),
    db.from("pay_claims").select("*").eq("shop", S.id).eq("status", "APPROVED")]);
  const [vq, plq, icq, prq, prlq] = await Promise.all([db.from("shop_vendors").select("*").eq("shop", S.id).order("name"),
    db.from("purchase_lines").select("*").eq("shop", S.id).order("created_at").limit(20000),
    db.from("item_costs").select("item_id,cost_price").eq("shop", S.id),
    db.from("purchase_returns").select("*").eq("shop", S.id).order("on_date").limit(5000),
    db.from("purchase_return_lines").select("*").eq("shop", S.id).limit(20000)]);
  BKD.retAll = prq.error ? [] : prq.data || []; BKD.retLines = prlq.error ? [] : prlq.data || []; BKD.retOk = !prq.error;
  BKD.plOk = !plq.error; BKD.pl = plq.error ? [] : plq.data || [];
  BKD.cost = new Map((icq.error ? [] : icq.data || []).map(r => [r.item_id, Number(r.cost_price)]));
  BKD.vendors = vq.error ? null : vq.data || [];
  const x = { orders: o.data || [], counter: cs.data || [], cns: cn.data || [], exps: (ex.data || []).filter(e => !e.cancelled_at), recs: rc.error ? [] : (rc.data || []).filter(r => !r.cancelled_at), claims: cl.data || [] };
  x.rets = (BKD.retAll || []).filter(r => !r.cancelled_at && r.on_date <= BKD.to);
  BKD.x = x; const es = BKD.es = bkBuild(x), f = BKD.from, to = BKD.to;
  const pl = bkNet(es, f, to), profit = -Object.entries(pl).filter(([a]) => bkNom(a)).reduce((s, [, v]) => s + v, 0);
  const ud = x.counter.filter(c => c.pay_mode === "CREDIT").map(c => ({ c, due: r2(c.total - x.recs.filter(r => r.sale_id === c.id).reduce((a, r) => a + Number(r.amount), 0) - x.cns.filter(n => n.sale_id === c.id && n.kind !== "REPLACEMENT").reduce((a, n) => a + Number(n.amount), 0)) }));
  BKD.ud = ud;
  const unpaid = x.exps.filter(e => e.paid === false);
  const owed = e => r2(Number(e.amount) - x.rets.filter(r => r.expense_id === e.id && r.mode === "ADJUST").reduce((a, r) => a + Number(r.amount), 0));
  const tabs = [["pl", "Profit & loss"], ["tb", "Trial balance"], ["bs", "Balance sheet"], ["cash", "Cash & bank book"], ["udhaar", "Udhaar"], ["vend", "Expenses & vendor bills"], ["pret", "Purchase returns"], ["profit", "Item profit"], ["vendors", "Vendors"], ["day", "Day book"]];
  $("#kb").innerHTML = `<div class="sub" style="font-size:12.5px;background:#F6F2FB;border-radius:12px;padding:10px 12px;margin-bottom:12px">🔒 Entries can't be deleted — a wrong expense is cancelled instead. If you delete your shop, all your records are first saved to your phone as Excel, then deleted from Gali Bazaar. Keeping them for GST / income tax is then your responsibility. Download your books any time. <a href="/help/seller-guide/#records-en" style="color:#7C3AED">Your records &amp; deleting your shop →</a></div>${rc.error ? `<div class="soon err">Run update-30 (books) in Supabase to save udhaar collections and owner money.</div>` : ""}
    <div class="kpis k4" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><span>Net profit</span><b style="color:${profit >= 0 ? "#15803D" : "#BE185D"}">${inr2(profit)}</b></div>
      <div class="kpi"><span>Udhaar to collect</span><b>${inr2(ud.reduce((a, u) => a + Math.max(u.due, 0), 0))}</b></div><div class="kpi"><span>Bills to pay</span><b class="pk">${inr2(unpaid.reduce((a, e) => a + owed(e), 0))}</b></div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0">${tabs.map(([k, l]) => `<button class="btn ${BKD.tab === k ? "pink" : "ghost"}" style="padding:9px 14px" onclick="BKD.tab='${k}';bkShow()">${l}</button>`).join("")}</div><div class="box" id="kbody"></div>`;
  bkShow();
}
function bkRows() {
  const es = BKD.es, f = BKD.from, t = BKD.to, x = BKD.x;
  switch (BKD.tab) {
    case "pl": { const n = bkNet(es, f, t), inc = Object.entries(n).filter(([a]) => bkType(a) === "INCOME"), exp = Object.entries(n).filter(([a]) => bkType(a) === "EXPENSE").sort((a, b) => b[1] - a[1]);
      const ti = -inc.reduce((s, [, v]) => s + v, 0), te = exp.reduce((s, [, v]) => s + v, 0);
      return [`Profit & loss · ${f} to ${t}`, [["Particulars", "Amount"], ["INCOME", ""], ...inc.map(([a, v]) => [a, f2(-v)]), ["Total income", f2(ti)], ["EXPENSES", ""], ...exp.map(([a, v]) => [a, f2(v)]), ["Total expenses", f2(te)], [ti - te >= 0 ? "NET PROFIT" : "NET LOSS", f2(ti - te)]]]; }
    case "tb": { const tb = bkTrial(es, t); return [`Trial balance · as on ${t}`, [["Account", "Group", "Debit", "Credit"], ...tb.map(([a, v]) => [a, bkType(a), v > 0 ? f2(v) : "", v < 0 ? f2(-v) : ""]),
      ["TOTAL", "", f2(tb.filter(r => r[1] > 0).reduce((s, r) => s + r[1], 0)), f2(-tb.filter(r => r[1] < 0).reduce((s, r) => s + r[1], 0))]]]; }
    case "bs": { const tb = bkTrial(es, t), profit = -tb.filter(([a]) => bkNom(a)).reduce((s, [, v]) => s + v, 0), g = k => tb.filter(([a]) => bkType(a) === k);
      const tl = -g("LIABILITY").reduce((s, [, v]) => s + v, 0) - g("EQUITY").reduce((s, [, v]) => s + v, 0) + profit;
      return [`Balance sheet · as on ${t}`, [["Particulars", "Amount"], ["CAPITAL & LIABILITIES", ""], ...g("EQUITY").map(([a, v]) => [a, f2(-v)]), ["Profit this year (from P&L)", f2(profit)], ...g("LIABILITY").map(([a, v]) => [a, f2(-v)]), ["Total", f2(tl)],
        ["ASSETS", ""], ...g("ASSET").map(([a, v]) => [a, f2(v)]), ["Total", f2(g("ASSET").reduce((s, [, v]) => s + v, 0))]]]; }
    case "cash": { const prev = new Date(new Date(f).getTime() - 864e5).toISOString().slice(0, 10), op = bkNet(es, "0000", prev); let c = op[BK.CASH] || 0, b = op[BK.BANK] || 0;
      return [`Cash & bank book · ${f} to ${t}`, [["Date", "Type", "Ref", "Details", "Cash in", "Cash out", "Cash balance", "UPI/Bank in", "UPI/Bank out", "UPI/Bank balance"], ["", "Opening", "", "", "", "", f2(c), "", "", f2(b)],
        ...es.filter(e => e.date >= f && e.date <= t && e.lines.some(l => l.a === BK.CASH || l.a === BK.BANK)).map(e => {
          const cl = e.lines.filter(l => l.a === BK.CASH), bl = e.lines.filter(l => l.a === BK.BANK), s = (L, k) => L.reduce((a, l) => a + (l[k] || 0), 0);
          c += s(cl, "dr") - s(cl, "cr"); b += s(bl, "dr") - s(bl, "cr");
          return [e.date, e.type, e.ref, e.text, s(cl, "dr") ? f2(s(cl, "dr")) : "", s(cl, "cr") ? f2(s(cl, "cr")) : "", f2(c), s(bl, "dr") ? f2(s(bl, "dr")) : "", s(bl, "cr") ? f2(s(bl, "cr")) : "", f2(b)]; })]]; }
    case "vendors": {
      const vs = BKD.vendors || [], ex = x.exps;
      const names = [...new Set([...vs.map(v => v.name), ...ex.map(e => e.vendor).filter(Boolean)])].sort();
      return ["Vendors · all time", [["Vendor", "GSTIN", "Phone", "Address", "Bills", "Bill total", "Returned", "Paid", "Still to pay"], ...names.map(n => {
        const v = vs.find(z => z.name === n) || {}, b = ex.filter(e => (e.vendor || "").toLowerCase() === n.toLowerCase()), tot = b.reduce((a, e) => a + Number(e.amount), 0), due = b.filter(e => e.paid === false).reduce((a, e) => a + bkOwed(e), 0), back = b.reduce((a, e) => a + bkRetSum(e.id), 0);
        return [n, v.gstin || b.find(e => e.vendor_gstin)?.vendor_gstin || "", v.phone || "", v.addr || "", String(b.length), f2(tot), f2(back), f2(tot - back - due), f2(due)]; })]];
    }
    case "udhaar": return ["Udhaar (customers) · counter bills on credit", [["Bill", "Date", "Customer", "Mobile", "Bill total", "Collected / returned", "Still due", "Last reminder"], ...BKD.ud.map(({ c, due }) => [c.bill_no || "", bkDay(c.created_at), c.cust_name, c.cust_phone || "", f2(c.total), f2(c.total - due), f2(Math.max(due, 0)), c.reminded_on || ""])]];
    case "profit": return bkProfit();
    case "pret": return [`Purchase returns · ${f} to ${t}`, [["Date", "Vendor", "Purchase bill", "Items", "Taxable", "GST (reversed)", "Total", "Settled by", "Vendor CN / UTR", "Status"],
      ...bkRetRows().map(r => { const e = x.exps.find(z => z.id === r.expense_id) || {};
        return [r.on_date, e.vendor || "", e.bill_no || "", (BKD.retLines || []).filter(l => l.return_id === r.id).map(l => `${l.item_name}${l.variant ? " (" + l.variant + ")" : ""} ×${l.qty}`).join("; "),
          f2(r.amount - (r.gst || 0)), f2(r.gst || 0), f2(r.amount), r.mode === "ADJUST" ? "Taken off the bill" : r.mode + " received", r.ref || "", r.cancelled_at ? "Cancelled" + (r.cancel_reason ? " — " + r.cancel_reason : "") : "Done"]; })]];
    case "vend": return [`Expenses & vendor bills · ${f} to ${t}`, [["Date", "Head", "Vendor", "Vendor GSTIN", "Invoice no", "Taxable", "GST %", "GST (input)", "Total", "Status", "Paid by", "Paid on", "UTR", "Note", "Items", "Returned"],
      ...x.exps.filter(e => e.on_date >= f && e.on_date <= t).map(e => [e.on_date, e.head, e.vendor || "", e.vendor_gstin || "", e.bill_no || "", f2(e.amount - (e.gst || 0)), e.gst_rate ?? "", f2(e.gst || 0), f2(e.amount),
        e.paid === false ? "To pay" : "Paid", e.paid === false ? "" : (e.paid_mode || e.mode), e.paid === false ? "" : (e.paid_on || e.on_date), e.paid_ref || "", e.note || "", bkLinesText(e.id), bkRetSum(e.id) ? f2(bkRetSum(e.id)) : ""])]];
    default: return [`Day book · ${f} to ${t}`, [["Date", "Type", "Ref", "Details", "Account", "Debit", "Credit"], ...es.filter(e => e.date >= f && e.date <= t).flatMap(e => e.lines.map((l, i) => [i ? "" : e.date, i ? "" : e.type, i ? "" : e.ref, i ? "" : e.text, l.a, l.dr ? f2(l.dr) : "", l.cr ? f2(l.cr) : ""]))]];
  }
}
function bkShow() {
  document.querySelectorAll("#kb .btn[onclick^=\"BKD.tab\"]").forEach(b => b.className = "btn " + (b.getAttribute("onclick").includes(`'${BKD.tab}'`) ? "pink" : "ghost"));
  const [title, rows] = bkRows(), num = v => /^-?\d+\.\d\d$/.test(v);
  BKD.cur = [title, rows];
  $("#kbody").innerHTML = `<h3>${esc(title)} <button class="btn ghost" style="float:right;padding:7px 12px" onclick="bkDl()">⇩ Excel</button></h3>
    ${BKD.tab === "bs" ? `<div class="sub">Negative cash means you paid from your own pocket — add it with “Owner money”.</div>` : ""}
    ${BKD.tab === "profit" ? `<div class="sub">Cost = quantity sold × the item's cost price (the rate of its latest stock purchase with items). ${S.gst_billing && S.gstin ? "Sales and cost are before GST." : "Sales and cost include GST."} Items with no stock purchase show “cost not set”.${BKD.plOk ? "" : " <b>Run update-99 in Supabase to turn this on.</b>"}</div>` : ""}
    ${BKD.tab === "udhaar" ? bkRemindBox() : ""}
    ${BKD.tab === "pret" ? `<div class="sub">Items sent back to a vendor. Add one from Expenses &amp; vendor bills → <b>Return</b> on a stock purchase with items.${BKD.retOk ? "" : " <b>Run update-99 in Supabase to turn this on.</b>"}</div>` : ""}
    <div style="overflow:auto"><table><thead><tr>${rows[0].map(h => `<th>${esc(h)}</th>`).join("")}${["udhaar", "vend", "pret"].includes(BKD.tab) ? "<th></th>" : ""}</tr></thead><tbody>${rows.slice(1).map((r, i) => {
      const bold = /^[A-Z &]+$/.test(r[0]) && /[A-Z]/.test(r[0]) || /^total/i.test(r[0]);
      let act = "";
      if (BKD.tab === "udhaar") { const u = BKD.ud[i]; if (u && u.due > .009) act = `<button class="edit" onclick="bkCollect('${u.c.id}')">Collect</button>`; }
      if (BKD.tab === "pret") { const r = bkRetRows()[i]; if (r && !r.cancelled_at) act = `<button class="edit" style="color:#BE185D" onclick="bkRetCancel('${r.id}')">Cancel</button>`; }
      if (BKD.tab === "vend") { const e = BKD.x.exps.filter(e => e.on_date >= BKD.from && e.on_date <= BKD.to)[i]; act = `${e && e.paid === false ? `<button class="edit" onclick="bkPay('${e.id}')">Mark paid</button>` : ""}${e?.bill_url ? ` <a class="edit" href="${esc(e.bill_url)}" target="_blank">Bill</a>` : ""}${e && e.head === "Stock purchase" && BKD.plOk ? ` <button class="edit" onclick="bkExpense('${e.id}')">Edit</button>` : ""}${e && BKD.retOk && (BKD.pl || []).some(l => l.expense_id === e.id) ? ` <button class="edit" onclick="bkReturn('${e.id}')">Return</button>` : ""}${e ? ` <button class="edit" style="color:#BE185D" onclick="bkDel('${e.id}')">Cancel</button>` : ""}`; }
      return `<tr>${r.map(v => `<td style="${num(v) ? "text-align:right;" : ""}${bold ? "font-weight:700" : ""}">${num(v) ? inr2(v) : esc(v)}</td>`).join("")}${["udhaar", "vend", "pret"].includes(BKD.tab) ? `<td style="white-space:nowrap">${act}</td>` : ""}</tr>`; }).join("")}</tbody></table></div>
    ${rows.length <= 1 ? '<div class="sub">Nothing here for this period.</div>' : ""}`;
}
function bkDl() { const [title, rows] = BKD.cur; csvDownload(`${title.split(" ·")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${BKD.from}_to_${BKD.to}.csv`, [[S.name + " — " + title], ...rows]); }

/* stock purchase lines: picked from the catalogue; the bill total comes from the lines (save_purchase, update-99) */
let XL = [];
const bkOpt = (i, v) => v ? `${i.name} (${v})` : i.name;
function bkLinesText(expId) { return (BKD.pl || []).filter(l => l.expense_id === expId).map(l => `${l.item_name}${l.variant ? " (" + l.variant + ")" : ""} ×${l.qty} @${f2(l.rate)}${Number(l.gst_rate) ? " +" + Number(l.gst_rate) + "%" : ""}`).join("; "); }
function bkLineAmt(l, gstOn) { const q = +l.q || 0, r = +l.r || 0, g = gstOn ? +l.g || 0 : 0; return { tax: r2(q * r * g / 100), tot: r2(q * r * (1 + g / 100)) }; }
function bkLinesDraw() {
  const gstOn = !!(S.gst_billing && S.gstin), box = $("#xlines"); if (!box) return;
  const cols = gstOn ? ".8fr 1.15fr 1.15fr 1fr" : "1fr 1.3fr 1.2fr";
  box.innerHTML = XL.map((l, k) => {
    const it = D.items.find(i => i.id === l.id), st = it?.stock_qty;
    return `<div style="border:1px solid #EEE6F7;border-radius:12px;padding:8px 10px;margin-top:8px">
      <div style="display:flex;gap:8px;align-items:flex-start"><div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(l.name)}</b>${l.v ? ` <span class="sub">(${esc(l.v)})</span>` : ""}
        <div class="sub" style="font-size:11.5px">${it ? (st == null ? "Stock not counted yet — counting starts with this purchase" : `In stock now: ${st}`) : "Item not in your catalogue any more"}</div></div>
        <button class="edit" style="color:#BE185D;font-size:18px;line-height:1" title="Remove item" aria-label="Remove item" onclick="XL.splice(${k},1);bkLinesDraw()">×</button></div>
      <div style="display:grid;grid-template-columns:${cols};gap:6px;align-items:end;margin-top:6px">
        <div><label style="margin:0">QTY</label><input class="in" inputmode="numeric" data-k="${k}" data-f="q" value="${esc(l.q)}"></div>
        <div><label style="margin:0">RATE ₹${gstOn ? " (EX-GST)" : ""}</label><input class="in" inputmode="decimal" data-k="${k}" data-f="r" value="${esc(l.r)}"></div>
        ${gstOn ? `<div><label style="margin:0">GST</label><select class="in" data-k="${k}" data-f="g">${[0, 5, 12, 18, 28, 40].map(r => `<option value="${r}" ${+l.g === r ? "selected" : ""}>${r}%</option>`).join("")}</select></div>` : ""}
        <div style="text-align:right"><label style="margin:0">AMOUNT</label><div style="padding:10px 0;font-weight:600;white-space:nowrap" id="xla${k}">${inr2(bkLineAmt(l, gstOn).tot)}</div></div></div></div>`; }).join("");
  $$("#xlines [data-k]").forEach(el => { el[el.tagName === "SELECT" ? "onchange" : "oninput"] = () => {
    const l = XL[+el.dataset.k], f = el.dataset.f;
    if (f === "g") l.g = +el.value; else { const v = el.value.replace(f === "q" ? /\D/g : /[^\d.]/g, ""); if (v !== el.value) el.value = v; l[f] = v; }
    $("#xla" + el.dataset.k).textContent = inr2(bkLineAmt(l, gstOn).tot); bkLinesTotal(); }; });
  bkLinesTotal();
}
function bkLinesTotal() {
  const gstOn = !!(S.gst_billing && S.gstin), on = XL.length > 0, a = $("#xa"); if (!a) return;
  a.readOnly = on; if ($("#xrw")) $("#xrw").style.display = on ? "none" : "";
  if (!on) return;
  const tot = r2(XL.reduce((s, l) => s + bkLineAmt(l, gstOn).tot, 0)), tax = r2(XL.reduce((s, l) => s + bkLineAmt(l, gstOn).tax, 0));
  a.value = tot ? tot : ""; if ($("#xs")) $("#xs").textContent = gstOn && tax ? `Taxable ${inr2(tot - tax)} + GST ${inr2(tax)}` : "";
}
function bkPick() {
  const v = $("#xls").value.trim(); if (!v) return;
  for (const i of D.items) {
    const vs = (i.variants || []).length ? i.variants.map(x => x.n) : [null];
    for (const vn of vs) if (bkOpt(i, vn).toLowerCase() === v.toLowerCase()) {
      const had = XL.find(l => l.id === i.id && l.v === vn);
      if (had) had.q = String((+had.q || 0) + 1);
      else XL.push({ id: i.id, name: i.name, v: vn, q: "1", r: BKD.cost?.has(i.id) ? String(BKD.cost.get(i.id)) : "", g: +(i.gst_rate || 0) });
      $("#xls").value = ""; bkLinesDraw(); return;
    }
  }
}

function bkExpense(editId) {
  const gstOn = !!(S.gst_billing && S.gstin), heads = ["Stock purchase", "Rent", "Electricity", "Salary", "Transport", "Packaging", "Repairs", "Phone / internet", "Subscription / software", "Other"];
  const ed = editId ? BKD.x.exps.find(e => e.id === editId) : null; if (editId && !ed) return;
  XL = ed ? (BKD.pl || []).filter(l => l.expense_id === ed.id && l.item_id).map(l => ({ id: l.item_id, name: l.item_name, v: l.variant || null, q: String(l.qty), r: String(Number(l.rate)), g: Number(l.gst_rate) })) : [];
  const opts = D.items.flatMap(i => ((i.variants || []).length ? i.variants.map(x => x.n) : [null]).map(vn => `<option value="${esc(bkOpt(i, vn))}">`)).join("");
  drawer(`<h2><span>${ed ? "Edit stock purchase" : "Expense / vendor bill"}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <label>WHAT FOR?</label><select class="in" id="xh" ${ed ? "disabled" : ""}>${heads.map(h => `<option>${h}</option>`).join("")}</select><input class="in" id="xo" placeholder="Expense name (for Other)" style="display:none;margin-top:6px">
    <div id="xlw" style="display:none;margin-top:4px"><label>ITEMS BOUGHT (optional — adds to stock and sets the cost price)</label>
      ${BKD.plOk ? `<input class="in" id="xls" list="xll" placeholder="${D.items.length ? "Search your catalogue — type and pick an item" : "Add items to your catalogue first"}" autocomplete="off"><datalist id="xll">${opts}</datalist><div id="xlines"></div>
      <div class="sub" style="font-size:11.5px;margin-top:4px">With items, the bill total is worked out from them. Leave items empty to enter only a total, as before.</div>` : `<div class="sub">Run update-99 in Supabase to add items to a stock purchase.</div>`}</div>
    <label>VENDOR / PAID TO ${ed ? "" : `<a class="edit" onclick="bkVendor(true)">＋ New vendor</a>`}</label><input class="in" id="xv" list="xvl" placeholder="Pick or type — e.g. Sharma Wholesale">
    <datalist id="xvl">${(BKD.vendors || []).map(v => `<option value="${esc(v.name)}">`).join("")}</datalist>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>INVOICE NO</label><input class="in" id="xn"></div><div><label>INVOICE DATE</label><input class="in" type="date" id="xd" value="${todayStr()}"></div></div>
    ${gstOn ? `<label>VENDOR GSTIN</label><input class="in" id="xg" maxlength="15">` : ""}
    <label>BILL TOTAL ₹ (incl. GST)</label><input class="in" id="xa" inputmode="decimal">
    ${gstOn ? `<div id="xrw"><label>GST ON THIS BILL (input credit)</label><select class="in" id="xr">${[0, 5, 12, 18, 28, 40].map(r => `<option value="${r}">${r ? r + "%" : "Nil / 0%"}</option>`).join("")}</select></div><div class="sub" id="xs"></div>` : ""}
    ${ed ? `<div class="sub" style="margin-top:8px">Payment details stay as they are. To take the whole purchase back, cancel it instead.</div>` : `<label>PAID?</label><select class="in" id="xp"><option value="Cash">Paid now — Cash</option><option value="UPI">Paid now — UPI</option><option value="Bank">Paid now — Bank</option><option value="">Pay later</option></select>
    <div id="xuw" style="display:none;grid-template-columns:1fr 1fr;gap:8px"><div><label>UTR / CHEQUE NO</label><input class="in" id="xu"></div><div><label>UTR (PAYMENT) DATE</label><input class="in" type="date" id="xud" value="${todayStr()}"></div></div>`}
    <label>NOTE</label><input class="in" id="xx">
    <div class="msg" id="xm"></div><button class="btn pink full" id="xsv" style="margin-top:12px">Save</button>`);
  const stockOn = () => $("#xh").value === "Stock purchase";
  $("#xh").onchange = () => { $("#xo").style.display = $("#xh").value === "Other" ? "block" : "none"; $("#xlw").style.display = stockOn() ? "block" : "none"; if (!stockOn()) { XL = []; bkLinesDraw(); $("#xa").readOnly = false; if ($("#xrw")) $("#xrw").style.display = ""; } };
  $("#xh").onchange();
  if ($("#xls")) { $("#xls").oninput = bkPick; $("#xls").onchange = bkPick; }
  const calc = () => { if (!gstOn || XL.length) return 0; const a = +$("#xa").value || 0, r = +$("#xr").value; const g = r2(a * r / (100 + r)); $("#xs").textContent = r && a ? `Taxable ${inr2(a - g)} + GST ${inr2(g)}` : ""; return g; };
  if (gstOn) { $("#xa").oninput = calc; $("#xr").onchange = calc; }
  if ($("#xp")) $("#xp").onchange = () => $("#xuw").style.display = ["UPI", "Bank"].includes($("#xp").value) ? "grid" : "none";
  $("#xv").onchange = () => { const v = (BKD.vendors || []).find(z => z.name.toLowerCase() === $("#xv").value.trim().toLowerCase()); if (v && gstOn && v.gstin && !$("#xg").value) $("#xg").value = v.gstin; };
  if (ed) { $("#xv").value = ed.vendor || ""; $("#xn").value = ed.bill_no || ""; $("#xd").value = ed.on_date; $("#xx").value = ed.note || ""; if (gstOn) $("#xg").value = ed.vendor_gstin || ""; }
  bkLinesDraw();
  $("#xsv").onclick = async () => {
    const head = $("#xh").value === "Other" ? $("#xo").value.trim() : $("#xh").value, m = $("#xm"), lines = stockOn() ? XL : [];
    const bad = t => { m.className = "msg err"; m.textContent = t; };
    if (ed && !lines.length) return bad("Add at least one item, or cancel the purchase to take it back");
    if (lines.some(l => !(Math.round(+l.q) >= 1) || l.r === "" || !(+l.r >= 0))) return bad("Enter the quantity and purchase rate for every item");
    const a = +$("#xa").value || 0;
    if (!a || !head) return bad("Enter what for and the amount");
    $("#xsv").disabled = true;
    try {
      const pm = ed ? null : $("#xp").value, later = !ed && !pm;
      const vendor = $("#xv").value.trim() || null, vgst = gstOn ? ($("#xg").value.trim().toUpperCase() || null) : null;
      if (lines.length) {
        const p = { on_date: $("#xd").value, vendor, vendor_gstin: vgst, bill_no: $("#xn").value.trim() || null, note: $("#xx").value.trim() || null,
          ...(ed ? {} : { mode: pm || "Cash", paid: !later, paid_on: later ? null : (["UPI", "Bank"].includes(pm) ? $("#xud").value : $("#xd").value), paid_mode: later ? null : pm,
            paid_ref: ["UPI", "Bank"].includes(pm) && $("#xu").value.trim() ? $("#xu").value.trim() : null }) };
        const { error } = await db.rpc("save_purchase", { p_id: ed ? ed.id : null, p, p_lines: lines.map(l => ({ item_id: l.id, variant: l.v, qty: Math.round(+l.q), rate: +l.r, gst_rate: gstOn ? +l.g || 0 : 0 })) });
        if (error) throw error;
      } else {
        const row = { shop: S.id, on_date: $("#xd").value, head, amount: a, mode: pm || "Cash", note: $("#xx").value.trim() || null, vendor,
          vendor_gstin: vgst, bill_no: $("#xn").value.trim() || null, gst_rate: gstOn ? +$("#xr").value : null, gst: calc(),
          paid: !later, paid_on: later ? null : (["UPI", "Bank"].includes(pm) ? $("#xud").value : $("#xd").value), paid_mode: later ? null : pm,
          ...(["UPI", "Bank"].includes(pm) && $("#xu").value.trim() ? { paid_ref: $("#xu").value.trim() } : {}) };
        const { error } = await db.from("shop_expenses").insert(row); if (error) throw error;
      }
      if (vendor && BKD.vendors && !BKD.vendors.some(v => v.name.toLowerCase() === vendor.toLowerCase()))
        await db.from("shop_vendors").insert({ shop: S.id, name: vendor, gstin: vgst });
      if (lines.length) { const it = await db.from("items").select("*").eq("shop", S.id).order("name"); if (!it.error) D.items = it.data || D.items; }
      closeDrawer(); toast(lines.length ? (ed ? "Purchase updated — stock adjusted" : `Saved — stock added for ${lines.length} item${lines.length > 1 ? "s" : ""}`) : "Saved"); BKD.tab = "vend"; books();
    } catch (e) { bad(dupMsg(e)); $("#xsv").disabled = false; }
  };
}
function bkOwner() {
  drawer(`<h2><span>Owner's money</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <label>WHAT HAPPENED?</label><select class="in" id="ok"><option value="CAPITAL">I put money in (opening cash, paid a shop bill from my pocket)</option><option value="DRAWINGS">I took money out (personal use)</option></select>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>AMOUNT ₹</label><input class="in" id="oa" inputmode="decimal"></div><div><label>DATE</label><input class="in" type="date" id="od" value="${todayStr()}"></div></div>
    <label>CASH OR BANK</label><select class="in" id="om"><option>Cash</option><option value="Bank">UPI / Bank</option></select><label>NOTE</label><input class="in" id="on">
    <div class="msg" id="omg"></div><button class="btn pink full" id="osv" style="margin-top:12px">Save</button>`);
  $("#osv").onclick = async () => {
    const a = +$("#oa").value || 0; if (!a) return $("#omg").textContent = "Enter the amount";
    const { error } = await db.from("shop_receipts").insert({ shop: S.id, kind: $("#ok").value, on_date: $("#od").value, amount: a, mode: $("#om").value, note: $("#on").value.trim() || null });
    if (error) { $("#omg").className = "msg err"; return $("#omg").textContent = niceErr(error); }
    closeDrawer(); toast("Saved"); books();
  };
}
function bkCollect(id) {
  const u = BKD.ud.find(x => x.c.id === id); if (!u) return;
  drawer(`<h2><span>Collect udhaar</span><button class="x" onclick="closeDrawer()">×</button></h2><div class="sub">${esc(u.c.bill_no)} · ${esc(u.c.cust_name)} · due ${inr2(u.due)}</div>
    <label>AMOUNT RECEIVED ₹</label><input class="in" id="ca" value="${u.due}"><label>MODE</label><select class="in" id="cm"><option>Cash</option><option>UPI</option></select>
    <label>UTR NO (for UPI)</label><input class="in" id="cu"><label>DATE RECEIVED</label><input class="in" type="date" id="cd" value="${todayStr()}">
    <div class="msg" id="cmg"></div><button class="btn pink full" id="csv" style="margin-top:12px">Save</button>`);
  $("#csv").onclick = async () => {
    const a = +$("#ca").value || 0; if (!a) return;
    const { error } = await db.from("shop_receipts").insert({ shop: S.id, kind: "UDHAAR", sale_id: id, on_date: $("#cd").value, amount: a, mode: $("#cm").value, ...($("#cu").value.trim() ? { ref: $("#cu").value.trim() } : {}) });
    if (error) { $("#cmg").className = "msg err"; return $("#cmg").textContent = dupMsg(error); }
    closeDrawer(); toast(`Payment recorded against ${u.c.bill_no}`); books();
  };
}
function bkPay(id) {
  drawer(`<h2><span>Pay vendor bill</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <label>PAID BY</label><select class="in" id="pm2"><option>Cash</option><option>UPI</option><option>Bank</option></select>
    <label>UTR / CHEQUE NO (UPI / Bank)</label><input class="in" id="pu2"><label>UTR / PAYMENT DATE</label><input class="in" type="date" id="pd2" value="${todayStr()}">
    <div class="msg" id="pmg"></div><button class="btn pink full" id="psv2" style="margin-top:12px">Mark paid</button>`);
  $("#psv2").onclick = async () => {
    const { error } = await db.from("shop_expenses").update({ paid: true, paid_on: $("#pd2").value, paid_mode: $("#pm2").value, ...($("#pu2").value.trim() ? { paid_ref: $("#pu2").value.trim() } : {}) }).eq("id", id);
    if (error) return $("#pmg").textContent = dupMsg(error);
    closeDrawer(); books();
  };
}
// finance entries are never deleted (update-61): a wrong expense is cancelled — kept for the records, left out of every total
async function bkDel(id) {
  const why = prompt("Cancel this expense? It stays in your records but is left out of every total.\n\nReason (e.g. entered twice):");
  if (why === null) return;
  const { error } = await db.from("shop_expenses").update({ cancelled_at: new Date().toISOString(), cancel_reason: why.trim() || "Cancelled" }).eq("id", id);
  if (error) return toast(niceErr(error)); toast("Expense cancelled"); books();
}

function bkVendor(fromExpense) {
  const back = fromExpense ? $("#xv")?.value : "";
  drawer(`<h2><span>New vendor</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <label>VENDOR NAME</label><input class="in" id="vn" value="${esc(back || "")}" placeholder="e.g. Sharma Wholesale"><label>GSTIN (optional)</label><input class="in" id="vg" maxlength="15">
    <label>PHONE (optional)</label><input class="in" id="vp" inputmode="tel"><label>ADDRESS (optional)</label><textarea class="in" id="va" rows="2"></textarea><label>NOTE</label><input class="in" id="vx" placeholder="e.g. atta & dal supplier">
    <div class="msg" id="vm"></div><button class="btn pink full" id="vsv" style="margin-top:12px">Save vendor</button>`);
  $("#vsv").onclick = async () => {
    const name = $("#vn").value.trim(); if (!name) return $("#vm").textContent = "Enter the vendor name";
    const { error } = await db.from("shop_vendors").insert({ shop: S.id, name, gstin: $("#vg").value.trim().toUpperCase() || null, phone: $("#vp").value.trim() || null, note: $("#vx").value.trim() || null, ...($("#va").value.trim() ? { addr: $("#va").value.trim() } : {}) });
    if (error) { $("#vm").className = "msg err"; return $("#vm").textContent = /duplicate|unique/i.test(error.message) ? "This vendor is already in your list" : niceErr(error); }
    closeDrawer(); toast("Vendor added"); if (fromExpense) { await books(); bkExpense(); $("#xv").value = name; } else { BKD.tab = "vendors"; books(); }
  };
}

/* Item profit: what each item sold for in the period against its cost price (latest stock purchase with items) */
function bkProfit() {
  const x = BKD.x, f = BKD.from, t = BKD.to, gstOn = !!(S.gst_billing && S.gstin), cost = BKD.cost || new Map();
  const byId = new Map(D.items.map(i => [i.id, i])), byName = new Map(D.items.map(i => [String(i.name).trim().toLowerCase(), i]));
  const find = l => { if (l.i && byId.has(l.i)) return byId.get(l.i); const n = String(l.n || "").trim().toLowerCase(); return byName.get(n) || byName.get(n.replace(/\s*\([^)]*\)\s*$/, "")) || null; };
  const agg = new Map(), add = (l, sign) => {
    const it = find(l), k = it ? it.id : "n:" + String(l.n || "").toLowerCase(), g = gstOn ? +l.g || 0 : 0, q = +l.q || 0, v = (+l.p || 0) * q * (gstOn ? 100 / (100 + g) : 1);
    const a = agg.get(k) || { name: it ? it.name : l.n || "Item", id: it?.id || null, q: 0, v: 0 }; a.q += sign * q; a.v += sign * v; agg.set(k, a);
  };
  const inP = d => d >= f && d <= t;
  x.orders.filter(o => o.status === "DELIVERED" && o.bill_no && inP(bkDay(o.delivered_at || o.created_at))).forEach(o => (o.items || []).forEach(l => add(l, 1)));
  x.counter.filter(c => c.bill_no && inP(bkDay(c.created_at))).forEach(c => (c.items || []).forEach(l => add(l, 1)));
  x.cns.filter(n => n.kind !== "REPLACEMENT" && inP(n.cn_date || bkDay(n.created_at))).forEach(n => (n.items || []).forEach(l => add(l, -1)));
  const rows = [...agg.values()].filter(a => a.q > 0 || Math.abs(a.v) > .004).map(a => {
    const cp = a.id != null && cost.has(a.id) ? cost.get(a.id) : null, c = cp == null ? null : r2(a.q * cp), p = c == null ? null : r2(a.v - c);
    return { ...a, v: r2(a.v), cp, c, p };
  }).sort((a, b) => (a.p == null) - (b.p == null) || (b.p ?? b.v) - (a.p ?? a.v));
  const set = rows.filter(r => r.p != null), sv = r2(set.reduce((s, r) => s + r.v, 0)), sc = r2(set.reduce((s, r) => s + r.c, 0));
  const pct = (p, v) => v > 0 ? (p / v * 100).toFixed(1) + "%" : "";
  return [`Item profit · ${f} to ${t}`, [["Item", "Qty sold", gstOn ? "Sales (before GST)" : "Sales value", "Cost price / unit", "Cost", "Profit", "Margin %"],
    ...rows.map(r => [r.name, String(r.q), f2(r.v), r.cp == null ? "cost not set" : f2(r.cp), r.c == null ? "" : f2(r.c), r.p == null ? "" : f2(r.p), r.p == null ? "" : pct(r.p, r.v)]),
    ...(set.length ? [["TOTAL (items with cost)", String(set.reduce((s, r) => s + r.q, 0)), f2(sv), "", f2(sc), f2(sv - sc), pct(sv - sc, sv)]] : [])]];
}

/* Udhaar reminder: a ready message opens in the seller's own WhatsApp / SMS. Gali Bazaar sends nothing; only the date is noted. */
function bkCusts() {
  const m = new Map();
  (BKD.ud || []).filter(u => u.due > .009).forEach(({ c, due }) => {
    const ph = String(c.cust_phone || "").replace(/\D/g, "").slice(-10), k = ph.length === 10 ? ph : "n:" + String(c.cust_name || "").trim().toLowerCase();
    const a = m.get(k) || { name: c.cust_name || "Customer", phone: ph.length === 10 ? ph : "", due: 0, ids: [], rem: null };
    a.due = r2(a.due + due); a.ids.push(c.id); if (c.reminded_on && (!a.rem || c.reminded_on > a.rem)) a.rem = c.reminded_on; m.set(k, a);
  });
  return BKD.cust = [...m.values()].sort((a, b) => b.due - a.due);
}
function bkRemindBox() {
  const cs = bkCusts(), today = todayStr();
  if (!cs.length) return "";
  return `<div style="border:1px solid #EEE6F7;border-radius:12px;padding:10px 12px;margin:8px 0 12px"><b style="font-size:14px">Send a reminder</b>
    <div class="sub" style="font-size:12px">Opens a ready message in your WhatsApp or SMS — you send it yourself. Once a day per customer.</div>
    ${cs.map((c, i) => `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 0;border-top:1px solid #F3EEF9">
      <div style="flex:1;min-width:160px"><b>${esc(c.name)}</b> <span class="sub">${c.phone ? esc(c.phone) : "no mobile"}</span><div class="sub" style="font-size:12px">${inr2(c.due)} due${c.rem ? ` · Reminded ${dmy(c.rem)}` : ""}</div></div>
      ${c.rem === today ? `<button class="btn ghost" style="padding:7px 12px" disabled>Reminded today</button>` : `<button class="btn ghost" style="padding:7px 12px" onclick="bkRemind(${i})">Send reminder</button>`}</div>`).join("")}</div>`;
}
function bkRemMsg(c, lang) {
  const amt = "₹" + Number(c.due).toLocaleString("en-IN", { maximumFractionDigits: 2 }), d = dmy(todayStr()), upi = String(S.upi_id || "").trim();
  return lang === "en"
    ? `Hello ${c.name}, ${amt} is due at ${S.name} (as of ${d}).${upi ? ` UPI: ${upi}` : ""} — thank you.`
    : `Namaste ${c.name}, ${S.name} par aapke ${amt} baaki hain (${d} tak).${upi ? ` UPI: ${upi}` : ""} — dhanyavaad.`;
}
function bkRemind(i) {
  const c = BKD.cust?.[i]; if (!c) return;
  drawer(`<h2><span>Udhaar reminder</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <div class="sub">${esc(c.name)} · ${c.phone ? esc(c.phone) : "no mobile on the bill — pick the contact in WhatsApp"} · ${inr2(c.due)} due</div>
    <label>LANGUAGE</label><select class="in" id="rl"><option value="hi">Hindi (Roman)</option><option value="en">English</option></select>
    <label>MESSAGE (you can change it)</label><textarea class="in" id="rmsg" rows="4"></textarea>
    ${S.upi_id ? "" : `<div class="sub" style="font-size:12px">Add your UPI ID in Shop to put it in the message.</div>`}
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><a class="btn pink" id="rwa" target="_blank" rel="noopener" style="flex:1;text-align:center">WhatsApp</a><a class="btn ghost" id="rsms" style="flex:1;text-align:center">SMS</a></div>
    <div class="sub" style="font-size:11.5px;margin-top:8px">Nothing is sent by Gali Bazaar. We only note today's date so you don't remind twice in a day.</div>`);
  const link = () => { const t = encodeURIComponent($("#rmsg").value.trim()), ph = c.phone ? "91" + c.phone : "";
    $("#rwa").href = `https://wa.me/${ph}?text=${t}`; $("#rsms").href = `sms:${c.phone ? "+91" + c.phone : ""}?body=${t}`; };
  $("#rl").onchange = () => { $("#rmsg").value = bkRemMsg(c, $("#rl").value); link(); };
  $("#rmsg").oninput = link; $("#rl").onchange();
  $("#rwa").onclick = $("#rsms").onclick = () => { bkRemLog(c); };
}
async function bkRemLog(c) {
  const { data, error } = await db.rpc("udhaar_reminded", { p_ids: c.ids });
  if (error) return toast(/udhaar_reminded|function/i.test(error.message) ? "Run update-99 in Supabase to note reminders" : niceErr(error));
  BKD.x.counter.forEach(s => { if (c.ids.includes(s.id)) s.reminded_on = data || todayStr(); });
  closeDrawer(true); toast(`Reminder noted for ${c.name}`); bkShow();
}

/* Purchase return (debit note): items of a stock purchase sent back to the vendor — save_purchase_return (update-99) */
const bkRetSum = id => r2((BKD.x?.rets || []).filter(r => r.expense_id === id).reduce((a, r) => a + Number(r.amount), 0));
const bkOwed = e => r2(Number(e.amount) - (BKD.x?.rets || []).filter(r => r.expense_id === e.id && r.mode === "ADJUST").reduce((a, r) => a + Number(r.amount), 0));
const bkRetRows = () => (BKD.retAll || []).filter(r => r.on_date >= BKD.from && r.on_date <= BKD.to);
function bkReturn(expId) {
  const e = BKD.x.exps.find(z => z.id === expId); if (!e) return;
  const gstOn = !!(S.gst_billing && S.gstin), live = new Set((BKD.retAll || []).filter(r => !r.cancelled_at).map(r => r.id));
  const lines = (BKD.pl || []).filter(l => l.expense_id === expId).map(l => ({ ...l, left: l.qty - (BKD.retLines || []).filter(rl => rl.line_id === l.id && live.has(rl.return_id)).reduce((a, rl) => a + rl.qty, 0) }));
  const owe = e.paid === false ? bkOwed(e) : 0;
  drawer(`<h2><span>Purchase return</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <div class="sub">${esc(e.vendor || "Vendor")}${e.bill_no ? " · bill " + esc(e.bill_no) : ""} · ${esc(e.on_date)} · ${inr2(e.amount)}</div>
    <label>HOW MANY OF EACH ITEM ARE YOU SENDING BACK?</label>
    ${lines.map((l, k) => `<div style="display:flex;gap:8px;align-items:center;border-top:1px solid #F3EEF9;padding:8px 0"><div style="flex:1;min-width:0"><b style="font-size:13.5px">${esc(l.item_name)}</b>${l.variant ? ` <span class="sub">(${esc(l.variant)})</span>` : ""}
      <div class="sub" style="font-size:11.5px">Bought ${l.qty} @ ${inr2(l.rate)}${Number(l.gst_rate) ? " + " + Number(l.gst_rate) + "% GST" : ""} · can return ${l.left}</div></div>
      <input class="in" style="width:76px" inputmode="numeric" data-r="${k}" value="0" ${l.left > 0 ? "" : "disabled"}></div>`).join("")}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>RETURN DATE</label><input class="in" type="date" id="rd" value="${todayStr()}" min="${esc(e.on_date)}"></div>
      <div><label>VENDOR CREDIT NOTE / UTR</label><input class="in" id="rr" maxlength="40"></div></div>
    <label>HOW DOES THE VENDOR SETTLE IT?</label><select class="in" id="rmode">${e.paid === false ? `<option value="ADJUST">Take it off this bill (still to pay ${inr2(owe)})</option>` : ""}<option value="Cash">Vendor paid me back — Cash</option><option value="UPI">Vendor paid me back — UPI</option><option value="Bank">Vendor paid me back — Bank</option></select>
    <label>NOTE</label><input class="in" id="rn" placeholder="e.g. damaged packets">
    <div class="sub" id="rtot" style="margin-top:10px;font-weight:600"></div>
    <div class="sub" style="font-size:11.5px">The items come off your stock${gstOn ? " and the input GST on them is reversed" : ""}. A return can be cancelled later, not deleted.</div>
    <div class="msg" id="rm"></div><button class="btn pink full" id="rsv" style="margin-top:12px">Save return</button>`);
  const q = () => lines.map((l, k) => { const el = $(`[data-r="${k}"]`), v = Math.max(0, Math.round(+el.value.replace(/\D/g, "") || 0)); return { l, v }; });
  const tot = () => { let a = 0, g = 0; q().forEach(({ l, v }) => { const gr = gstOn ? Number(l.gst_rate) || 0 : 0; a += r2(v * l.rate * (1 + gr / 100)); g += r2(v * l.rate * gr / 100); }); return { a: r2(a), g: r2(g) }; };
  const show = () => { const t = tot(); $("#rtot").textContent = t.a ? `Return total ${inr2(t.a)}${t.g ? ` (GST ${inr2(t.g)})` : ""}` : ""; };
  $$("[data-r]").forEach(el => el.oninput = () => { const v = el.value.replace(/\D/g, ""); if (v !== el.value) el.value = v; $("#rm").textContent = ""; show(); });
  $("#rsv").onclick = async () => {
    const m = $("#rm"), bad = t => { m.className = "msg err"; m.textContent = t; }, picks = q().filter(x => x.v > 0);
    if (!picks.length) return bad("Type how many of an item you are sending back");
    const over = picks.find(x => x.v > x.l.left); if (over) return bad(`You can return up to ${over.l.left} of ${over.l.item_name}`);
    if ($("#rmode").value === "ADJUST" && tot().a > owe + .005) return bad(`Only ${inr2(owe)} is still to pay on this bill — pick how the vendor paid you back`);
    $("#rsv").disabled = true;
    const { error } = await db.rpc("save_purchase_return", { p_exp: e.id, p: { on_date: $("#rd").value, mode: $("#rmode").value, ref: $("#rr").value.trim() || null, note: $("#rn").value.trim() || null },
      p_lines: picks.map(x => ({ line_id: x.l.id, qty: x.v })) });
    if (error) { $("#rsv").disabled = false; return bad(niceErr(error)); }
    const it = await db.from("items").select("*").eq("shop", S.id).order("name"); if (!it.error) D.items = it.data || D.items;
    closeDrawer(); toast("Return saved — stock reduced"); BKD.tab = "pret"; books();
  };
  show();
}
async function bkRetCancel(id) {
  const why = prompt("Cancel this purchase return? The items go back into your stock. It stays in your records, left out of every total.\n\nReason (e.g. entered twice):");
  if (why === null) return;
  const { error } = await db.rpc("cancel_purchase_return", { p_id: id, p_reason: why.trim() || "Cancelled" });
  if (error) return toast(niceErr(error)); toast("Return cancelled — stock put back"); books();
}
