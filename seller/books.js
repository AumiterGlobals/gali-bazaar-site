/* Seller panel · Books & expenses — same books as the app (Accounts → Books):
   P&L, trial balance, balance sheet, cash & bank book, udhaar, vendor bills (GST input, pay later), day book, CA downloads. */
const BK = { CASH: "Cash in hand", BANK: "UPI / Bank", DEBT: "Customers (udhaar)", INGST: "GST input credit", CGST: "Output CGST", SGST: "Output SGST",
  VEND: "Vendors (bills to pay)", CAP: "Owner's capital", DRAW: "Owner's drawings", SALES: "Sales", DEL: "Delivery charges", RET: "Sales returns (credit notes)", PLAN: "Gali Bazaar subscription", EARLIER: "Profit of earlier years" };
const bkType = a => [BK.CASH, BK.BANK, BK.DEBT, BK.INGST].includes(a) ? "ASSET" : [BK.CGST, BK.SGST, BK.VEND].includes(a) ? "LIABILITY" : [BK.CAP, BK.DRAW, BK.EARLIER].includes(a) ? "EQUITY" : [BK.SALES, BK.DEL, BK.RET].includes(a) ? "INCOME" : "EXPENSE";
const bkNom = a => ["INCOME", "EXPENSE"].includes(bkType(a));
const dupMsg = e => { const m = niceErr(e); return /no_dup_bill/.test(m) ? "This vendor invoice is already entered" : /no_dup_utr/.test(m) ? "This UTR is already entered" : m; };
const r2 = v => Math.round(v * 100) / 100, f2 = v => Number(v || 0).toFixed(2);
const bkDay = ts => { if (!ts) return ""; const d = new Date(ts); return isNaN(d) ? String(ts).slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
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
  x.exps.forEach(e => {
    const gst = gstOn ? r2(e.gst || 0) : 0, later = e.paid === false || (e.paid_on && e.paid_on !== e.on_date);
    const who = [e.vendor, e.bill_no && "bill " + e.bill_no].filter(Boolean).join(" · ");
    E(e.on_date, later ? "Purchase (credit)" : "Expense", e.bill_no, e.head + (who ? " — " + who : ""), [{ a: e.head, dr: r2(e.amount - gst) }, gst > 0 && { a: BK.INGST, dr: gst }, { a: later ? BK.VEND : bkMoney(e.mode), cr: r2(e.amount) }].filter(Boolean));
    if (e.paid !== false && later) E(e.paid_on || e.on_date, "Payment", e.bill_no, `Paid ${e.vendor || e.head}`, [{ a: BK.VEND, dr: r2(e.amount) }, { a: bkMoney(e.paid_mode || e.mode), cr: r2(e.amount) }]);
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
  const vq = await db.from("shop_vendors").select("*").eq("shop", S.id).order("name");
  BKD.vendors = vq.error ? null : vq.data || [];
  const x = { orders: o.data || [], counter: cs.data || [], cns: cn.data || [], exps: ex.data || [], recs: rc.error ? [] : rc.data || [], claims: cl.data || [] };
  BKD.x = x; const es = BKD.es = bkBuild(x), f = BKD.from, to = BKD.to;
  const pl = bkNet(es, f, to), profit = -Object.entries(pl).filter(([a]) => bkNom(a)).reduce((s, [, v]) => s + v, 0);
  const ud = x.counter.filter(c => c.pay_mode === "CREDIT").map(c => ({ c, due: r2(c.total - x.recs.filter(r => r.sale_id === c.id).reduce((a, r) => a + Number(r.amount), 0) - x.cns.filter(n => n.sale_id === c.id && n.kind !== "REPLACEMENT").reduce((a, n) => a + Number(n.amount), 0)) }));
  BKD.ud = ud;
  const unpaid = x.exps.filter(e => e.paid === false);
  const tabs = [["pl", "Profit & loss"], ["tb", "Trial balance"], ["bs", "Balance sheet"], ["cash", "Cash & bank book"], ["udhaar", "Udhaar"], ["vend", "Expenses & vendor bills"], ["vendors", "Vendors"], ["day", "Day book"]];
  $("#kb").innerHTML = `${rc.error ? `<div class="soon err">Run update-30 (books) in Supabase to save udhaar collections and owner money.</div>` : ""}
    <div class="kpis k4" style="grid-template-columns:repeat(3,1fr)"><div class="kpi"><span>Net profit</span><b style="color:${profit >= 0 ? "#15803D" : "#BE185D"}">${inr2(profit)}</b></div>
      <div class="kpi"><span>Udhaar to collect</span><b>${inr2(ud.reduce((a, u) => a + Math.max(u.due, 0), 0))}</b></div><div class="kpi"><span>Bills to pay</span><b class="pk">${inr2(unpaid.reduce((a, e) => a + Number(e.amount), 0))}</b></div></div>
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
      return ["Vendors · all time", [["Vendor", "GSTIN", "Phone", "Address", "Bills", "Bill total", "Paid", "Still to pay"], ...names.map(n => {
        const v = vs.find(z => z.name === n) || {}, b = ex.filter(e => (e.vendor || "").toLowerCase() === n.toLowerCase()), tot = b.reduce((a, e) => a + Number(e.amount), 0), due = b.filter(e => e.paid === false).reduce((a, e) => a + Number(e.amount), 0);
        return [n, v.gstin || b.find(e => e.vendor_gstin)?.vendor_gstin || "", v.phone || "", v.addr || "", String(b.length), f2(tot), f2(tot - due), f2(due)]; })]];
    }
    case "udhaar": return ["Udhaar (customers) · counter bills on credit", [["Bill", "Date", "Customer", "Mobile", "Bill total", "Collected / returned", "Still due"], ...BKD.ud.map(({ c, due }) => [c.bill_no || "", bkDay(c.created_at), c.cust_name, c.cust_phone || "", f2(c.total), f2(c.total - due), f2(Math.max(due, 0))])]];
    case "vend": return [`Expenses & vendor bills · ${f} to ${t}`, [["Date", "Head", "Vendor", "Vendor GSTIN", "Invoice no", "Taxable", "GST %", "GST (input)", "Total", "Status", "Paid by", "Paid on", "UTR", "Note"],
      ...x.exps.filter(e => e.on_date >= f && e.on_date <= t).map(e => [e.on_date, e.head, e.vendor || "", e.vendor_gstin || "", e.bill_no || "", f2(e.amount - (e.gst || 0)), e.gst_rate ?? "", f2(e.gst || 0), f2(e.amount),
        e.paid === false ? "To pay" : "Paid", e.paid === false ? "" : (e.paid_mode || e.mode), e.paid === false ? "" : (e.paid_on || e.on_date), e.paid_ref || "", e.note || ""])]];
    default: return [`Day book · ${f} to ${t}`, [["Date", "Type", "Ref", "Details", "Account", "Debit", "Credit"], ...es.filter(e => e.date >= f && e.date <= t).flatMap(e => e.lines.map((l, i) => [i ? "" : e.date, i ? "" : e.type, i ? "" : e.ref, i ? "" : e.text, l.a, l.dr ? f2(l.dr) : "", l.cr ? f2(l.cr) : ""]))]];
  }
}
function bkShow() {
  document.querySelectorAll("#kb .btn[onclick^=\"BKD.tab\"]").forEach(b => b.className = "btn " + (b.getAttribute("onclick").includes(`'${BKD.tab}'`) ? "pink" : "ghost"));
  const [title, rows] = bkRows(), num = v => /^-?\d+\.\d\d$/.test(v);
  BKD.cur = [title, rows];
  $("#kbody").innerHTML = `<h3>${esc(title)} <button class="btn ghost" style="float:right;padding:7px 12px" onclick="bkDl()">⇩ Excel</button></h3>
    ${BKD.tab === "bs" ? `<div class="sub">Negative cash means you paid from your own pocket — add it with “Owner money”.</div>` : ""}
    <div style="overflow:auto"><table><thead><tr>${rows[0].map(h => `<th>${esc(h)}</th>`).join("")}${["udhaar", "vend"].includes(BKD.tab) ? "<th></th>" : ""}</tr></thead><tbody>${rows.slice(1).map((r, i) => {
      const bold = /^[A-Z &]+$/.test(r[0]) && /[A-Z]/.test(r[0]) || /^Total/.test(r[0]);
      let act = "";
      if (BKD.tab === "udhaar") { const u = BKD.ud[i]; if (u && u.due > .009) act = `<button class="edit" onclick="bkCollect('${u.c.id}')">Collect</button>`; }
      if (BKD.tab === "vend") { const e = BKD.x.exps.filter(e => e.on_date >= BKD.from && e.on_date <= BKD.to)[i]; act = `${e && e.paid === false ? `<button class="edit" onclick="bkPay('${e.id}')">Mark paid</button>` : ""}${e?.bill_url ? ` <a class="edit" href="${esc(e.bill_url)}" target="_blank">Bill</a>` : ""}${e ? ` <button class="edit" style="color:#BE185D" onclick="bkDel('${e.id}')">Delete</button>` : ""}`; }
      return `<tr>${r.map(v => `<td style="${num(v) ? "text-align:right;" : ""}${bold ? "font-weight:700" : ""}">${num(v) ? inr2(v) : esc(v)}</td>`).join("")}${["udhaar", "vend"].includes(BKD.tab) ? `<td style="white-space:nowrap">${act}</td>` : ""}</tr>`; }).join("")}</tbody></table></div>
    ${rows.length <= 1 ? '<div class="sub">Nothing here for this period.</div>' : ""}`;
}
function bkDl() { const [title, rows] = BKD.cur; csvDownload(`${title.split(" ·")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${BKD.from}_to_${BKD.to}.csv`, [[S.name + " — " + title], ...rows]); }

function bkExpense() {
  const gstOn = !!(S.gst_billing && S.gstin), heads = ["Stock purchase", "Rent", "Electricity", "Salary", "Transport", "Packaging", "Repairs", "Phone / internet", "Subscription / software", "Other"];
  drawer(`<h2><span>Expense / vendor bill</span><button class="x" onclick="closeDrawer()">×</button></h2>
    <label>WHAT FOR?</label><select class="in" id="xh">${heads.map(h => `<option>${h}</option>`).join("")}</select><input class="in" id="xo" placeholder="Expense name (for Other)" style="display:none;margin-top:6px">
    <label>VENDOR / PAID TO <a class="edit" onclick="bkVendor(true)">＋ New vendor</a></label><input class="in" id="xv" list="xvl" placeholder="Pick or type — e.g. Sharma Wholesale">
    <datalist id="xvl">${(BKD.vendors || []).map(v => `<option value="${esc(v.name)}">`).join("")}</datalist>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label>INVOICE NO</label><input class="in" id="xn"></div><div><label>INVOICE DATE</label><input class="in" type="date" id="xd" value="${todayStr()}"></div></div>
    ${gstOn ? `<label>VENDOR GSTIN</label><input class="in" id="xg" maxlength="15">` : ""}
    <label>BILL TOTAL ₹ (incl. GST)</label><input class="in" id="xa" inputmode="decimal">
    ${gstOn ? `<label>GST ON THIS BILL (input credit)</label><select class="in" id="xr">${[0, 5, 12, 18, 28, 40].map(r => `<option value="${r}">${r ? r + "%" : "Nil / 0%"}</option>`).join("")}</select><div class="sub" id="xs"></div>` : ""}
    <label>PAID?</label><select class="in" id="xp"><option value="Cash">Paid now — Cash</option><option value="UPI">Paid now — UPI</option><option value="Bank">Paid now — Bank</option><option value="">Pay later</option></select>
    <div id="xuw" style="display:none;grid-template-columns:1fr 1fr;gap:8px"><div><label>UTR / CHEQUE NO</label><input class="in" id="xu"></div><div><label>UTR (PAYMENT) DATE</label><input class="in" type="date" id="xud" value="${todayStr()}"></div></div>
    <label>NOTE</label><input class="in" id="xx">
    <div class="msg" id="xm"></div><button class="btn pink full" id="xsv" style="margin-top:12px">Save</button>`);
  $("#xh").onchange = () => $("#xo").style.display = $("#xh").value === "Other" ? "block" : "none";
  const calc = () => { if (!gstOn) return 0; const a = +$("#xa").value || 0, r = +$("#xr").value; const g = r2(a * r / (100 + r)); $("#xs").textContent = r && a ? `Taxable ${inr2(a - g)} + GST ${inr2(g)}` : ""; return g; };
  if (gstOn) { $("#xa").oninput = calc; $("#xr").onchange = calc; }
  $("#xp").onchange = () => $("#xuw").style.display = ["UPI", "Bank"].includes($("#xp").value) ? "grid" : "none";
  $("#xv").onchange = () => { const v = (BKD.vendors || []).find(z => z.name.toLowerCase() === $("#xv").value.trim().toLowerCase()); if (v && gstOn && v.gstin && !$("#xg").value) $("#xg").value = v.gstin; };
  $("#xsv").onclick = async () => {
    const a = +$("#xa").value || 0, head = $("#xh").value === "Other" ? $("#xo").value.trim() : $("#xh").value, m = $("#xm");
    if (!a || !head) { m.className = "msg err"; return m.textContent = "Enter what for and the amount"; }
    $("#xsv").disabled = true;
    try {
      const pm = $("#xp").value, later = !pm;
      const row = { shop: S.id, on_date: $("#xd").value, head, amount: a, mode: pm || "Cash", note: $("#xx").value.trim() || null, vendor: $("#xv").value.trim() || null,
        vendor_gstin: gstOn ? ($("#xg").value.trim().toUpperCase() || null) : null, bill_no: $("#xn").value.trim() || null, gst_rate: gstOn ? +$("#xr").value : null, gst: calc(),
        paid: !later, paid_on: later ? null : (["UPI", "Bank"].includes(pm) ? $("#xud").value : $("#xd").value), paid_mode: later ? null : pm,
        ...(["UPI", "Bank"].includes(pm) && $("#xu").value.trim() ? { paid_ref: $("#xu").value.trim() } : {}) };
      const { error } = await db.from("shop_expenses").insert(row); if (error) throw error;
      if (row.vendor && BKD.vendors && !BKD.vendors.some(v => v.name.toLowerCase() === row.vendor.toLowerCase()))
        await db.from("shop_vendors").insert({ shop: S.id, name: row.vendor, gstin: row.vendor_gstin });
      closeDrawer(); toast("Saved"); BKD.tab = "vend"; books();
    } catch (e) { m.className = "msg err"; m.textContent = dupMsg(e); $("#xsv").disabled = false; }
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
async function bkDel(id) { if (!confirm("Delete this expense?")) return; const { error } = await db.from("shop_expenses").delete().eq("id", id); if (error) return toast(niceErr(error)); books(); }

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
