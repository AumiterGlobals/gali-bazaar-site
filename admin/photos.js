// ---------------- Photo review (update-85) ----------------
// Every item photo a seller adds or changes. New · Asked to fix · Fixed again.
// Looks fine · Ask seller to fix (item stays live; seller gets a push + red "Fix photo" card) · Remove photo / Remove item
// (admin_takedown kind photo / item — so the IT-rules takedown log stays complete). common_items is not touched.
const PR = { tab: "NEW", reasons: ["blurry", "wrong product", "copied from internet", "has a watermark", "wrong label"] };
const prTime = iso => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

async function photosPage() {
  const [{ data: rows, error }, { data: c }] = await Promise.all([db.rpc("admin_photo_queue", { p_filter: PR.tab, p_limit: 200 }), db.rpc("admin_photo_counts")]);
  if (error) { $("#main").innerHTML = head("Photo review", "") + `<div class="box"><div class="sub" style="margin:0">${esc(niceErr(error))} — run supabase/update-85-photo-review.sql first.</div></div>`; return; }
  const n = c || {}, tabs = [["NEW", "New", n.new], ["FIX", "Asked to fix", n.fix], ["REFIXED", "Fixed again", n.refixed]];
  window._pr = Object.fromEntries((rows || []).map(r => [r.id, r]));
  const card = r => `<div class="box"><div class="sub" style="margin:0">${esc(r.shop_name)}</div>
      <h3 style="margin:2px 0">${esc(r.name)}${r.unit ? " · " + esc(r.unit) : ""} · ₹${Number(r.price).toLocaleString("en-IN")}</h3>
      <div class="sub" style="margin:0">Photo added / changed ${prTime(r.changed_at)}</div>
      ${r.reason && r.photo_review !== "NEW" ? `<div style="color:#C62828;margin-top:4px">Asked to fix: ${esc(r.reason)}${r.note ? " — " + esc(r.note) : ""}</div>` : ""}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0">${(r.images || []).map((u, i) => `<div style="text-align:center">
        <a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" style="width:120px;height:120px;object-fit:cover;border-radius:12px;border:1px solid #ECE4DC"></a>
        <div><button class="btn ghost" style="color:#C62828" onclick="prRemove('${r.id}', ${i})">Remove photo</button></div></div>`).join("")}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="prOk('${r.id}')">Looks fine</button>
        <button class="btn ghost" onclick="prFix('${r.id}')">Ask seller to fix</button>
        <button class="btn ghost" style="color:#C62828" onclick="prRemove('${r.id}', null)">Remove item</button></div></div>`;
  $("#main").innerHTML = head("Photo review", "Every photo a seller adds or changes. The shared Item list is not affected.") +
    `<div style="display:flex;gap:8px;margin-bottom:12px">${tabs.map(([k, l, x]) => `<button class="btn ${PR.tab === k ? "" : "ghost"}" onclick="PR.tab='${k}';photosPage()">${l}${x ? ` (${x})` : ""}</button>`).join("")}</div>` +
    ((rows || []).map(card).join("") || `<div class="box"><div class="sub" style="margin:0">Nothing here ✓</div></div>`);
}
async function prOk(id) {
  const { error } = await db.rpc("admin_photo_ok", { p_item: id });
  if (error) return alert(niceErr(error)); photosPage();
}
async function prFix(id) {
  const r = window._pr[id];
  const pick = prompt(`Ask to fix "${r.name}". Reason — type the number:\n` + PR.reasons.map((x, i) => `${i + 1}. ${x}`).join("\n"), "1");
  const reason = PR.reasons[Number(pick) - 1]; if (!reason) return;
  const note = prompt("Note for the seller (optional)", "") || null;
  const { error } = await db.rpc("admin_photo_fix", { p_item: id, p_reason: reason, p_note: note });
  if (error) return alert(niceErr(error)); alert("Sent to the seller. The item stays live."); photosPage();
}
async function prRemove(id, i) {
  const r = window._pr[id], photo = i == null ? null : r.images[i];
  const why = prompt(`${photo ? "Remove this photo of" : "Remove the item"} "${r.name}" — reason (goes into the takedown log):`, "");
  if (!why || why.trim().length < 3) return;
  const { error } = await db.rpc("admin_takedown", { p_kind: photo ? "photo" : "item", p_target: id, p_category: "other", p_reason: why.trim(), p_photo: photo });
  if (error) return alert(niceErr(error)); alert("Removed and logged in Reports & takedowns."); photosPage();
}
