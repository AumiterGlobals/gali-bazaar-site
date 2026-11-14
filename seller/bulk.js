/* Seller panel — bulk upload (spec 12, 13d, 18c). The server checks every row (RPC bulk_items):
 * preview first (nothing saved), then save. Photos: a folder named <item>-<slot>.jpg or the "Photo: …" columns. */
let BU = { file: "", rows: [], charts: [], files: [], match: {}, unmatched: [], dup: [], res: null, cleaned: {}, done: null };
const SLOT_WORDS = { front: ["front", "main", "cover", "samne"], label: ["label", "back-label", "backlabel", "manufacturer", "maker", "mfg", "fssai", "mrp", "details"],
  ingredients: ["ingredients", "ingredient", "ingr", "samagri"], back: ["back", "peeche"], tag: ["tag", "size-tag", "brand-tag"], side: ["side"], top: ["top", "upar", "pair"],
  sole: ["sole"], cut: ["cut", "close", "closeup"], bis: ["bis", "isi", "mark"], more: ["more", "extra", "2", "3"] };
const normName = s => String(s || "").toLowerCase().replace(/\.(jpe?g|png|webp|heic)$/i, "").replace(/[\s_.]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
function slotOf(base) {   // "atta-5kg-back-label" → ["atta-5kg", "label"]
  for (const [slot, words] of Object.entries(SLOT_WORDS)) for (const w of words.sort((a, b) => b.length - a.length)) {
    if (base.endsWith("-" + w)) return [base.slice(0, -w.length - 1), slot];
  }
  return [base, null];
}
function bulk() {
  $("#main").innerHTML = head("Bulk upload", "Excel or CSV • up to 500 items • every row is checked before anything is saved",
    `<button class="btn ghost" onclick="go('catalog')">← Catalog</button>`) + `
    <div class="grid2" style="grid-template-columns:1fr 1.35fr">
      <div>
        <div class="box"><h3>1. Download the template made for your shop</h3>
          <div class="sub">Return and courier rules for ${esc((D.cats || []).find(c => c.key === S.type)?.name || "your category")} are filled in for you — dropdowns show only what's allowed. The “How to fill” sheet explains every column (English + हिंदी).</div>
          <button class="btn ghost full" style="margin-top:10px" id="dlt" onclick="dlTemplate()">⇩ Download Excel template</button></div>
        <div class="box"><h3>2. Upload the filled file</h3>
          <div id="fdrop" style="border:1.5px dashed #16A34A;border-radius:16px;padding:22px;text-align:center;cursor:pointer;background:#F7FFF9">${BU.file ? `📊<br><b>${esc(BU.file)}</b><div class="sub">${BU.rows.length} rows${BU.charts.length ? ` · ${BU.charts.length} size chart${BU.charts.length > 1 ? "s" : ""}` : ""} • drop another file to replace</div>` : `📊<br><b>Drop your .xlsx or .csv here</b><div class="sub">or click to browse</div>`}</div></div>
        <div class="box" style="border:2px solid #8B5CF6"><h3>3. Add the photos (optional)</h3>
          <div class="sub">Rename each photo as <b>item name + photo type</b>, e.g. <code>atta-5kg-front.jpg</code>, <code>atta-5kg-label.jpg</code>. फ़ोटो का नाम = सामान का नाम + फ़ोटो का प्रकार. <a href="/help/photo-guide/#names-en" target="_blank" style="color:#7C3AED">File-name rules</a></div>
          <div id="pdrop" style="border:1.5px dashed #C4B5FD;border-radius:16px;padding:20px;text-align:center;cursor:pointer;margin-top:10px;color:#7C3AED;font-weight:600">⇪ Drop the photos folder <div class="sub" style="font-weight:400">or click to choose · max 2,000 photos, 10 MB each</div></div>
          <div id="pm"></div></div>
      </div>
      <div class="box"><h3>Preview <span id="bsum" style="float:right"></span></h3><div id="bprev"></div></div>
    </div>`;
  const fd = $("#fdrop"), pd = $("#pdrop");
  fd.onclick = () => { const i = document.createElement("input"); i.type = "file"; i.accept = ".xlsx,.xls,.csv"; i.onchange = () => readFile(i.files[0]); i.click(); };
  fd.ondragover = e => e.preventDefault(); fd.ondrop = e => { e.preventDefault(); readFile(e.dataTransfer.files[0]); };
  pd.onclick = () => { const i = document.createElement("input"); i.type = "file"; i.multiple = true; i.webkitdirectory = true; i.onchange = () => bulkPhotos([...i.files]); i.click(); };
  pd.ondragover = e => e.preventDefault(); pd.ondrop = async e => { e.preventDefault(); bulkPhotos(await filesFromDrop(e.dataTransfer)); };
  drawMatch(); drawPreview();
}
async function dlTemplate() {
  const b = $("#dlt"); b.disabled = true; b.textContent = "Making your template…";
  try {
    const { data: { session } } = await db.auth.getSession();
    const r = await fetch(`${SB_URL}/functions/v1/template?shop=${S.id}`, { headers: { Authorization: `Bearer ${session.access_token}`, apikey: SB_KEY } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't make the template");
    const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = `gali-bazaar-items-${slug(S.name).slice(0, 30)}.xlsx`; a.click();
  } catch (e) { toast(niceErr(e)); }
  b.disabled = false; b.textContent = "⇩ Download Excel template";
}
const OLD8 = ["Item name", "Selling price", "Pack / unit", "In stock", "MRP", "Group", "Sizes", "Description"];
async function readFile(f) {
  if (!f) return;
  let rows = [], charts = [];
  try {
    if (/\.csv$/i.test(f.name) || !window.XLSX) {
      const aoa = parseCsv((await f.text()).replace(/^﻿/, ""));
      const head = aoa[0] && /item/i.test(String(aoa[0][0] || "")) ? aoa.shift() : OLD8;   // old 8-column files had no header
      rows = aoa.map(r => Object.fromEntries(head.map((h, j) => [h, r[j] ?? ""])));
    } else {
      const wb = XLSX.read(await f.arrayBuffer());
      const sh = wb.Sheets["Items"] || wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(sh, { header: 1, raw: false, defval: "" });
      const head = aoa[0] && /item/i.test(String(aoa[0][0] || "")) ? aoa.shift() : OLD8;
      rows = aoa.map(r => Object.fromEntries(head.map((h, j) => [h, String(r[j] ?? "").trim()])));
      if (wb.Sheets["Size charts"]) {
        const sc = XLSX.utils.sheet_to_json(wb.Sheets["Size charts"], { header: 1, raw: false, defval: "" }), h = sc.shift() || [], by = {};
        sc.forEach(r => { const name = String(r[0] || "").trim(), size = String(r[1] || "").trim(); if (!name || !size || /^optional/i.test(name)) return;
          (by[name] = by[name] || []).push({ size, vals: h.slice(2).map((_, j) => r[j + 2] === "" ? null : +r[j + 2]) }); });
        charts = Object.entries(by).map(([name, list]) => { const used = h.slice(2).map((c, j) => list.some(x => x.vals[j] != null) ? j : -1).filter(j => j >= 0);
          return { name, columns: used.map(j => String(h[j + 2]).replace(/\s*\(cm\)$/i, "")), rows: list.map(x => ({ size: x.size, v: used.map(j => x.vals[j]) })) }; });
      }
    }
  } catch (e) { return toast("Couldn't read this file"); }
  rows = rows.filter(r => Object.values(r).some(v => String(v).trim()));
  if (rows.length > 500) { toast("Up to 500 rows at once — the first 500 are taken"); rows = rows.slice(0, 500); }
  BU = { ...BU, file: f.name, rows, charts, res: null, done: null };
  bulk(); await check();
}
// photo for a row + slot: "Photo: …" column first, else a file named <item>-<slot>
function photoFor(row, slot) {
  const col = Object.keys(row).find(k => k.toLowerCase().replace(/[^a-z]/g, "") === "photo" + slot);
  if (col && row[col]) { const f = BU.files.find(x => x.name.toLowerCase() === String(row[col]).trim().toLowerCase()); if (f) return f; }
  const n = normName(row[Object.keys(row).find(k => /^item/i.test(k))]);
  return BU.match[n + "|" + slot] || null;
}
function rowPayload(row, real) {
  const out = { ...row }, ph = {};
  Object.keys(SLOT_WORDS).forEach(sl => { const f = photoFor(row, sl); if (f) ph[sl] = real ? real[f.name] : "file:" + f.name; });
  if (Object.keys(ph).length) out._photos = ph;
  return out;
}
async function check() {
  $("#bprev").innerHTML = `<div class="sub" style="padding:18px 0">Checking every row…</div>`;
  const { data, error } = await db.rpc("bulk_items", { p_shop: S.id, p_rows: BU.rows.map(r => rowPayload(r)), p_dry: true, p_charts: BU.charts });
  if (error) { $("#bprev").innerHTML = `<div class="msg err">${esc(niceErr(error))}</div>`; return; }
  BU.res = data; drawPreview();
}
function drawPreview() {
  const R = BU.res;
  if (!R) { if (!BU.rows.length) $("#bprev").innerHTML = `<div class="sub" style="padding:18px 0">Upload your filled template — every row is checked on the server before anything is saved.</div>`; $("#bsum").innerHTML = ""; return; }
  const ok = R.filter(r => r.status !== "error"), ch = R.filter(r => r.status === "changed"), bad = R.filter(r => r.status === "error");
  $("#bsum").innerHTML = `<span class="pill ok">${ok.length} will be saved</span> <span class="pill warn">${ch.length} changed</span> <span class="pill bad">${bad.length} not saved</span>`;
  const src = i => BU.rows[i - 1] || {};
  $("#bprev").innerHTML = `<div style="max-height:540px;overflow:auto"><table><thead><tr><th>ROW</th><th>ITEM</th><th>PHOTOS</th><th>RESULT</th></tr></thead><tbody>${R.map(r => {
    const row = src(r.row), slots = Object.keys(SLOT_WORDS).filter(sl => photoFor(row, sl));
    const res = r.status === "error" ? `<span class="pill bad">⛔ ${esc(r.problem)}</span>`
      : `<span class="pill ${r.status === "changed" ? "warn" : "ok"}">${r.action === "update" ? "Updates item" : "New item"}${r.status === "changed" ? " · 🔧 changed" : ""}</span>${r.hidden ? ` <span class="pill bad">Hidden: ${esc(r.hidden)}</span>` : ""}`
        + (r.changes || []).map(c => `<div class="sub" style="margin:2px 0 0;color:#B45309">🔧 ${esc(c)}</div>`).join("");
    return `<tr><td>${r.row + 1}</td><td><b>${esc(r.name || "—")}</b></td><td style="white-space:nowrap">${slots.length ? slots.map(s => `<span class="pill ok" style="padding:2px 6px;margin-right:2px">✓ ${s}</span>`).join("") : `<span class="sub" style="margin:0">—</span>`}</td><td>${res}</td></tr>`; }).join("")}</tbody></table></div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap"><span class="sub" style="flex:1;margin:0">Items missing photos / a size chart are saved hidden and go live once fixed.</span>
      ${bad.length ? `<button class="btn ghost" onclick="dlProblems()">⇩ Download problems (Excel)</button>` : ""}
      <button class="btn pink" id="bup" ${ok.length ? "" : "disabled"} onclick="doBulk()">⇪ Save ${ok.length} item${ok.length === 1 ? "" : "s"}</button></div><div id="bprog"></div><div class="msg" id="bmsg"></div>
    ${BU.done ? `<div class="box" style="margin-top:12px;border:2px solid #16A34A"><b>${BU.done.saved} saved · ${BU.done.changed} changed automatically · ${BU.done.bad} not saved</b>${BU.done.hidden ? `<div class="sub">${BU.done.hidden} saved hidden — open them in Catalog to add what's missing.</div>` : ""}</div>` : ""}`;
}
function dlProblems() {
  const bad = (BU.res || []).filter(r => r.status === "error"); if (!bad.length) return;
  const head = [...Object.keys(BU.rows[0] || {}), "Problem"];
  const aoa = [head, ...bad.map(r => [...head.slice(0, -1).map(h => (BU.rows[r.row - 1] || {})[h] ?? ""), r.problem])];
  const ws = XLSX.utils.aoa_to_sheet(aoa), wb = XLSX.utils.book_new(); ws["!cols"] = head.map(h => ({ wch: h === "Problem" ? 60 : 18 }));
  XLSX.utils.book_append_sheet(wb, ws, "Problems"); XLSX.writeFile(wb, "gali-bazaar-problems.xlsx");
}
async function doBulk() {
  const b = $("#bup"), m = $("#bmsg"), pg = $("#bprog"); b.disabled = true;
  try {
    // clean + upload only the photos of rows that will be saved (background removal runs in the browser)
    const okRows = (BU.res || []).filter(r => r.status !== "error").map(r => BU.rows[r.row - 1]);
    const need = []; okRows.forEach(row => Object.keys(SLOT_WORDS).forEach(sl => { const f = photoFor(row, sl); if (f && !need.some(x => x.f === f)) need.push({ f, sl }); }));
    const urls = {}; let n = 0;
    for (const { f, sl } of need) {
      n++; pg.innerHTML = `<div class="sub">Cleaning photos ${n}/${need.length}…</div><div style="height:6px;background:#EEE7F6;border-radius:9px"><div style="height:6px;width:${Math.round(n / need.length * 100)}%;background:#6A1BB0;border-radius:9px"></div></div>`;
      const food = (KIND().key === "food_cooked") || S.type === "fruitveg" || KIND().key === "food_fresh";
      const r = await PhotoClean.clean(f, sl, food && !["label", "ingredients"].includes(sl));
      const keepOrig = BU.cleaned[f.name] === "orig" && r.original;
      urls[f.name] = await PhotoClean.upload(db, me.id, keepOrig ? r.original : r.big, keepOrig ? r.originalThumb : r.thumb);
    }
    pg.innerHTML = `<div class="sub">Saving items…</div>`;
    const { data, error } = await db.rpc("bulk_items", { p_shop: S.id, p_rows: BU.rows.map(r => rowPayload(r, urls)), p_dry: false, p_charts: BU.charts });
    if (error) throw error;
    BU.res = data; BU.done = { saved: data.filter(r => r.status !== "error").length, changed: data.filter(r => r.status === "changed").length, bad: data.filter(r => r.status === "error").length, hidden: data.filter(r => r.hidden).length };
    toast(`${BU.done.saved} items saved`); await loadAll(); drawPreview(); pg.innerHTML = "";
  } catch (e) { m.className = "msg err"; m.textContent = niceErr(e); b.disabled = false; b.textContent = "Try again"; pg.innerHTML = ""; }
}
function parseCsv(t) {
  const out = []; let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); out.push(row); row = []; cur = ""; } else cur += c; }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out;
}
async function filesFromDrop(dt) {
  const out = [], walk = async en => {
    if (en.isFile) await new Promise(ok => en.file(f => { out.push(f); ok(); }, ok));
    else if (en.isDirectory) { const rd = en.createReader(); let ents; do { ents = await new Promise(ok => rd.readEntries(ok, () => ok([]))); for (const x of ents) await walk(x); } while (ents.length); }
  };
  const items = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  if (items.length) { for (const en of items) await walk(en); } else out.push(...dt.files);
  return out;
}
// match photo files to rows: <item name>-<slot>.jpg (synonyms allowed); unmatched → closest name suggested, one tap assigns
function names() { return BU.rows.map(r => normName(r[Object.keys(r).find(k => /^item/i.test(k))])).filter(Boolean); }
function bulkPhotos(files) {
  files = files.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
  if (files.length > 2000) { toast("Up to 2,000 photos at once — the first 2,000 are taken"); files = files.slice(0, 2000); }
  const big = files.filter(f => f.size > 10 * 1024 * 1024); files = files.filter(f => f.size <= 10 * 1024 * 1024);
  BU.files = [...BU.files.filter(x => !files.some(f => f.name === x.name)), ...files];
  BU.match = {}; BU.unmatched = []; BU.dup = []; const N = new Set(names());
  BU.files.forEach(f => {
    const [base, slot] = slotOf(normName(f.name));
    if (!slot || !N.has(base)) { BU.unmatched.push({ f, base, slot }); return; }
    const k = base + "|" + slot; if (BU.match[k]) BU.dup.push(f); else BU.match[k] = f;
  });
  if (big.length) toast(`${big.length} photo${big.length > 1 ? "s are" : " is"} over 10 MB — skipped`);
  drawMatch(); if (BU.rows.length) check();
}
function closest(base) { let best = null, sc = 0; names().forEach(n => { const a = new Set(base.split("-")), b = n.split("-"), s = b.filter(x => a.has(x)).length / Math.max(b.length, 1); if (s > sc) { sc = s; best = n; } }); return sc >= .34 ? best : null; }
function assignPhoto(i, name, slot) { const u = BU.unmatched[i]; if (!u) return; BU.match[name + "|" + (slot || u.slot || "front")] = u.f; BU.unmatched.splice(i, 1); drawMatch(); if (BU.rows.length) check(); }
function drawMatch() {
  const el = $("#pm"); if (!el) return; const m = Object.entries(BU.match);
  if (!BU.files.length) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="okline" style="margin-top:8px">${m.length} photo${m.length === 1 ? "" : "s"} matched</div>
    <div style="max-height:220px;overflow:auto;font-size:12.5px;margin-top:6px">${m.slice(0, 200).map(([k, f]) => `<div>${esc(f.name)} → <b>${esc(k.split("|")[0])}</b> · ${esc(k.split("|")[1])} ✓</div>`).join("")}
    ${BU.unmatched.map((u, i) => { const c = closest(u.base); return `<div style="color:#BE185D">${esc(u.f.name)} — not matched${u.slot ? "" : " (no photo type in the name)"}${c ? ` · <a href="#" style="color:#7C3AED" onclick="assignPhoto(${i},'${esc(c)}');return false">use for “${esc(c)}”</a>` : " — check the item name"}</div>`; }).join("")}
    ${BU.dup.map(f => `<div class="sub" style="margin:0">${esc(f.name)} — duplicate (first one kept)</div>`).join("")}</div>`;
}
