/* Seller panel — size charts (spec 18): make once, link to many items. Numbers stored in cm. */
const CHART_TPL = {
  men_tops: { label: "Men — tops (T-shirt / shirt / kurta)", cols: ["Chest", "Length", "Shoulder"], rows: [["S", 96, 69, 42], ["M", 101, 71, 44], ["L", 106, 73, 46], ["XL", 111, 75, 48], ["XXL", 116, 77, 50], ["3XL", 121, 79, 52]] },
  women_tops: { label: "Women — tops / kurti", cols: ["Bust", "Waist", "Length"], rows: [["XS", 81, 66, 99], ["S", 86, 71, 100], ["M", 91, 76, 101], ["L", 96, 81, 102], ["XL", 101, 86, 103], ["XXL", 106, 91, 104]] },
  bottoms: { label: "Bottoms (jeans / trousers / pyjama)", cols: ["Waist", "Hip", "Length", "Inseam"], rows: [["28", 71, 91, 100, 76], ["30", 76, 96, 101, 77], ["32", 81, 101, 102, 78], ["34", 86, 106, 103, 79], ["36", 91, 111, 104, 80], ["38", 96, 116, 105, 81]] },
  kids: { label: "Kids", cols: ["Chest", "Length", "Height"], rows: [["2-3 Y", 54, 38, 92], ["3-4 Y", 56, 41, 104], ["4-5 Y", 58, 44, 110], ["5-6 Y", 61, 47, 116], ["7-8 Y", 66, 52, 128], ["9-10 Y", 71, 57, 140]] },
  footwear: { label: "Footwear", cols: ["EU", "US", "Foot length"], rows: [["UK 5", 38, 6, 23.5], ["UK 6", 39, 7, 24.4], ["UK 7", 41, 8, 25.2], ["UK 8", 42, 9, 26], ["UK 9", 43, 10, 26.8], ["UK 10", 44, 11, 27.7], ["UK 11", 45, 12, 28.5]] },
  custom: { label: "Custom — my own columns", cols: ["Chest", "Length"], rows: [["M", "", ""]] },
};
const isMeasure = c => !["EU", "US", "UK", "UK/INDIA"].includes(String(c).trim().toUpperCase());
const r1 = x => { const v = Math.round(x * 10) / 10; return String(v); };
let CH = null;
function charts() {
  const L = (D.charts || []).filter(c => c.shop);   // own charts; standard ones are read-only
  $("#main").innerHTML = head("Size charts", "You don't have to make a chart: Gali Bazaar standard charts (men tops, women tops / kurti, bottoms, kids, footwear) are linked to your items by themselves. Make your own only if your brand's sizes are different.",
    `<button class="btn ghost" onclick="go('catalog')">← Catalog</button><button class="btn pink" onclick="editChart(null)">＋ New chart</button>`) +
    `<div class="box">${L.length ? `<table><thead><tr><th>NAME</th><th>SIZES</th><th class="hm">COLUMNS</th><th class="hm">ITEMS</th><th></th></tr></thead><tbody>${L.map(c => `<tr>
      <td><b>📏 ${esc(c.name)}</b></td><td>${esc((c.rows || []).map(r => r.size).join(" · "))}</td><td class="hm">${esc((c.columns || []).join(", "))}</td>
      <td class="hm">${D.items.filter(i => i.size_chart === c.id).length}</td><td><button class="edit" onclick="editChart('${c.id}')">Edit</button></td></tr>`).join("")}</tbody></table>`
      : `<div class="sub" style="padding:18px 0">No charts of your own — standard charts are used. Tap “＋ New chart” only for brand sizes.</div>`}</div>`;
}
function editChart(id) {
  const c = id ? (D.charts || []).find(x => x.id === id) : null, t = c ? c.template : (S.type === "footwear" ? "footwear" : "men_tops");
  CH = { id, tpl: t, inch: false, name: c?.name || "", fit: c?.fit_note || "", cols: c ? [...c.columns] : [...CHART_TPL[t].cols],
    rows: c ? c.rows.map(r => [r.size, ...c.columns.map((_, j) => r.v?.[j] ?? "")]) : CHART_TPL[t].rows.map(r => [...r]) };
  drawChart();
}
function chartKeep() { if (!$("#chn")) return; CH.name = $("#chn").value; CH.fit = $("#chf").value;
  $$("#cht [data-r]").forEach(el => { const r = +el.dataset.r, c = +el.dataset.c; if (r < 0) CH.cols[c - 1] = el.value; else CH.rows[r][c] = el.value; }); }
function chartTpl(k) { CH.tpl = k; CH.inch = false; CH.cols = [...CHART_TPL[k].cols]; CH.rows = CHART_TPL[k].rows.map(r => [...r]); drawChart(); }
function chartUnit(inch) { chartKeep(); if (inch === CH.inch) return;
  CH.rows = CH.rows.map(r => r.map((v, j) => j === 0 || v === "" || isNaN(+v) || !isMeasure(CH.cols[j - 1]) ? v : r1(inch ? +v / 2.54 : +v * 2.54))); CH.inch = inch; drawChart(); }
