// ---------------- Shop delete requests (update-64) ----------------
// A seller can't delete a shop alone: the request comes here, the checks run live, and the admin deletes it only when
// open orders, complaints, the return / exchange window and refunds are clear. Store credit and warranty items (!)
// are confirmed by hand after talking to the seller. The server runs the checks again before it deletes anything.
const SD = { show: "open", warn: {} };
const sdDay = iso => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

function sdChecklist(c, maxRows = 6) {
  if (!c) return `<div class="sub">Checking…</div>`;
  return (c.checks || []).map(k => {
    const [mark, col, bg] = k.level === "ok" ? ["✓", "#15803D", "#E6F8EE"] : k.level === "warn" ? ["!", "#B45309", "#FFF1DC"] : ["✕", "#BE123C", "#FFE4EC"];
    const rows = (k.rows || []).slice(0, maxRows).map(r => `<div style="font-size:12px;color:#8E84A8">${esc(r.ref)} · ${esc(r.text)}</div>`).join("") +
      ((k.rows || []).length > maxRows ? `<div style="font-size:12px;color:#8E84A8">+${k.rows.length - maxRows} more</div>` : "");
    return `<div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid #F5F1FA">
      <span style="flex:none;width:22px;height:22px;border-radius:50%;background:${bg};color:${col};font-weight:800;font-size:12px;display:grid;place-items:center">${mark}</span>
      <div style="flex:1"><b style="font-size:13.5px">${esc(k.title)}</b><div style="font-size:12.5px;color:${k.level === "ok" ? "#8E84A8" : col}">${esc(k.detail)}</div>${rows}</div></div>`;
  }).join("");
}

async function deletesPage() {
  const all = await q("shop_delete_requests", "*", x => x.order("created_at", { ascending: false }).limit(200));
  const open = all.filter(r => r.status === "PENDING"), past = all.filter(r => r.status !== "PENDING");
  // live checks for the open ones
  const live = {};
  await Promise.all(open.map(async r => { const { data } = await db.rpc("shop_delete_check", { p_shop: r.shop }); live[r.id] = data || r.checks; }));
  const tag = r => {
    const c = live[r.id] || r.checks;
    if (r.status === "PENDING") return c && c.ok ? `<span class="pill ok">Ready to delete</span>` : `<span class="pill warn">Waiting on checks</span>`;
    return { DONE: `<span class="pill">Deleted</span>`, REJECTED: `<span class="pill bad">Rejected</span>`, CANCELLED: `<span class="pill">Cancelled by seller</span>`, APPROVED: `<span class="pill ok">Deleting…</span>` }[r.status] || esc(r.status);
  };
  const card = r => {
    const c = live[r.id] || r.checks, isOpen = r.status === "PENDING";
    const canDel = isOpen && c && c.ok && (!c.warn || SD.warn[r.id]);
    return `<div class="box"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h3 style="margin:0;flex:1">${esc(r.shop_name || "Shop")}</h3>${tag(r)}</div>
      <div class="sub" style="margin:4px 0 6px">${r.by_admin ? "Started by admin" : "Asked by seller"} · ${sdDay(r.created_at)}${r.excel_saved ? " · Excel saved" : ""}${r.decided_at ? " · decided " + sdDay(r.decided_at) : ""}</div>
      ${r.reason ? `<div style="font-size:13.5px;margin-bottom:6px">“${esc(r.reason)}”</div>` : ""}
      ${r.admin_note ? `<div class="sub" style="margin:0 0 6px">Note: ${esc(r.admin_note)}</div>` : ""}
      ${sdChecklist(c, isOpen ? 6 : 2)}
      ${isOpen ? `${c && c.warn ? `<label style="display:flex;gap:8px;align-items:flex-start;margin:10px 0 0;font-size:13px;cursor:pointer"><input type="checkbox" ${SD.warn[r.id] ? "checked" : ""} onchange="SD.warn['${r.id}']=this.checked;deletesPage()" style="margin-top:3px">
          I checked the ! items with the seller (customers paid back / told who honours the warranty).</label>` : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn ${canDel ? "pink" : "ghost"}" ${canDel ? "" : "disabled"} style="${canDel ? "background:#D7263D" : ""}" onclick="sdApprove('${r.id}')">Delete shop</button>
          <button class="btn ghost" onclick="sdReject('${r.id}')">Reject</button>
          <button class="btn ghost" onclick="deletesPage()">Re-check</button></div>
        ${c && !c.ok ? `<div class="sub" style="margin:8px 0 0">Delete unlocks when every ✕ is clear.</div>` : ""}` : ""}</div>`;
  };
  $("#main").innerHTML = head("Shop delete requests", "A shop is deleted only from here — after the checks. Customers keep their bills; the seller gets an email.",
    `<button class="btn ${SD.show === "open" ? "pink" : "ghost"}" onclick="SD.show='open';deletesPage()">Waiting (${open.length})</button>
     <button class="btn ${SD.show === "past" ? "pink" : "ghost"}" onclick="SD.show='past';deletesPage()">Earlier (${past.length})</button>`) +
    (SD.show === "open" ? (open.map(card).join("") || `<div class="box"><div class="sub" style="margin:0">No delete request waiting ✓</div></div>`)
                        : (past.slice(0, 50).map(card).join("") || `<div class="box"><div class="sub" style="margin:0">Nothing yet.</div></div>`));
}

async function sdApprove(id) {
  if (!confirm("Delete this shop now?\n\nThe server runs the checks again, then deletes the shop, its books and its staff access. Customers keep their bills. The seller gets an email. This can't be undone.")) return;
  const { data, error } = await db.functions.invoke("push", { body: { action: "approve_shop_delete", request_id: id, confirm_warn: !!SD.warn[id] } });
  let msg = null;
  if (error) { try { msg = (await error.context.json()).error; } catch (e) { msg = error.message; } }
  else if (!data?.ok) msg = data?.error || "Couldn't delete the shop";
  if (msg) return alert(msg);
  alert("Shop deleted · the seller has been emailed.");
  deletesPage();
}

async function sdReject(id) {
  const note = prompt("Reason for the seller (they see it in the app and by email; the shop opens for orders again):", "");
  if (note == null) return;
  if (note.trim().length < 5) return alert("Write a short reason for the seller.");
  const { error } = await db.rpc("reject_shop_delete", { p_id: id, p_note: note.trim() });
  if (error) return alert(error.message);
  deletesPage();
}
