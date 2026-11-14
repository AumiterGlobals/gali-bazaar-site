/* Gali Bazaar — item photo cleanup in the browser (spec 13g). Free: nothing is sent to any server.
 *  - product slots: background removed (U²-Net small, Apache-2.0, ONNX Runtime Web) → white square, 8% padding, soft shadow
 *  - label / ingredients / tag / BIS: never cut out — greyscale, 1280 px, ≤ 90 KB (quality ≥ .70)
 *  - food dishes, fruits & veg: never cut out — gentle auto-enhance only
 *  - EXIF rotation applied by the browser; EXIF / location dropped (only pixels are re-encoded)
 *  - WebP: product ≤ 50 KB (800 px), food ≤ 60 KB, label ≤ 90 KB, thumbnail 240 px ≤ 8 KB
 * The model loads only when the seller opens the photo step, then stays in the browser cache.
 */
(function () {
  const TEXT = new Set(["label", "ingredients", "tag", "bis", "sizechart"]);
  const ORT = "/seller/ort/";   // onnxruntime-web 1.20.1 (MIT), self-hosted
  let sessP = null;
  function loadScript(src) { return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
  async function session() {
    if (!sessP) sessP = (async () => {
      if (!window.ort) await loadScript(ORT + "ort.wasm.min.js");
      ort.env.wasm.wasmPaths = ORT; ort.env.wasm.numThreads = 1;
      return await ort.InferenceSession.create("/seller/models/u2netp.onnx", { executionProviders: ["wasm"] });
    })().catch(e => { sessP = null; throw e; });
    return sessP;
  }
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  async function bitmap(file) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) { return await new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = URL.createObjectURL(file); }); }
  }
  function fit(src, max) {
    const s = Math.min(1, max / Math.max(src.width, src.height)), c = canvas(src.width * s, src.height * s);
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, c.width, c.height); return c;
  }
  // brightness (0-255) and sharpness (variance of the Laplacian) on a small copy
  function quality(c) {
    const s = fit(c, 400), d = s.getContext("2d").getImageData(0, 0, s.width, s.height).data, w = s.width, h = s.height, g = new Float32Array(w * h);
    let sum = 0; for (let i = 0; i < w * h; i++) { g[i] = .299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]; sum += g[i]; }
    let a = 0, a2 = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]; a += l; a2 += l * l; n++; }
    const m = n ? a / n : 0; return { bright: sum / (w * h), sharp: n ? a2 / n - m * m : 0 };
  }
  // gentle auto brightness / contrast / white balance — never changes how the product looks
  function enhance(c) {
    const s = fit(c, 200), d = s.getContext("2d").getImageData(0, 0, s.width, s.height).data, n = d.length / 4, lum = new Uint32Array(256);
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; lum[(d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0]++; }
    r /= n; g /= n; b /= n; const avg = (r + g + b) / 3;
    const pct = p => { let acc = 0; for (let i = 0; i < 256; i++) { acc += lum[i]; if (acc >= n * p) return i; } return 255; };
    const lo = Math.min(40, pct(.01)), hi = Math.max(200, pct(.99)), k = Math.min(1.35, Math.max(1, 255 / Math.max(1, hi - lo)));
    const wb = a => Math.min(1.05, Math.max(.95, a > 1 ? avg / a : 1)), kr = k * wb(r), kg = k * wb(g), kb = k * wb(b);
    const out = canvas(c.width, c.height), o = out.getContext("2d"); o.drawImage(c, 0, 0);
    const im = o.getImageData(0, 0, out.width, out.height), p = im.data;
    for (let i = 0; i < p.length; i += 4) { p[i] = (p[i] - lo) * kr; p[i + 1] = (p[i + 1] - lo) * kg; p[i + 2] = (p[i + 2] - lo) * kb; }
    o.putImageData(im, 0, 0); return out;
  }
  function gray(c) {
    const out = canvas(c.width, c.height), o = out.getContext("2d"); o.drawImage(c, 0, 0);
    const im = o.getImageData(0, 0, out.width, out.height), p = im.data;
    for (let i = 0; i < p.length; i += 4) { const v = .299 * p[i] + .587 * p[i + 1] + .114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = v; }
    o.putImageData(im, 0, 0); return out;
  }
  const blob = (c, q) => new Promise(ok => c.toBlob(ok, "image/webp", q));
  // lower quality step by step to the target, never below the floor; then shrink, never below minPx
  async function target(c0, floorQ, kb, minPx) {
    let c = c0, q = .82, b = await blob(c, q);
    while (b.size > kb * 1024) {
      if (q > floorQ + .001) q = Math.max(floorQ, q - .05);
      else if (Math.max(c.width, c.height) * .9 >= minPx) { c = fit(c, Math.max(c.width, c.height) * .9); q = .75; }
      else break;
      b = await blob(c, q);
    }
    return b;
  }
  async function thumb(c) { const t = fit(c, 240); let q = .7, b = await blob(t, q); while (b.size > 8 * 1024 && q > .35) { q -= .07; b = await blob(t, q); } return b; }
  // U²-Net: 320×320, ImageNet normalisation → mask 0..1
  async function mask(c) {
    const S = 320, sess = await session(), s = canvas(S, S), g = s.getContext("2d"); g.drawImage(c, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data, x = new Float32Array(3 * S * S), mean = [.485, .456, .406], sd = [.229, .224, .225];
    let mx = 0; for (let i = 0; i < S * S; i++) mx = Math.max(mx, d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); mx = mx || 255;
    for (let i = 0; i < S * S; i++) for (let k = 0; k < 3; k++) x[k * S * S + i] = (d[i * 4 + k] / mx - mean[k]) / sd[k];
    const r = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", x, [1, 3, S, S]) }), m = r[sess.outputNames[0]].data;
    let lo = Infinity, hi = -Infinity; for (const v of m) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const out = new Float32Array(S * S); let on = 0;
    for (let i = 0; i < S * S; i++) { out[i] = (m[i] - lo) / ((hi - lo) || 1); if (out[i] > .5) on++; }
    return { m: out, S, cover: on / (S * S) };
  }
  function cutOnWhite(c, mk, size) {
    const { m, S } = mk, mc = canvas(S, S), mg = mc.getContext("2d"), mi = mg.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { mi.data[i * 4 + 3] = Math.round(m[i] * 255); }
    mg.putImageData(mi, 0, 0);
    const fg = canvas(c.width, c.height), f = fg.getContext("2d");
    f.drawImage(mc, 0, 0, c.width, c.height); f.globalCompositeOperation = "source-in"; f.drawImage(c, 0, 0);
    // crop to the visible pixels
    const sm = fit(fg, 400), sd = sm.getContext("2d").getImageData(0, 0, sm.width, sm.height).data, sx = fg.width / sm.width;
    let l = sm.width, t = sm.height, r = -1, b = -1;
    for (let y = 0; y < sm.height; y++) for (let xx = 0; xx < sm.width; xx++) if (sd[(y * sm.width + xx) * 4 + 3] > 24) { if (xx < l) l = xx; if (xx > r) r = xx; if (y < t) t = y; if (y > b) b = y; }
    if (r <= l || b <= t) return null;
    const cx = l * sx, cy = t * sx, cw = (r - l + 1) * sx, ch = (b - t + 1) * sx;
    const out = canvas(size, size), o = out.getContext("2d"); o.fillStyle = "#FFFFFF"; o.fillRect(0, 0, size, size);
    const inner = size * .84, s = Math.min(inner / cw, inner / ch), dw = cw * s, dh = ch * s, left = (size - dw) / 2, top = (size - dh) / 2;
    o.save(); o.filter = `blur(${size * .015}px)`; o.fillStyle = "rgba(0,0,0,.11)";
    o.beginPath(); o.ellipse(size / 2, top + dh, dw * .38, size * .025, 0, 0, Math.PI * 2); o.fill(); o.restore();
    o.drawImage(fg, cx, cy, cw, ch, left, top, dw, dh);
    return out;
  }
  async function urlOf(b) { return URL.createObjectURL(b); }
  /**
   * clean(file, slot, foodLoose) → { big, thumb, preview, original?, originalPreview?, removed, warnings }
   * big / thumb / original are WebP Blobs ready to upload; previews are object URLs.
   */
  async function clean(file, slot, foodLoose) {
    const src = await bitmap(file), text = TEXT.has(slot), warnings = [];
    const base = fit(src, text ? 1600 : 1400), q = quality(base);
    if (Math.min(src.width, src.height) < 600) warnings.push("Photo is too small");
    if (q.bright < 60) warnings.push("Too dark — try near a window");
    if (q.sharp < 60) warnings.push("Photo looks blurry — take again?");
    if (text) {
      const g = fit(gray(enhance(base)), 1280), big = await target(g, .70, 90, 1100);
      return { big, thumb: await thumb(g), preview: await urlOf(big), removed: false, warnings };
    }
    const en = enhance(base), orig = fit(en, 800);
    if (foodLoose) { const big = await target(orig, .60, 60, 640); return { big, thumb: await thumb(orig), preview: await urlOf(big), removed: false, warnings }; }
    let sq = null;
    try { const mk = await mask(en); if (mk.cover > .03 && mk.cover < .97) sq = cutOnWhite(en, mk, 800); } catch (e) { console.warn("bg removal", e); }
    if (!sq) {
      warnings.push("Background couldn't be removed — original kept");
      const big = await target(orig, .72, 50, 640); return { big, thumb: await thumb(orig), preview: await urlOf(big), removed: false, warnings };
    }
    const big = await target(sq, .60, 50, 640), original = await target(orig, .72, 60, 640);
    return { big, thumb: await thumb(sq), preview: await urlOf(big), original, originalThumb: await thumb(orig), originalPreview: await urlOf(original), removed: true, warnings };
  }
  async function sha(b) { const h = await crypto.subtle.digest("SHA-256", await b.arrayBuffer()); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, "0")).join("").slice(0, 40); }
  /** Upload once by content hash (same photo = same file, no copy). Returns the public URL. */
  async function upload(db, uid, big, th) {
    const p = `${uid}/items/${await sha(big)}`;
    await db.storage.from("public").upload(p + "_t.webp", th, { upsert: false, contentType: "image/webp" }).catch(() => {});
    await db.storage.from("public").upload(p + ".webp", big, { upsert: false, contentType: "image/webp" }).catch(() => {});   // "already exists" = re-used
    return db.storage.from("public").getPublicUrl(p + ".webp").data.publicUrl;
  }
  window.PhotoClean = { clean, upload, warm: () => session().catch(() => null), TEXT, cutsOut: (slot, foodLoose) => !TEXT.has(slot) && !foodLoose };
})();
