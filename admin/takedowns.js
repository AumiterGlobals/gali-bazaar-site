// ---------------- Reports & takedowns (update-69 · IT Rules 2021 as amended in 2026, G.S.R. 120(E)) ----------------
// Deadlines: nude / sexual / morphed image of a person 2 h · court or government order 3 h · other unlawful content 36 h ·
// anything else 7 days. "Take down" hides it at once, keeps the removed content as evidence and logs both times.
const TD = { win: { intimate: "2 h", order: "3 h", unlawful: "36 h", other: "7 days" }, kind: { item: "Item", photo: "Photo", rating: "Rating text", chat: "Chat message" } };
const tdLeft = iso => { const m = Math.round((Date.parse(iso) - Date.now()) / 60000);
  return m < 0 ? `${Math.floor(-m / 60)}h ${-m % 60}m late` : m < 120 ? `${m} min left` : m < 2880 ? `${Math.round(m / 60)} h left` : `${Math.round(m / 1440)} days left`; };
const tdTime = iso => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

// red strip on every admin page while a 2 h / 3 h case is open
async function tdBanner() {
  const { data } = await db.from("takedowns").select("id,category,due_at").eq("status", "OPEN").in("category", ["intimate", "order"]).order("due_at");
  let b = document.getElementById("tdbar");
  if (!data || !data.length) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("div"); b.id = "tdbar"; document.body.prepend(b); }
  b.style.cssText = "position:sticky;top:0;z-index:50;background:#D7263D;color:#fff;padding:10px 16px;font-weight:700;cursor:pointer";
  b.onclick = () => go("takedowns");
  b.innerHTML = `🚨 ${data.length} takedown${data.length === 1 ? "" : "s"} due · ${tdLeft(data[0].due_at)} — IT Rules: ${data[0].category === "intimate" ? "nude / morphed image, 2 hours" : "court / government order, 3 hours"}. Click to handle.`;
}
setInterval(() => { tdBanner().catch(() => {}); }, 60000);

async function takedownsPage() {
  const list = await q("takedowns", "*", x => x.order("reported_at", { ascending: false }).limit(200));
  const open = list.filter(t => t.status === "OPEN").sort((a, b) => a.due_at.localeCompare(b.due_at)), past = list.filter(t => t.status !== "OPEN").slice(0, 30);
  const card = t => { const urgent = t.category === "intimate" || t.category === "order";
    return `<div class="box" style="${urgent ? "border:2px solid #D7263D;background:#FFF2F4" : ""}"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <h3 style="margin:0;flex:1">${TD.kind[t.kind] || t.kind}</h3><span class="pill ${urgent ? "bad" : "warn"}">${TD.win[t.category]} · ${tdLeft(t.due_at)}</span></div>
      <div style="margin:6px 0">${esc(t.reason || "No reason given")}</div>
      <div class="sub" style="margin:0">Reported ${tdTime(t.reported_at)} · ${t.reported_by ? "by a user" : "logged by admin"} · ID ${esc(t.target)}${t.photo_url ? ` · <a href="${esc(t.photo_url)}" target="_blank" rel="noopener">photo</a>` : ""}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" style="background:#D7263D;color:#fff" onclick="tdDown('${t.id}')">Take down now</button>
        <button class="btn ghost" onclick="tdKeep('${t.id}')">Nothing to remove</button></div></div>`; };
  const done = t => `<tr><td>${TD.kind[t.kind] || t.kind}</td><td>${t.status === "REMOVED" ? "Removed" : "Kept"}</td><td>${TD.win[t.category]}</td><td>${esc(t.note || t.reason)}</td>
      <td>${tdTime(t.reported_at)}</td><td>${tdTime(t.removed_at)}</td><td>${t.status === "REMOVED" && t.kind === "item" ? `<button class="btn ghost" onclick="tdRestore('${t.target}')">Restore</button>` : ""}</td></tr>`;
  window._td = Object.fromEntries(list.map(t => [t.id, t]));
  $("#main").innerHTML = head("Reports & takedowns", "IT Rules 2021 (as amended in 2026): nude / morphed image 2 h · court or government order 3 h · other unlawful 36 h · anything else 7 days.",
    `<button class="btn pink" onclick="tdLog()">＋ Log a report / order</button>`) +
    (open.map(card).join("") || `<div class="box"><div class="sub" style="margin:0">No open report ✓</div></div>`) +
    (past.length ? `<div class="box"><h3>Handled</h3><div style="overflow:auto"><table><tr><th>What</th><th>Result</th><th>Window</th><th>Note</th><th>Reported</th><th>Removed</th><th></th></tr>${past.map(done).join("")}</table></div></div>` : "");
  tdBanner();
}

async function tdDown(id) {
  const t = window._td[id]; const why = prompt("Reason (kept in the log):", t.reason || ""); if (why == null) return;
  if (why.trim().length < 3) return alert("Write the reason.");
  const { error } = await db.rpc("admin_takedown", { p_kind: t.kind, p_target: t.target, p_category: t.category, p_reason: why.trim(), p_photo: t.photo_url, p_report: id });
  if (error) return alert(error.message); takedownsPage();
}
async function tdKeep(id) {
  const why = prompt("Why nothing was removed (kept in the log):", ""); if (why == null) return;
  const { error } = await db.rpc("admin_takedown_reject", { p_id: id, p_note: why.trim() }); if (error) return alert(error.message); takedownsPage();
}
async function tdRestore(item) {
  if (!confirm("Bring this item back? (only after a wrong takedown)")) return;
  const { error } = await db.rpc("admin_restore_item", { p_item: item }); if (error) return alert(error.message); takedownsPage();
}
async function tdLog() {
  const kind = (prompt("What? item / photo / rating / chat", "item") || "").trim().toLowerCase(); if (!TD.kind[kind]) return;
  const idText = prompt(kind === "rating" ? "Order ID or link" : kind === "chat" ? "Message ID" : "Item ID or link", ""); if (!idText) return;
  const id = (idText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0]; if (!id) return alert("Paste the ID (or a link that has it).");
  const photo = kind === "photo" ? prompt("Photo link", "") : null;
  const cat = (prompt("Type: intimate (2 h) / order (3 h) / unlawful (36 h) / other", "order") || "").trim().toLowerCase(); if (!TD.win[cat]) return;
  const why = prompt("Reason / order number", ""); if (!why || why.trim().length < 3) return;
  const ago = +(prompt("It reached us how many minutes ago?", "0") || 0) || 0;
  const { error } = await db.rpc("admin_takedown", { p_kind: kind, p_target: id, p_category: cat, p_reason: why.trim(), p_photo: photo || null,
    p_reported_at: new Date(Date.now() - ago * 60000).toISOString() });
  if (error) return alert(error.message); takedownsPage();
}