function drawChart() {
  const c = CH, cell = "width:72px;padding:7px 6px;border:1px solid #EEE7F6;border-radius:8px;text-align:center;font:inherit;background:#F7F5FB";
  drawer(`<h2><span>${c.id ? "Edit size chart" : "New size chart"}</span><button class="x" onclick="closeDrawer()">×</button></h2>
    ${c.id ? "" : `<label>START FROM A TEMPLATE</label><div class="fchips">${Object.entries(CHART_TPL).map(([k, t]) => `<button class="fchip ${k === c.tpl ? "on" : ""}" onclick="chartKeep();chartTpl('${k}')">${esc(t.label.split(" (")[0])}</button>`).join("")}</div>`}
    <label>CHART NAME</label><input class="in" id="chn" maxlength="60" value="${esc(c.name)}" placeholder="e.g. Men T-shirts — my brand">
    <div style="display:flex;align-items:center;margin-top:10px"><span class="sub" style="margin:0;flex:1">Numbers in</span>
      <div class="fchips" style="background:#F6F2FB;border-radius:50px;padding:3px"><button class="fchip ${!c.inch ? "on" : ""}" onclick="chartUnit(false)">cm</button><button class="fchip ${c.inch ? "on" : ""}" onclick="chartUnit(true)">inch</button></div></div>
    <div id="cht" style="overflow-x:auto;margin-top:8px"><table style="border-collapse:separate;border-spacing:3px"><tr><th>Size</th>${c.cols.map((h, j) => `<th>${c.tpl === "custom" ? `<input data-r="-1" data-c="${j + 1}" value="${esc(h)}" style="${cell};font-weight:700">` : esc(h)}</th>`).join("")}<th></th></tr>
      ${c.rows.map((r, i) => `<tr>${r.map((v, j) => `<td><input data-r="${i}" data-c="${j}" value="${esc(v)}" style="${cell}${j === 0 ? ";font-weight:700" : ""}" ${j ? 'inputmode="decimal"' : ""}></td>`).join("")}<td><button class="x" style="position:static" onclick="chartKeep();CH.rows.splice(${i},1);drawChart()">×</button></td></tr>`).join("")}</table></div>
    <div style="display:flex;gap:8px;margin-top:6px">${c.rows.length < 30 ? `<button class="btn ghost" onclick="chartKeep();CH.rows.push(['',...CH.cols.map(()=>'')]);drawChart()">＋ Add size</button>` : ""}
      ${c.tpl === "custom" && c.cols.length < 8 ? `<button class="btn ghost" onclick="chartKeep();CH.cols.push('Col '+(CH.cols.length+1));CH.rows.forEach(r=>r.push(''));drawChart()">＋ Add column</button>` : ""}</div>
    <label>FIT NOTE (OPTIONAL)</label><input class="in" id="chf" maxlength="120" value="${esc(c.fit)}" placeholder="Regular fit · If between sizes, take the bigger one">
    <div class="sub" style="margin-top:6px">Sizes here must match the item's sizes (S, M, L… or 28/30/32… or UK 6/7/8).</div>
    <div class="msg" id="che"></div>
    <button class="btn pink full" style="margin-top:10px;padding:15px" onclick="saveChart()">Save chart</button>
    ${c.id ? `<button class="btn ghost full" style="margin-top:8px;color:#BE185D" onclick="delChart()">Delete chart</button>` : ""}`, true);
}
async function saveChart() {
  chartKeep(); const c = CH, m = $("#che"), rows = c.rows.filter(r => String(r[0]).trim());
  const err = c.name.trim().length < 2 ? "Give the chart a name" : !rows.length ? "Add at least one size" : new Set(rows.map(r => String(r[0]).trim().toLowerCase())).size !== rows.length ? "Each size only once" : null;
  if (err) { m.className = "msg err"; m.textContent = err; return; }
  const row = { shop: S.id, name: c.name.trim(), template: c.tpl, columns: c.cols.map(x => String(x).trim() || "—"), fit_note: c.fit.trim() || null,
    rows: rows.map(r => ({ size: String(r[0]).trim(), v: c.cols.map((col, j) => { const v = parseFloat(r[j + 1]); return isNaN(v) ? null : c.inch && isMeasure(col) ? Math.round(v * 25.4) / 10 : v; }) })) };
  const q = c.id ? await db.from("size_charts").update(row).eq("id", c.id) : await db.from("size_charts").insert(row);
  if (q.error) { m.className = "msg err"; m.textContent = niceErr(q.error); return; }
  toast("Size chart saved"); closeDrawer(); await loadAll(); charts();
}
async function delChart() {
  if (!confirm("Delete this size chart? Items using it will need another chart.")) return;
  const { error } = await db.from("size_charts").delete().eq("id", CH.id); if (error) return toast(niceErr(error));
  closeDrawer(); await loadAll(); charts();
}
