// Gali Bazaar — financial years for the seller books and the admin books (website).
// shop = shop id for a seller's books, null for Gali Bazaar's own (admin) books.
// Needs a global `db` (Supabase client) and a #panel drawer on the page.
const FY = { list: [], shop: null, onChange: null };
const fyEsc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fyDay = d => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fyErr = e => /function|schema cache|fin_years/.test(e?.message || "") ? "Run update-44-financial-years.sql in Supabase first." : String(e?.message || e).replace(/^.*exception:\s*/i, "");

async function fyLoad(shop) {
  const { data, error } = await db.rpc("fy_list", { p_shop: shop });
  FY.list = error ? [] : data || [];
  return FY.list;
}
/** <select> to jump the report dates to a financial year. onPick(from, to). */
function fySelect(from, to, onPickName) {
  if (!FY.list.length) return "";
  const cur = FY.list.find(f => f.start_date === from && f.end_date === to);
  return `<select class="in" style="width:auto" onchange="if(this.value){const f=FY.list.find(x=>x.id===this.value);${onPickName}(f.start_date,f.end_date)}">
    <option value="">${cur ? "" : "Financial year…"}</option>${FY.list.map(f => `<option value="${f.id}" ${cur && cur.id === f.id ? "selected" : ""}>${fyEsc(f.label)}${f.closed ? " 🔒" : ""}</option>`).join("")}</select>`;
}
function fyPanel(html) {
  const el = document.getElementById("panel"); el.innerHTML = html; el.classList.add("open"); document.body.classList.add("po");
  if (typeof drawerOpen !== "undefined") drawerOpen = true;
}
function fyClosePanel() {
  const el = document.getElementById("panel"); el.classList.remove("open"); document.body.classList.remove("po");
  if (typeof drawerOpen !== "undefined") drawerOpen = false;
  FY.onChange && FY.onChange();
}
/** The "Financial years" drawer: add, edit, close / reopen, delete. */
async function fyManage(shop, onChange) {
  FY.shop = shop; FY.onChange = onChange;
  await fyLoad(shop);
  const now = istD(Date.now()), y = now.getUTCMonth() < 3 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const has = s => FY.list.some(f => f.start_date === s);
  const sugg = !has(`${y}-04-01`) ? y : !has(`${y + 1}-04-01`) ? y + 1 : null;
  fyPanel(`<h2><span>Financial years</span><button class="x" onclick="fyClosePanel()" aria-label="Close">×</button></h2>
    <div class="sub">Close a year when its books are final — nothing dated in a closed year can be added, changed or deleted. You can reopen it any time.</div>
    <div class="msg" id="fyMsg"></div>
    ${FY.list.length ? FY.list.map(f => `<div style="border:1px solid #EEE7F6;border-radius:14px;padding:12px 14px;margin:10px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${fyEsc(f.label)}</b>
        <span class="pill ${f.closed ? "grey" : "ok"}">${f.closed ? "🔒 Closed" : "Open"}</span></div>
      <div class="sub" style="margin:4px 0 8px">${fyDay(f.start_date)} – ${fyDay(f.end_date)}${f.closed && f.closed_at ? ` · closed ${new Date(f.closed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}${f.has_entries ? "" : " · no entries"}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${f.closed ? `<button class="mini" onclick="fyLock('${f.id}',false)">Reopen</button>`
          : `<button class="mini" onclick="fyForm('${f.id}')">Edit</button><button class="mini dk" onclick="fyLock('${f.id}',true)">Close year</button>
             ${f.has_entries ? "" : `<button class="mini" style="color:#BE185D" onclick="fyDel('${f.id}')">Delete</button>`}`}</div></div>`).join("")
      : `<div class="sub" style="margin:14px 0">No financial years yet.</div>`}
    <button class="btn pink full" style="margin-top:8px" onclick="fyForm(null${sugg ? `,${sugg}` : ""})">＋ Add financial year</button>`);
}
function fyForm(id, y) {
  const f = id ? FY.list.find(x => x.id === id) : null;
  const yr = y || (istD(Date.now()).getUTCMonth() < 3 ? istD(Date.now()).getUTCFullYear() - 1 : istD(Date.now()).getUTCFullYear());
  const s = f ? f.start_date : `${yr}-04-01`, e = f ? f.end_date : `${yr + 1}-03-31`;
  fyPanel(`<h2><span>${f ? "Edit financial year" : "Add financial year"}</span><button class="x" onclick="fyManage(FY.shop, FY.onChange)" aria-label="Back">×</button></h2>
    <label>NAME</label><input class="in" id="fyL" value="${fyEsc(f ? f.label : `FY ${yr}-${String((yr + 1) % 100).padStart(2, "0")}`)}">
    <label>STARTS ON</label><input class="in" type="date" id="fyS" value="${s}">
    <label>ENDS ON</label><input class="in" type="date" id="fyE" value="${e}">
    <div class="sub" style="font-size:11.5px">India: 1 April to 31 March. Years can't overlap.</div>
    <div class="msg" id="fyMsg"></div>
    <button class="btn pink full" onclick="fySave(${f ? `'${f.id}'` : "null"})">${f ? "Save" : "Add year"}</button>`);
}
async function fySave(id) {
  const m = document.getElementById("fyMsg");
  const { error } = await db.rpc("fy_save", { p_shop: FY.shop, p_id: id, p_label: document.getElementById("fyL").value.trim(),
    p_start: document.getElementById("fyS").value, p_end: document.getElementById("fyE").value });
  if (error) { m.className = "msg err"; m.textContent = fyErr(error); return; }
  fyManage(FY.shop, FY.onChange);
}
async function fyLock(id, close) {
  const f = FY.list.find(x => x.id === id);
  if (close && !confirm(`Close ${f?.label}? Nothing dated ${fyDay(f.start_date)} – ${fyDay(f.end_date)} can be added, changed or deleted until you reopen it.`)) return;
  const { error } = await db.rpc("fy_set_closed", { p_id: id, p_closed: close });
  if (error) return alert(fyErr(error));
  fyManage(FY.shop, FY.onChange);
}
async function fyDel(id) {
  const f = FY.list.find(x => x.id === id);
  if (!confirm(`Delete ${f?.label}?`)) return;
  const { error } = await db.rpc("fy_delete", { p_id: id });
  if (error) return alert(fyErr(error));
  fyManage(FY.shop, FY.onChange);
}
