// ---------------- Customers (update-86) ----------------
const cuDay = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
// Shop reports (fake order / refused COD / abusive / other) → Block or Dismiss · Blocked list → Unblock · Find anyone → Block.
// A blocked customer can browse but can't place an order. Every block / unblock / dismiss goes into the admin log.
const CU = { tab: "reports", q: "" };
async function customersPage() {
  const tabs = [["reports", "Reports"], ["blocked", "Blocked"], ["find", "Find"]];
  let body = "";
  if (CU.tab === "reports") {
    const { data, error } = await db.rpc("admin_customer_reports", { p_status: "OPEN" });
    if (error) body = `<div class="box"><div class="sub" style="margin:0">${esc(niceErr(error))} — run supabase/update-86-customer-block.sql first.</div></div>`;
    else body = (data || []).map(r => `<div class="box"><div style="display:flex;gap:8px;align-items:center"><h3 style="margin:0;flex:1">${esc(r.customer_name || r.customer_email || "Customer")}</h3>
        <span class="pill ${r.reports_total >= 2 ? "bad" : "warn"}">${r.reports_total >= 2 ? r.reports_total + " reports" : esc(r.reason)}</span></div>
      <div class="sub" style="margin:4px 0">${esc([r.customer_email, r.customer_phone].filter(Boolean).join(" · "))}</div>
      <div class="sub" style="margin:0">${esc(r.shop_name)} · #${esc(r.short_id || "")} · ${inr(r.order_total)} · ${esc(r.order_status || "")} · ${cuDay(String(r.created_at).slice(0, 10))}</div>
      <div style="margin:6px 0">${esc(r.reason[0].toUpperCase() + r.reason.slice(1))}${r.note ? " — " + esc(r.note) : ""}</div>
      <div style="display:flex;gap:8px">${r.blocked_at ? `<span class="pill bad">Blocked</span>` : `<button class="btn" style="background:#C62828;color:#fff" onclick="cuBlock('${r.customer}')">Block customer</button>`}
        <button class="btn ghost" onclick="cuDismiss('${r.id}')">Dismiss</button></div></div>`).join("") || `<div class="box"><div class="sub" style="margin:0">No open report ✓</div></div>`;
  } else {
    const { data, error } = await db.rpc("admin_find_customers", { p_q: CU.tab === "find" ? CU.q : "", p_blocked_only: CU.tab === "blocked" });
    body = (CU.tab === "find" ? `<div class="box"><input id="cuq" value="${esc(CU.q)}" placeholder="Name, email or phone" style="width:100%" onkeydown="if(event.key==='Enter'){CU.q=this.value;customersPage()}"></div>` : "") +
      (error ? `<div class="box"><div class="sub" style="margin:0">${esc(niceErr(error))}</div></div>` :
      `<div class="box" style="overflow:auto"><table><tr><th>Customer</th><th>Contact</th><th>Orders</th><th>Reports</th><th>Status</th><th></th></tr>${(data || []).map(c => `<tr>
        <td>${esc(c.name || "—")}</td><td>${esc([c.email, c.phone, c.city].filter(Boolean).join(" · "))}</td><td>${c.orders}</td><td>${c.reports}</td>
        <td>${c.blocked_at ? `<span class="pill bad">Blocked ${cuDay(String(c.blocked_at).slice(0, 10))}</span><div class="sub" style="margin:0">${esc(c.blocked_reason || "")}</div>` : "Active"}</td>
        <td>${c.blocked_at ? `<button class="btn ghost" onclick="cuUnblock('${c.id}')">Unblock</button>` : `<button class="btn ghost" style="color:#C62828" onclick="cuBlock('${c.id}')">Block</button>`}</td></tr>`).join("") || `<tr><td colspan="6" class="sub">Nothing here.</td></tr>`}</table></div>`);
  }
  $("#main").innerHTML = head("Customers", "A blocked customer can browse but can't place orders. Shops can report a customer from any order.") +
    `<div style="display:flex;gap:8px;margin-bottom:12px">${tabs.map(([k, l]) => `<button class="btn ${CU.tab === k ? "" : "ghost"}" onclick="CU.tab='${k}';customersPage()">${l}</button>`).join("")}</div>` + body;
}
async function cuBlock(id) {
  const why = prompt("Block this customer — reason (the customer sees it):", ""); if (!why || why.trim().length < 3) return;
  const { error } = await db.rpc("admin_block_customer", { p_user: id, p_reason: why.trim() }); if (error) return alert(niceErr(error)); customersPage();
}
async function cuUnblock(id) {
  if (!confirm("Unblock this customer? They can order again.")) return;
  const { error } = await db.rpc("admin_unblock_customer", { p_user: id }); if (error) return alert(niceErr(error)); customersPage();
}
async function cuDismiss(id) {
  const note = prompt("Dismiss this report — note (optional):", "");
  if (note === null) return;
  const { error } = await db.rpc("admin_dismiss_customer_report", { p_id: id, p_note: note.trim() || null }); if (error) return alert(niceErr(error)); customersPage();
}
