// Seller panel → "Get customers": shop link, WhatsApp message and a printable A4 QR poster.
// Uses S (the seller's shop) and live() from app.js.
const shopLink = () => `https://galibazaar.site/shop/${S.link_code}`;
function shopMsg() {
  const how = S.delivery_mode === "courier" ? "Order on your phone — we send it by courier. Pay cash when the parcel arrives."
    : S.delivery_mode === "both" ? "Order on your phone — home delivery nearby, courier for far away. Pay cash or UPI when your order arrives."
    : "Order on your phone — we deliver to your door. Pay cash or UPI when your order arrives.";
  return `Namaste! 🙏\n*${S.name}* is now on *Gali Bazaar*.\n${how}\n\n👉 Open our shop: ${shopLink()}\n\n(Android app · free for customers)`;
}
function shareBox() {
  if (!S || !S.link_code) return "";
  if (!live()) return `<div class="box"><h3>Get customers</h3><div class="sub">Your QR poster and shop link work once your shop is live (KYC approved + plan active).</div></div>`;
  return `<div class="box" style="background:linear-gradient(135deg,#6A1BB0,#F0287A);color:#fff"><b style="font-size:16px">Get customers</b>
    <div style="font-size:12.5px;opacity:.92;margin:4px 0 10px">Put the QR poster on your counter and send your link on WhatsApp — your customers order from you on their phone.</div>
    <div style="background:rgba(255,255,255,.16);border-radius:10px;padding:8px 10px;font-size:13px;margin-bottom:10px;word-break:break-all">${shopLink().replace("https://", "")}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <button class="btn" style="background:#fff;color:#1D0F30;padding:9px 6px" onclick="shopPoster()">🖨 QR poster</button>
      <a class="btn" style="background:#25D366;color:#fff;padding:9px 6px;text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shopMsg())}">WhatsApp</a>
      <button class="btn" style="background:rgba(255,255,255,.2);color:#fff;padding:9px 6px" onclick="copyShopLink(this)">Copy link</button></div></div>`;
}
async function copyShopLink(b) {
  try { await navigator.clipboard.writeText(shopLink()); b.textContent = "Copied ✓"; } catch (e) { prompt("Copy your shop link:", shopLink()); }
  setTimeout(() => b.textContent = "Copy link", 1800);
}
async function shopPoster() {
  if (!window.qrcode) await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "/lib/qrcode.js"; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }).catch(() => null);
  if (!window.qrcode) return alert("Couldn't make the QR code — check your internet and try again.");
  const q = qrcode(0, "M"); q.addData(shopLink()); q.make();
  const esc2 = t => String(t || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const step3 = S.delivery_mode === "courier" ? "pay when the parcel arrives" : "we deliver · pay cash or UPI";
  const where = [S.locality, S.city].filter(Boolean).join(", ");
  const w = window.open("", "_blank");
  if (!w) return alert("Allow pop-ups for this site to open the poster.");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR poster · ${esc2(S.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&family=Baloo+2:wght@800&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Poppins,sans-serif;color:#1D0F30;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{width:210mm;height:297mm;margin:auto;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;overflow:hidden}
.top{width:100%;background:#6A1BB0;padding:11mm 0 5mm}.pill{display:inline-block;background:#fff;border-radius:40px;padding:3mm 9mm;font-weight:800;font-size:30px;line-height:1.2}
.pill .g{font-family:"Baloo 2";color:#6A1BB0;margin-right:6px}.pill .d{color:#F0287A}.tag{color:#E9DDF8;font-size:13px;margin-top:3mm}
.now{color:#6B6380;font-size:20px;margin-top:9mm}.name{font-weight:800;font-size:44px;line-height:1.12;margin:1mm 14mm 0;max-height:2.3em;overflow:hidden}
.on{color:#6A1BB0;font-size:18px;margin-top:2mm}.qr{background:#F4EEFF;border-radius:9mm;padding:6mm;margin-top:6mm}.qr div{background:#fff;border-radius:5mm;padding:4mm}.qr svg{width:100mm;height:100mm;display:block}
.scan{background:#FFD447;border-radius:30px;padding:3mm 9mm;font-weight:800;font-size:17px;margin-top:6mm}.hi{font-size:16px;margin-top:4mm}
.steps{display:flex;width:100%;padding:0 10mm;margin-top:7mm}.st{flex:1}.st b{display:inline-flex;width:10mm;height:10mm;border-radius:50%;background:#6A1BB0;color:#fff;align-items:center;justify-content:center}
.st h4{margin:2mm 0 0;font-size:14px}.st p{margin:1mm 4mm 0;color:#6B6380;font-size:11px}
.foot{position:absolute;bottom:0;width:100%;background:#6A1BB0;color:#fff;padding:3mm 0 3.5mm}.foot b{font-size:13px}.foot div{font-size:10.5px;color:#E9DDF8}
.bar{position:fixed;top:10px;right:10px;display:flex;gap:8px}.bar button{font:inherit;font-weight:700;padding:10px 16px;border-radius:12px;border:0;background:#EF287B;color:#fff;cursor:pointer}
@media print{.bar{display:none}}</style></head><body>
<div class="bar"><button onclick="print()">Print / Save PDF</button></div>
<div class="pg"><div class="top"><div class="pill"><span class="g">गली</span>Bazaar<span class="d">.</span></div><div class="tag">Your neighbourhood shops, on your phone</div></div>
<div class="now">Now order from</div><div class="name">${esc2(S.name)}</div><div class="on">on the Gali Bazaar app</div>
<div class="qr"><div>${q.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div></div>
<div class="scan">Scan with your phone camera</div><div class="hi">QR स्कैन करें, घर बैठे ऑर्डर करें</div>
<div class="steps"><div class="st"><b>1</b><h4>Scan</h4><p>the QR code</p></div><div class="st"><b>2</b><h4>Install</h4><p>the free Gali Bazaar app</p></div><div class="st"><b>3</b><h4>Order</h4><p>${step3}</p></div></div>
<div class="foot"><b>${shopLink().replace("https://", "")}</b><div>${esc2(where) || "Android app · free for customers"}</div></div></div>
<script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))<\/script></body></html>`);
  w.document.close();
}
