// Test-only stand-in for supabase-js with sample rows (scripts/visual_audit.py): panels render real-looking pages offline.
(function () {
  const role = (location.pathname.split("/")[1] || "seller").replace("sales", "sales").replace("admin", "admin");
  const ME = { id: "u1", email: "test@example.com" };
  const today = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  const later = new Date(Date.now() + 19800000 + 200 * 864e5).toISOString().slice(0, 10);
  const shop = { id: "s1", owner: "u1", name: "Sharma General Store", type: "grocery", addr: "K-17, Gali No. 3", locality: "Laxmi Nagar", city: "Delhi", state: "Delhi", pin: "110092",
    phone: "9876500000", kyc: "APPROVED", sub_until: later, gst_billing: true, gstin: "07ABCDE1234F1Z5", price_incl_gst: false, gst_under_limit: false, min_order: 0, delivery_fee: 20,
    free_above: 299, upi_id: "sharma@upi", fssai: null, open: true, closed: false, dues_paused: false, featured_until: null, pan_name: "RAKESH SHARMA", pan_number: "ABCPS1234K",
    aadhaar_last4: "1234", created_at: "2026-10-01T10:00:00Z", rating: 4.5, slots: [], areas: [], hours: {} };
  const items = [1, 2, 3, 4].map(i => ({ id: "i" + i, shop: "s1", name: ["Aashirvaad Atta 5 kg", "Amul Butter 500 g", "Tata Salt 1 kg", "Parle-G 800 g"][i - 1], price: [262.5, 299, 28, 95][i - 1],
    mrp: [280, 305, 30, 100][i - 1], unit: ["5 kg", "500 g", "1 kg", "800 g"][i - 1], in_stock: true, gst_rate: [5, 12, 0, 18][i - 1], hsn: "1101", grp: "Atta & Rice", images: [], photos: {}, variants: [] }));
  const orders = [1, 2, 3].map(i => ({ id: "o" + i, short_id: "GB24" + i, shop: "s1", customer: "c" + i, cust_name: ["Neha", "Ravi", "Asha"][i - 1], status: ["NEW", "PACKING", "DELIVERED"][i - 1],
    items: [{ n: "Amul Butter 500 g", p: 299, q: 1, g: 12 }, { n: "Tata Salt 1 kg", p: 28, q: 2, g: 0 }], subtotal: 355, fee: 20, total: 375, created_at: new Date().toISOString(),
    bill_no: i === 3 ? "GB/26-27/0039" : null, delivered_at: new Date().toISOString(), slot_date: today, slot_label: "5–7 pm", addr: "B-12, Gali 4, Laxmi Nagar", phone: "98765xxxxx", returned: [], log: [] }));
  const T = {
    profiles: [{ id: "u1", role: role === "admin" ? "admin" : role === "sales" ? "sales" : "seller", name: "Rakesh Sharma", email: ME.email, phone: "9876500000" }],
    shops: [shop], items, orders,
    settings: [{ id: 1, plan_price: 99, plan_discounts: { 1: 0, 3: 10, 6: 15, 12: 20 }, feat_week_price: 199, feat_month_price: 599, pay_due_day: 5, upi_id: "galibazaar@upi", biz_name: "Gali Bazaar",
      tax_report_emails: [], terms_version: "2026-11-17.1", min_app_version: 278, gst_enabled: true, gst_rate: 18 }],
    sales_people: [{ id: "sp1", profile: "u1", active: true, login_blocked: false, username: "vikas", commission_accepted_at: "2026-10-01T00:00:00Z", name: "Vikas Kumar", commission_pct: 20, code: "GB-SP0001", kyc: "APPROVED", pan: "ABCPV1234K", phone: "9876511111", email: ME.email, bank_hold: false }],
    commissions: [{ id: "c1", sales: "sp1", shop: "s1", amount: 16.78, kind: "COMMISSION", status: "DUE", created_at: new Date().toISOString() }],
    payouts: [{ id: "p1", sales: "sp1", pdate: today, gross: 167.8, tds: 4, net: 163.8, utr: "UTR123456", advice_no: "GB/PO/1", tds_rate: 2 }],
    pay_claims: [{ id: "pc1", shop: "s1", utr: "4325123456", amount: 28, months: 1, paid_on: today, purpose: "DUES", status: "PENDING", created_at: new Date().toISOString() },
                 { id: "pc2", shop: "s1", utr: "4325123457", amount: 99, months: 1, paid_on: today, purpose: "PLAN", status: "APPROVED", inv_no: "GB/26-27/12", created_at: new Date().toISOString() }],
    terms_acceptances: [], categories: [], festivals: [],
    counter_sales: [{ id: "cs1", shop: "s1", bill_no: "GB/26-27/0041", cust_name: "Ramesh", cust_phone: "9876543210", items: [{ n: "Aashirvaad Atta 5 kg", p: 262.5, q: 2, g: 5 }], fee: 0, total: 525, pay_mode: "CREDIT", created_at: new Date().toISOString() },
                    { id: "cs2", shop: "s1", bill_no: "GB/26-27/0042", cust_name: "Sunita", cust_phone: "", items: [{ n: "Parle-G 800 g", p: 95, q: 1, g: 18 }], fee: 0, total: 95, pay_mode: "CREDIT", reminded_on: today, created_at: new Date().toISOString() }],
    shop_expenses: [{ id: "e1", shop: "s1", on_date: today, head: "Stock purchase", amount: 1102.5, gst: 52.5, gst_rate: 5, mode: "Cash", vendor: "Sharma Wholesale", bill_no: "SW-118", paid: true, paid_on: today, paid_mode: "Cash" }],
    purchase_lines: [{ id: "pl1", expense_id: "e1", shop: "s1", item_id: "i1", item_name: "Aashirvaad Atta 5 kg", variant: null, qty: 5, rate: 210, gst_rate: 5 }],
    item_costs: [{ item_id: "i1", cost_price: 210 }]
  };
  const R = {
    my_billing: { balance: -28, plan_due: 0, pay_now: 28, tds_this_month: 28, due_by: today, paused: false, sub_until: later, quotes: [], invoices: [], payments: [], statement: [] },
    pay_info: { name: shop.name, city: "Delhi", sub_until: later, kyc: "APPROVED", upi: "galibazaar@upi", biz: "Gali Bazaar", price: 99, discounts: { 1: 0, 3: 10, 6: 15, 12: 20 },
      feat_week: 199, feat_month: 599, balance: -28, paused: false, dues: 28, plan_covers_month: true, due_day: 5,
      quotes: [1, 3, 6, 12].map(m => ({ months: m, from: today, to: later, plan: 99 * m, pay: 99 * m + 28 })), fix: [], pending: false },
    my_tds: { due: 167.8, fy_credited: 167.8, tds: 4, net: 163.8, rate: 2, rate_pan: 2, rate_no_pan: 20, first_rupee: true, has_pan: true },
    my_staff_role: null
  };
  const pick = t => JSON.parse(JSON.stringify(T[t] || []));
  function chain(t) {
    const res = { data: pick(t), error: null, count: (T[t] || []).length };
    const p = new Proxy(function () {}, {
      get(_, k) {
        if (k === "then") return (a, b) => Promise.resolve(res).then(a, b);
        if (k === "single" || k === "maybeSingle") return () => Promise.resolve({ data: pick(t)[0] || null, error: null });
        return () => p;
      },
      apply() { return p; }
    });
    return p;
  }
  const asyncNoop = v => new Proxy({}, { get: (_, k) => k === "then" ? undefined : (..._a) => Promise.resolve(v(k)) });
  const auth = new Proxy({}, { get: (_, k) => {
    if (k === "getSession") return async () => ({ data: { session: { user: ME, access_token: "x" } }, error: null });
    if (k === "getUser") return async () => ({ data: { user: ME }, error: null });
    if (k === "onAuthStateChange") return () => ({ data: { subscription: { unsubscribe() {} } } });
    return async () => ({ data: {}, error: null });
  } });
  const channel = () => { const c = new Proxy({}, { get: () => () => c }); return c; };
  window.supabase = { createClient: () => ({
    auth, from: chain, rpc: async (n, a) => { (window.__rpc = window.__rpc || []).push([n, a]); return { data: n in R ? JSON.parse(JSON.stringify(R[n])) : n === "udhaar_reminded" ? today : [], error: null }; }, channel, removeChannel() {}, removeAllChannels() {},
    storage: { from: () => asyncNoop(() => ({ data: null, error: null })) },
    functions: { invoke: async () => ({ data: null, error: null }) }
  }) };
})();
