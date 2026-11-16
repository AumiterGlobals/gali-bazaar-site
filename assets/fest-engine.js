// Gali Bazaar — festival scene engine (the same algorithm is ported to the app: FestEngine.kt).
// draw(ctx, W, H, t, key, opt) is deterministic: the same t gives the same frame (no state, no Math.random).
// Layers back → front, each with its own parallax depth (0.15 / 0.45 / 0.7 / 1.0), a slow camera drift sin(t·0.35)
// and a light zoom-in. Particles are functions of t (birth = floor((t+off)/life)), so a still frame (t = 2.2 s) is exact.
// Original drawing only: faceless silhouettes, no copyrighted art. Logo colours are never touched (the logo is HTML).
// Speed (run): o.pass "bg" draws only the still layers (sky, hills, trees, houses, ground) once into an offscreen canvas;
// o.pass "fx" draws only what moves (fire, bhailo, sparks, smoke, twinkle) on top each frame. No pass = everything (tests, still).
// Glows are cached sprites (no gradient per frame); the camera is fixed (o.tc) when layers are cached; o.lite = phone particle caps.
(function () {
  "use strict";
  var TAU = Math.PI * 2, SHADE = 1;   // SHADE: far-side shadow on snow ranges (night 1, day .35)
  // ---------- deterministic helpers ----------
  function h1(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function noise(x) { var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; }
  function fbm(x, o) { var v = 0, a = .5, fq = 1; for (var k = 0; k < (o || 5); k++) { v += a * noise(x * fq + k * 17.3); fq *= 2.03; a *= .5; } return v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")"; }
  function mix(c1, c2, k) { return [Math.round(lerp(c1[0], c2[0], k)), Math.round(lerp(c1[1], c2[1], k)), Math.round(lerp(c1[2], c2[2], k))]; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  // a radial glow is a cached sprite per colour (made once), drawn with drawImage + alpha
  var SPR = {};
  function sprite(c) {
    var key = c[0] + "," + c[1] + "," + c[2], sp = SPR[key];
    if (!sp) { sp = SPR[key] = document.createElement("canvas"); sp.width = sp.height = 64; var g = sp.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(1, rgba(c, 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
    return sp;
  }
  function glow(ctx, x, y, r, c, a) { if (a <= 0 || r <= 0) return; var ga = ctx.globalAlpha; ctx.globalAlpha = ga * Math.min(1, a); ctx.drawImage(sprite(c), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = ga; }

  // ---------- camera ----------
  function layer(ctx, W, H, t, depth, cam, fn) {
    ctx.save();
    var tc = cam.tc != null ? cam.tc : t;   // cached layers: the camera stands still so the moving layer lines up
    var dx = Math.sin(tc * .35) * 14 * cam.u * depth + cam.mx * 10 * depth, dy = cam.my * 4 * depth;
    var z = 1 + .006 * Math.min(tc, 10) * depth;
    ctx.translate(W / 2 + dx, H * .92 + dy); ctx.scale(z, z); ctx.translate(-W / 2, -H * .92);
    fn(); ctx.restore();
  }
  var grainCanvas = null;
  function grain(ctx, W, H, t) {
    if (!grainCanvas) {
      grainCanvas = document.createElement("canvas"); grainCanvas.width = grainCanvas.height = 256;
      var g = grainCanvas.getContext("2d"), im = g.createImageData(256, 256);
      for (var i = 0; i < 65536; i++) { var v = Math.floor(h1(i * .731) * 255); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
      g.putImageData(im, 0, 0);
    }
    var f = Math.floor(t * 24), ox = Math.floor(h1(f) * 256), oy = Math.floor(h1(f + 9) * 256);
    ctx.save(); ctx.globalAlpha = .045; ctx.globalCompositeOperation = "overlay";
    ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(grainCanvas, "repeat"); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
  }
  function post(ctx, W, H, t, warm, flick, o) {
    if (o && o.pass === "fx") return;
    var v = ctx.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .35, W / 2, H * .55, Math.max(W, H) * .8);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.55)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (warm) { ctx.save(); ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = rgba(warm, .10 + .05 * flick); ctx.fillRect(0, 0, W, H); ctx.restore(); }
    grain(ctx, W, H, t);
  }
  function stars(ctx, W, H, t, n, top) {
    for (var i = 0; i < n; i++) {
      var x = h1(i * 3.1) * W, y = h1(i * 7.7) * H * top, sp = .8 + h1(i * 1.3) * 2.6, r = (.4 + h1(i * 5.1) * 1.1) * Math.max(1, H / 640);
      ctx.fillStyle = "rgba(255,248,235," + (.25 + .75 * (.5 + .5 * Math.sin(t * sp + i))).toFixed(3) + ")";
      ctx.fillRect(x, y, r, r);
    }
  }
  function moon(ctx, x, y, r) {
    glow(ctx, x, y, r * 7, [255, 236, 200], .22); glow(ctx, x, y, r * 2.6, [255, 240, 215], .35);
    ctx.fillStyle = "#FFF4DE"; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(220,200,175,.35)"; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .1, r * .22, 0, TAU); ctx.arc(x + r * .25, y + r * .3, r * .14, 0, TAU); ctx.fill();
  }
  // ridge y at x for a range
  function ridge(x, W, base, amp, fq, seed) { return base - amp * Math.pow(fbm(x / W * fq + seed, 5), 1.6) * 1.9; }
  function range(ctx, W, H, base, amp, fq, seed, top, bot, snow, moonX, body) {
    var step = Math.max(3, W / 260), pts = [];
    for (var x = -40; x <= W + 40; x += step) pts.push([x, ridge(x, W, base, amp, fq, seed)]);
    var minY = Math.min.apply(null, pts.map(function (p) { return p[1]; }));
    var g = ctx.createLinearGradient(0, minY, 0, base + 20);
    if (snow) { body = body || ["#8E7FA0", "#6D5A7E", "#3A2236"]; g.addColorStop(0, body[0]); g.addColorStop(.45, body[1]); g.addColorStop(1, body[2]); }
    else { g.addColorStop(0, top); g.addColorStop(1, bot); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-40, H + 40);
    pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); }); ctx.lineTo(W + 40, H + 40); ctx.closePath(); ctx.fill();
    if (snow) {
      // snow only above the snow line, its lower edge ragged; the moon side lit, the far side in shadow
      var line = base - amp * .55, cap = ctx.createLinearGradient(0, minY, 0, line + amp * .1);
      cap.addColorStop(0, "#EEF0FA"); cap.addColorStop(.35, "#C9C5DE"); cap.addColorStop(.8, "rgba(150,140,180,.55)"); cap.addColorStop(1, "rgba(120,105,150,0)");
      ctx.fillStyle = cap; ctx.beginPath(); var first = true;
      pts.forEach(function (p) { var y = Math.min(p[1], line); first ? ctx.moveTo(p[0], y) : ctx.lineTo(p[0], y); first = false; });
      for (var i = pts.length - 1; i >= 0; i--) { var p = pts[i], low = line + amp * .12 * (fbm(p[0] / W * 22 + seed, 3) - .3); ctx.lineTo(p[0], Math.max(p[1], low)); }
      ctx.closePath(); ctx.fill();
      // moon side lit, the far side in shadow (one horizontal light falloff, clipped to the range)
      ctx.save(); ctx.beginPath(); ctx.moveTo(-40, H + 40); pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); }); ctx.lineTo(W + 40, H + 40); ctx.closePath(); ctx.clip();
      var sh = ctx.createLinearGradient(0, 0, W, 0), m = clamp(moonX / W, .05, .95);
      sh.addColorStop(0, "rgba(28,14,38," + (.38 * SHADE).toFixed(3) + ")"); sh.addColorStop(m, "rgba(255,250,240,.06)"); sh.addColorStop(1, "rgba(28,14,38," + (.22 * SHADE).toFixed(3) + ")");
      ctx.fillStyle = sh; ctx.fillRect(0, minY, W, H);
      ctx.restore();
    }
    return pts;
  }
  function mist(ctx, W, H, t, y, n, a, u) {
    var g = ctx.createLinearGradient(0, y - 40 * u, 0, y + 40 * u); g.addColorStop(0, "rgba(255,210,200,0)"); g.addColorStop(.5, "rgba(255,214,200," + a + ")"); g.addColorStop(1, "rgba(255,210,200,0)");
    ctx.fillStyle = g; ctx.fillRect(0, y - 40 * u, W, 80 * u);
    for (var i = 0; i < n; i++) {
      var w = (220 + h1(i * 4) * 260) * u, x = ((h1(i * 9) * (W + w) + t * (6 + i * 3) * u) % (W + w * 2)) - w, yy = y + (h1(i * 2) - .5) * 40 * u;
      ctx.save(); ctx.translate(x, yy); ctx.scale(1, .28); glow(ctx, 0, 0, w * .5, [240, 215, 215], a * 1.3); ctx.restore();
    }
  }
  function deodar(ctx, x, y, h, t, i, col) {
    var sway = Math.sin(t * 1.3 + i * 1.7) * h * .025;
    ctx.fillStyle = col; ctx.beginPath();
    ctx.fillRect(x - h * .03, y - h * .12, h * .06, h * .14);
    var tiers = 6;
    for (var k = 0; k < tiers; k++) {
      var f = k / tiers, w = h * (.34 - f * .27), yy = y - h * .1 - f * h * .85, s = sway * f;
      ctx.moveTo(x - w + s * .6, yy); ctx.lineTo(x + s, yy - h * .24); ctx.lineTo(x + w + s * .6, yy);
    }
    ctx.closePath(); ctx.fill();
  }
  // faceless person: head + kurta + legs; arm up to (ax, ay) if given
  // ---------- people: real proportions, clothes and a rim of light from the fire / sun (faces are never drawn) ----------
  // o: g = "saree" | "kurta" | "kid" | "kidg" (girl in a frock), arm = [x, y] where the right hand goes (else arms by o.pose:
  // "up" both hands raised, "side" relaxed), rim = [r,g,b] light colour, side = +1 light from the right / -1 from the left, t, i
  function ik(sx, sy, tx, ty, a, b, out) {   // two-bone arm: shoulder → elbow → hand, elbow bends outward/down
    var dx = tx - sx, dy = ty - sy, d = Math.min(Math.hypot(dx, dy), a + b - .01), ang = Math.atan2(dy, dx);
    var k = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)) * out;
    return [sx + Math.cos(ang + k) * a, sy + Math.sin(ang + k) * a, sx + Math.cos(ang) * d, sy + Math.sin(ang) * d];
  }
  function human(ctx, x, y, h, col, o) {
    o = o || {}; var g = o.g || "kurta", kid = g === "kid" || g === "kidg", t = o.t || 0, i = o.i || 0;
    y -= o.bounce || 0;
    var hr = h * (kid ? .085 : .066), hy = y - h + hr * 1.1, sh = y - h * (kid ? .76 : .81), sw = h * (kid ? .1 : .115);
    var waist = y - h * (kid ? .5 : .52), hip = y - h * (kid ? .44 : .44), sway = Math.sin(t * 1.3 + i) * h * .012;
    var A = h * (kid ? .15 : .165), B = h * (kid ? .14 : .155);   // upper arm, forearm
    var rS = [x + sw * .92, sh + h * .015], lS = [x - sw * .92, sh + h * .015];
    var rT = o.arm || (o.pose === "up" ? [x + sw * 1.3, sh - h * .36 + Math.sin(t * 5 + i) * h * .02] : [x + sw * .9, waist + h * .06]);
    var lT = o.arm2 || (o.pose === "up" ? [x - sw * 1.3, sh - h * .36 + Math.cos(t * 5 + i) * h * .02] : [x - sw * .95 - (o.arm ? h * .05 : 0), waist + h * .07]);
    var R = ik(rS[0], rS[1], rT[0], rT[1], A, B, o.pose === "up" ? -1 : 1), L = ik(lS[0], lS[1], lT[0], lT[1], A, B, o.pose === "up" ? 1 : -1);
    function fig(c) {
      ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineCap = "round"; ctx.lineJoin = "round";
      // legs / lower garment
      if (g === "saree" || g === "kidg") {
        var hem = g === "saree" ? h * .19 : h * .2, top = g === "saree" ? waist : sh + h * .06, bot = g === "saree" ? y : y - h * .2;
        ctx.beginPath(); ctx.moveTo(x - sw * .7, top); ctx.quadraticCurveTo(x - sw * 1.05, (top + bot) / 2, x - hem / 2 + sway, bot);
        ctx.lineTo(x + hem / 2 + sway, bot); ctx.quadraticCurveTo(x + sw * 1.05, (top + bot) / 2, x + sw * .7, top); ctx.closePath(); ctx.fill();
        if (g === "kidg") { ctx.lineWidth = h * .05; ctx.beginPath(); ctx.moveTo(x - h * .04, bot); ctx.lineTo(x - h * .045, y); ctx.moveTo(x + h * .04, bot); ctx.lineTo(x + h * .045, y); ctx.stroke(); }
      } else {
        var step = Math.sin(t * 2 + i) * h * .01;
        ctx.beginPath(); ctx.moveTo(x - sw * .78, hip); ctx.lineTo(x - h * .02, hip); ctx.lineTo(x - h * .03 + step, y); ctx.lineTo(x - h * .085 + step, y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + sw * .78, hip); ctx.lineTo(x + h * .02, hip); ctx.lineTo(x + h * .03 - step, y); ctx.lineTo(x + h * .085 - step, y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x - h * .065 + step, y, h * .04, h * .014, 0, 0, TAU); ctx.ellipse(x + h * .065 - step, y, h * .04, h * .014, 0, 0, TAU); ctx.fill();
      }
      // torso: shoulders → waist (kurta runs down to the knee)
      var tb = g === "kurta" ? y - h * .27 : g === "kid" ? hip + h * .03 : waist + h * .02, tw = g === "kurta" ? sw * 1.05 : sw * .78;
      ctx.beginPath(); ctx.moveTo(x - sw, sh + h * .02); ctx.quadraticCurveTo(x - sw * 1.02, sh - h * .012, x - sw * .5, sh - h * .02);
      ctx.lineTo(x + sw * .5, sh - h * .02); ctx.quadraticCurveTo(x + sw * 1.02, sh - h * .012, x + sw, sh + h * .02);
      ctx.quadraticCurveTo(x + sw * .78, (sh + tb) / 2, x + tw, tb); ctx.lineTo(x - tw, tb); ctx.quadraticCurveTo(x - sw * .78, (sh + tb) / 2, x - sw, sh + h * .02); ctx.closePath(); ctx.fill();
      // neck + head (slightly oval), hair bun for the women / girls
      ctx.fillRect(x - h * .018, hy + hr * .6, h * .036, sh - hy - hr * .5);
      ctx.beginPath(); ctx.ellipse(x, hy, hr * .86, hr, 0, 0, TAU); ctx.fill();
      if (g === "saree" || g === "kidg") { ctx.beginPath(); ctx.arc(x - (o.side || 1) * hr * .8, hy + hr * .25, hr * .42, 0, TAU); ctx.fill(); }
      // pallu: over the head, across the chest, falling behind the shoulder
      if (g === "saree") {
        ctx.beginPath(); ctx.moveTo(x - hr * 1.05, hy + hr * .2); ctx.quadraticCurveTo(x, hy - hr * 1.35, x + hr * 1.05, hy + hr * .2);
        ctx.quadraticCurveTo(x + sw * 1.15, sh + h * .1, x + sw * .9, waist + h * .05 + sway); ctx.lineTo(x + sw * .5, waist);
        ctx.quadraticCurveTo(x - sw * .2, sh + h * .12, x - sw * 1.08, sh + h * .02); ctx.closePath(); ctx.fill();
      }
      // arms: upper arm thicker than the forearm, small hands
      ctx.lineWidth = h * (kid ? .05 : .045);
      ctx.beginPath(); ctx.moveTo(rS[0], rS[1]); ctx.lineTo(R[0], R[1]); ctx.moveTo(lS[0], lS[1]); ctx.lineTo(L[0], L[1]); ctx.stroke();
      ctx.lineWidth = h * (kid ? .04 : .036);
      ctx.beginPath(); ctx.moveTo(R[0], R[1]); ctx.lineTo(R[2], R[3]); ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); ctx.stroke();
      ctx.beginPath(); ctx.arc(R[2], R[3], h * .022, 0, TAU); ctx.arc(L[2], L[3], h * .022, 0, TAU); ctx.fill();
    }
    if (o.rim) {   // a thin edge of warm light on the side facing the fire / sun
      ctx.save(); ctx.translate((o.side || 1) * Math.max(1, h * .012), -Math.max(.5, h * .004)); fig(rgba(o.rim, .9)); ctx.restore();
    }
    fig(col);
    if (g === "saree" && !o.flat) {   // a few pleat lines catch the light
      ctx.strokeStyle = o.rim ? rgba(o.rim, .22) : "rgba(255,255,255,.08)"; ctx.lineWidth = Math.max(1, h * .006);
      ctx.beginPath(); for (var pl = -1; pl <= 1; pl++) { ctx.moveTo(x + pl * h * .03, waist + h * .1); ctx.lineTo(x + pl * h * .05 + sway, y - h * .01); } ctx.stroke();
    }
    return [R[2], R[3], L[2], L[3]];
  }
  // older call shape kept: person(ctx, x, y, h, col, armTo, bounce, opts)
  function person(ctx, x, y, h, col, armTo, bounce, o) {
    o = o || {}; o.arm = armTo || null; o.bounce = bounce || 0; if (!armTo && !o.pose) o.pose = "up";
    return human(ctx, x, y, h, col, o);
  }
  function flame(ctx, x, y, s, t, seed) {
    var f = .85 + .15 * noise(t * 9 + seed * 5);
    glow(ctx, x, y, s * 9, [255, 140, 40], .28 * f); glow(ctx, x, y, s * 4, [255, 190, 90], .55 * f);
    var L = [[255, 90, 20, 1.6], [255, 160, 40, 1.15], [255, 236, 170, .7]];
    for (var k = 0; k < 3; k++) { var c = L[k]; ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",.95)";
      var w = s * c[3] * f, hgt = s * c[3] * 2.2 * f; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * .6, y - hgt * .7, x + (noise(t * 6 + seed) - .5) * w, y - hgt);
      ctx.quadraticCurveTo(x + w * .6, y - hgt * .7, x + w, y); ctx.arc(x, y, w, 0, Math.PI); ctx.fill(); }
  }

  // ---------- IGAS (bhailo night in the hills) ----------
  function bhailoPos(t, cx, cy, rx, ry, ph) { var a = t * 3.2 + ph; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, Math.sin(a)]; }
  function igas(ctx, W, H, t, o) {
    SHADE = 1;
    var u = Math.min(H / 640, W / 480), cam = { u: u, mx: o.mx || 0, my: o.my || 0, tc: o.tc }, flick = noise(t * 7), S = o.pass !== "fx", D = o.pass !== "bg", lite = !!o.lite;
    if (S) { var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#160B1F"); sky.addColorStop(.55, "#3A1530"); sky.addColorStop(1, "#8C3A1E");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H); }
    var moonX = W * .8, moonY = H * .17;
    layer(ctx, W, H, t, .15, cam, function () { if (D) stars(ctx, W, H, t, lite ? 70 : 150, .62); if (S) moon(ctx, moonX, moonY, 22 * u); });
    var near = W > 900 ? 1 : 0;
    if (S) layer(ctx, W, H, t, .3, cam, function () {
      range(ctx, W, H, H * .58, H * .28, 3.2, 2.1, "#8E9BC4", "#5C5F8E", false, moonX);       // far blue-white range
      ctx.fillStyle = "rgba(200,210,240,.05)"; ctx.fillRect(0, H * .45, W, H * .2);
      range(ctx, W, H, H * .66, H * .3, 2.4, 7.3, null, null, true, moonX);                   // snow peaks
      mist(ctx, W, H, t, H * .67, 3, .09, u);
    });
    if (S) layer(ctx, W, H, t, .45, cam, function () {
      var pts = range(ctx, W, H, H * .8, H * .14, 1.8, 13.7, "#3B1C33", "#22101E", false, moonX);
      for (var i = 0; i < 26; i++) {
        var x = h1(i * 2.3) * W, y = ridge(x, W, H * .8, H * .14, 1.8, 13.7) + 6 * u, h = (34 + h1(i * 5.9) * 46) * u;
        deodar(ctx, x, y, h, t, i, i % 3 ? "#1A0C17" : "#24111F");
      }
    });
    // terrace with the pahadi house
    var hx = W * (near ? .7 : .66), hy = H * .84, hw = 150 * u, hh = 84 * u;
    layer(ctx, W, H, t, .7, cam, function () {
      if (S) {
      ctx.fillStyle = "#170A14"; ctx.beginPath(); ctx.moveTo(-40, H); ctx.lineTo(-40, H * .86);
      for (var x = -40; x <= W + 40; x += 12) ctx.lineTo(x, H * .86 - 22 * u * Math.sin(x / W * 3.1 + .4) - 10 * u * fbm(x / W * 6 + 3));
      ctx.lineTo(W + 40, H); ctx.closePath(); ctx.fill();
      glow(ctx, hx, hy - hh * .4, hw * 1.6, [255, 150, 60], .16 + .06 * flick);
      ctx.fillStyle = "#4A3A3C"; ctx.fillRect(hx - hw / 2, hy - hh, hw, hh);                       // stone wall
      ctx.strokeStyle = "rgba(20,10,15,.45)"; ctx.lineWidth = 1;
      for (var r = 0; r < 6; r++) for (var c = 0; c < 8; c++) { var bx = hx - hw / 2 + (c + (r % 2) * .5) * hw / 8, by = hy - hh + r * hh / 6; ctx.strokeRect(bx, by, hw / 8, hh / 6); }
      ctx.fillStyle = "#2B2530"; ctx.beginPath(); ctx.moveTo(hx - hw * .62, hy - hh); ctx.lineTo(hx - hw * .38, hy - hh - 42 * u); ctx.lineTo(hx + hw * .38, hy - hh - 42 * u); ctx.lineTo(hx + hw * .62, hy - hh); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(160,150,170,.35)"; for (var s = 1; s < 7; s++) { var yy = hy - hh - s * 6 * u, k = s / 7; ctx.beginPath(); ctx.moveTo(hx - hw * (.62 - .24 * k), yy); ctx.lineTo(hx + hw * (.62 - .24 * k), yy); ctx.stroke(); }
      }
      if (!D) return;
      var wl = .75 + .25 * noise(t * 8);
      [[-.3, .55], [.3, .55]].forEach(function (p, i) { var wx = hx + p[0] * hw, wy = hy - hh * p[1]; glow(ctx, wx, wy, 26 * u, [255, 170, 70], .5 * wl);
        ctx.fillStyle = "rgba(255," + Math.round(180 + 40 * wl) + ",90,1)"; ctx.fillRect(wx - 9 * u, wy - 11 * u, 18 * u, 20 * u); ctx.fillStyle = "#2B1A16"; ctx.fillRect(wx - 1, wy - 11 * u, 2, 20 * u); });
      ctx.fillStyle = "rgba(255," + Math.round(160 + 50 * wl) + ",80,1)"; ctx.fillRect(hx - 11 * u, hy - 38 * u, 22 * u, 38 * u);
      for (var d = 0; d < 7; d++) { var dx = hx - hw * .55 + d * hw * 1.1 / 6; flame(ctx, dx, hy - hh - 2 * u, 2.2 * u, t, d); }
    });
    // people + bhailo
    layer(ctx, W, H, t, 1, cam, function () {
      if (S) { ctx.fillStyle = "#0C060B"; ctx.beginPath(); ctx.moveTo(-40, H + 10);
        for (var x = -40; x <= W + 40; x += 14) ctx.lineTo(x, H * .93 - 10 * u * Math.sin(x / W * 4 + 1));
        ctx.lineTo(W + 40, H + 10); ctx.closePath(); ctx.fill(); }
      if (!D) return;
      var ph = H * .17, col = "#0C060B", base = H * .95;
      var swingers = near ? [[W * .2, 0], [W * .42, 2.4]] : [[W * .18, 0], [W * .46, 2.4]];
      var fires = [];
      swingers.forEach(function (s, i) {
        var px = s[0], hand = [px + ph * .12, base - ph * 1.05];
        var cx = px + ph * .1, cy = base - ph * 1.35, rx = ph * .62, ry = ph * .2;
        var b = bhailoPos(t, cx, cy, rx, ry, s[1]); fires.push(b);
        // trail
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (var k = 25; k >= 1; k -= lite ? 3 : 1) { var q = bhailoPos(t - k * .012, cx, cy, rx, ry, s[1]); var sz = (1 + .35 * q[2]) * 7 * u * (1 - k / 28);
          ctx.fillStyle = "rgba(255," + Math.round(120 + 60 * (1 - k / 25)) + ",40," + (.22 * (1 - k / 25)).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(q[0], q[1], sz, 0, TAU); ctx.fill(); }
        ctx.restore();
        var behind = b[2] < 0;
        function rope() { ctx.strokeStyle = "rgba(30,15,15,.9)"; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        function fire() { ctx.save(); ctx.globalCompositeOperation = "lighter"; flame(ctx, b[0], b[1], (5 + 2.5 * b[2]) * u, t, i * 3); ctx.restore(); }
        if (behind) { rope(); fire(); }
        // light pool on the ground
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(b[0], base); ctx.scale(1, .22); glow(ctx, 0, 0, ph * .9, [255, 140, 50], .22); ctx.restore();
        person(ctx, px, base, ph, col, hand, 0, { g: i ? "saree" : "kurta", rim: [255, 150, 60], side: b[0] > px ? 1 : -1, t: t, i: i });
        if (!behind) { rope(); fire(); }
      });
      var kids = near ? [W * .3, W * .55, W * .86] : [W * .3, W * .6, W * .86];
      kids.forEach(function (kx, i) { person(ctx, kx, base + 2 * u, ph * .62, col, null, Math.abs(Math.sin(t * 4 + i * 1.3)) * 6 * u, { g: i % 2 ? "kidg" : "kid", rim: [255, 140, 60], side: kx > W * .5 ? -1 : 1, t: t, i: i }); });
      o._fires = fires;
    });
    // particles: sparks from the bhailo fires, smoke, bokeh
    if (!D) { post(ctx, W, H, t, [255, 140, 60], .5, o); return; }
    var nS = lite ? 30 : o.half ? 30 : 60, fires = o._fires || [];
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < nS && fires.length; i++) {
      var life = 1.2 + h1(i * 3.3) * 1.4, age = (t + h1(i * 7.1) * life) % life, k = age / life, src = i % fires.length;
      var sw = swingersPos(t - age, i % 2, W, H, u, near);
      var x = sw[0] + Math.sin(age * 3 + i) * 14 * u + (h1(i) - .5) * 30 * u * k, y = sw[1] - age * (60 + h1(i * 2) * 70) * u;
      var c = mix([255, 230, 150], [230, 60, 20], k), r = (1.6 - k) * 1.8 * u + .4;
      glow(ctx, x, y, r * 5, c, .35 * (1 - k)); ctx.fillStyle = rgba(c, 1 - k); ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.restore();
    for (var j = 0; j < (lite ? 6 : 14); j++) {
      var life2 = 6 + h1(j * 5) * 4, a2 = (t + h1(j * 11) * life2) % life2, k2 = a2 / life2, sx = (j % 2 ? hx : swingersPos(t - a2, j % 2, W, H, u, near)[0]);
      var sy = (j % 2 ? H * .84 - 84 * u : H * .7) - a2 * 18 * u, rr = (18 + a2 * 16) * u;
      glow(ctx, sx + Math.sin(a2 + j) * 10 * u, sy, rr, [120, 100, 110], .10 * (1 - k2));
    }
    bokeh(ctx, W, H, t, u, [255, 170, 80]);
    post(ctx, W, H, t, [255, 140, 60], flick, o);
  }
  function swingersPos(t, i, W, H, u, near) {
    var ph = H * .17, base = H * .95, px = i === 0 ? W * (near ? .2 : .18) : W * (near ? .42 : .46);
    var b = bhailoPos(t, px + ph * .1, base - ph * 1.35, ph * .62, ph * .2, i === 0 ? 0 : 2.4); return b;
  }
  function bokeh(ctx, W, H, t, u, c) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 5; i++) {
      var x = (h1(i * 13) * W + Math.sin(t * .2 + i) * 30 * u), y = H * (.25 + h1(i * 17) * .6) + Math.cos(t * .17 + i) * 20 * u, r = (30 + h1(i * 19) * 40) * u;
      glow(ctx, x, y, r, c, .06);
    }
    ctx.restore();
  }

  // ---------- DIWALI (street of lights, fireworks) ----------
  var FW = [[255, 200, 90], [255, 110, 160], [140, 200, 255], [190, 255, 140], [255, 150, 60]];
  function firework(ctx, W, H, t, i, u, lite) {
    var NR = lite ? 24 : 46, TR = lite ? 2 : 5;
    var P = 3.4 + h1(i * 3) * 1.4, ph = (t + h1(i * 5) * P) % P, n = Math.floor((t + h1(i * 5) * P) / P);
    var tx = W * (.12 + h1(i * 7 + n * 1.3) * .76), ty = H * (.12 + h1(i * 11 + n * 2.1) * .22), col = FW[(i + n) % FW.length], rise = .8;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (ph < rise) {   // rocket going up
      var k = ph / rise, y = lerp(H * .9, ty, 1 - Math.pow(1 - k, 2));
      for (var s = 0; s < 6; s++) glow(ctx, tx + Math.sin((ph - s * .02) * 20) * 1.5, y + s * 6 * u, 3 * u, [255, 220, 160], .5 * (1 - s / 6));
    } else {
      var tau = ph - rise, fade = clamp(1 - tau / 1.9, 0, 1);
      if (tau < .25) glow(ctx, tx, ty, 120 * u * (tau / .25), col, .25 * (1 - tau / .25));
      for (var r = 0; r < NR; r++) {
        var a = r / NR * TAU + h1(i + n) * .3, v = (90 + h1(r * 1.7 + n) * 40) * u;
        // 6-step trail as a fading streak, bright head
        for (var s2 = TR; s2 >= 0; s2--) {
          var ta = Math.max(0, tau - (s2 + 1) * .05), tb = Math.max(0, tau - s2 * .05);
          var da = v * ta * (1 - ta * .25), db = v * tb * (1 - tb * .25);
          ctx.strokeStyle = rgba(col, fade * .55 * (1 - s2 / 6)); ctx.lineWidth = (1.8 - s2 * .2) * u;
          ctx.beginPath(); ctx.moveTo(tx + Math.cos(a) * da, ty + Math.sin(a) * da + 22 * u * ta * ta); ctx.lineTo(tx + Math.cos(a) * db, ty + Math.sin(a) * db + 22 * u * tb * tb); ctx.stroke();
        }
        var dh = v * tau * (1 - tau * .25); ctx.fillStyle = rgba([255, 250, 230], fade * .9); ctx.fillRect(tx + Math.cos(a) * dh - u, ty + Math.sin(a) * dh + 22 * u * tau * tau - u, 2 * u, 2 * u);
        if (r % 4 === 0) glow(ctx, tx + Math.cos(a) * v * tau * (1 - tau * .25), ty + Math.sin(a) * v * tau * (1 - tau * .25) + 22 * u * tau * tau, 7 * u, col, .25 * fade);
      }
    }
    ctx.restore();
  }
  function catenary(x0, x1, y, sag, k) { var x = lerp(x0, x1, k); return [x, y + sag * 4 * k * (1 - k)]; }
  function diwali(ctx, W, H, t, o) {
    var u = Math.min(H / 640, W / 480), cam = { u: u, mx: o.mx || 0, my: o.my || 0, tc: o.tc }, flick = noise(t * 6), S = o.pass !== "fx", D = o.pass !== "bg", lite = !!o.lite;
    if (S) { var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#0B0B2A"); sky.addColorStop(.6, "#2A1240"); sky.addColorStop(1, "#5A2340");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H); }
    if (D) layer(ctx, W, H, t, .15, cam, function () { stars(ctx, W, H, t, lite ? 50 : 90, .5); for (var i = 0; i < (lite ? 2 : 4); i++) firework(ctx, W, H, t, i, u, lite); });
    // street of houses
    layer(ctx, W, H, t, .45, cam, function () {
      var n = Math.max(5, Math.round(W / (150 * u))), bw = W / n * 1.02;
      for (var i = 0; i < n; i++) {
        var x = i * W / n, h = (190 + h1(i * 3.7) * 120) * u, top = H * .9 - h, c = ["#2A1830", "#331C38", "#25142B"][i % 3];
        if (S) { ctx.fillStyle = c; ctx.fillRect(x, top, bw, h);
          ctx.fillStyle = "#1C0F22"; ctx.fillRect(x - 4 * u, top - 8 * u, bw + 8 * u, 10 * u); }
        if (D) for (var r = 0; r < 3; r++) for (var cl = 0; cl < 3; cl++) {
          var on = h1(i * 31 + r * 7 + cl + Math.floor(t * .5 + h1(i + r + cl) * 3)) > .35, wx = x + bw * (.18 + cl * .26), wy = top + 26 * u + r * 52 * u;
          if (wy > H * .82) continue;
          if (on) glow(ctx, wx + 9 * u, wy + 12 * u, 26 * u, [255, 180, 80], .3);
          ctx.fillStyle = on ? "#FFC870" : "#1A0E1E"; ctx.fillRect(wx, wy, 18 * u, 24 * u);
        }
        // three jhalar lines with chasing bulbs
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (var L = 0; L < 3; L++) {
          var y0 = top + (10 + L * 34) * u, sag = (14 + L * 3) * u, cols = [[255, 200, 80], [255, 90, 140], [120, 200, 255]];
          if (S) { ctx.strokeStyle = "rgba(60,40,40,.6)"; ctx.lineWidth = 1; ctx.beginPath();
            for (var s = 0; s <= 12; s++) { var p = catenary(x, x + bw, y0, sag, s / 12); s ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke(); }
          if (D) for (var b = 0; b < 12; b++) { var q = catenary(x, x + bw, y0, sag, (b + .5) / 12), on2 = ((b + L - Math.floor(t * 6)) % 4 + 4) % 4 === 0 ? 1 : .45;
            glow(ctx, q[0], q[1], 7 * u, cols[(b + L) % 3], .55 * on2); ctx.fillStyle = rgba(cols[(b + L) % 3], on2); ctx.beginPath(); ctx.arc(q[0], q[1], 1.6 * u, 0, TAU); ctx.fill(); }
        }
        ctx.restore();
      }
    });
    // ground, rangoli, diyas
    layer(ctx, W, H, t, .8, cam, function () {
      var rx = W * .5, R = Math.min(W * .22, 170 * u);
      if (S) {
      var g = ctx.createLinearGradient(0, H * .88, 0, H); g.addColorStop(0, "#2A1420"); g.addColorStop(1, "#140910"); ctx.fillStyle = g; ctx.fillRect(-40, H * .88, W + 80, H * .2);
      var rx = W * .5, ry = H * .955, R = Math.min(W * .22, 170 * u), cols = ["#E8456B", "#F6B33C", "#3FA7D6", "#8E5BD9", "#F2F0E6"];
      ctx.save(); ctx.translate(rx, ry); ctx.scale(1, .22); ctx.globalAlpha = .55;
      for (var k = 5; k >= 1; k--) { ctx.fillStyle = cols[k % 5]; ctx.beginPath(); for (var p = 0; p < 16; p++) { var a = p / 16 * TAU, rr = R * k / 5 * (p % 2 ? .82 : 1); p ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
      ctx.restore();
      }
      var nd = Math.max(7, Math.round(W / (70 * u)));
      for (var d = 0; d < nd; d++) { var dx = (d + .5) * W / nd, dy = H * .93 + (d % 2) * 4 * u;
        if (Math.abs(dx - rx) < R * .9) dy = H * .985;
        if (S) { ctx.fillStyle = "#8A4A2A"; ctx.beginPath(); ctx.ellipse(dx, dy, 9 * u, 4 * u, 0, 0, Math.PI); ctx.fill(); }
        if (D) { ctx.save(); ctx.globalCompositeOperation = "lighter"; flame(ctx, dx, dy - 1 * u, 2.6 * u, t, d); ctx.restore(); } }
    });
    // sparks + smoke + bokeh
    if (!D) { post(ctx, W, H, t, [255, 160, 70], .5, o); return; }
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    var nS = lite ? 30 : o.half ? 30 : 60;
    for (var i = 0; i < nS; i++) {
      var life = 1.4 + h1(i * 3.3) * 1.6, age = (t + h1(i * 7.1) * life) % life, k = age / life, nd2 = Math.max(7, Math.round(W / (70 * u)));
      var x = (Math.floor(h1(i * 2.2) * nd2) + .5) * W / nd2 + Math.sin(age * 3 + i) * 10 * u, y = H * .92 - age * (40 + h1(i) * 50) * u;
      var c = mix([255, 230, 150], [230, 70, 30], k); glow(ctx, x, y, 5 * u, c, .3 * (1 - k)); ctx.fillStyle = rgba(c, 1 - k); ctx.fillRect(x, y, 1.6 * u, 1.6 * u);
    }
    ctx.restore();
    for (var j = 0; j < (lite ? 6 : 14); j++) { var l2 = 7 + h1(j * 5) * 4, a2 = (t + h1(j * 11) * l2) % l2, k2 = a2 / l2, sx = h1(j * 3) * W, sy = H * .9 - a2 * 16 * u, rr = (20 + a2 * 14) * u;
      glow(ctx, sx, sy, rr, [150, 130, 150], .08 * (1 - k2)); }
    bokeh(ctx, W, H, t, u, [255, 190, 110]);
    post(ctx, W, H, t, [255, 160, 70], flick, o);
  }


  // ---------- daylight hill scenes: Phool Dei (spring), Harela (monsoon green), Ghughutiya (winter dawn) ----------
  var DAY = {
    phooldei:   { sky: ["#BFDFFB", "#E4F1FC", "#FFF0E2"], sun: [.78, .2, [255, 246, 220]], far: ["#8FA6B8", "#6E8C80"], snow: true, snowBody: ["#C6CCE4", "#AEB6D2", "#9AA3C4"], mid: ["#7FA86A", "#4E7A48"], tree: "#3E6B3E", bloom: true,
                  ground: ["#6E9A55", "#4C7438"], near: "#3F6630", fig: "#3B2A33", warm: [255, 210, 170], parts: "petals" },
    harela:     { sky: ["#A9D6E6", "#DCEFE6", "#F2F0D6"], sun: [.2, .16, [255, 250, 225]], far: ["#9BB8B4", "#7D9F92"], snow: false, mid: ["#5E9B4E", "#3E7A36"], tree: "#2F5E2C", bloom: false,
                  ground: ["#7DB24F", "#4F8A33"], near: "#3B6A2A", fig: "#33282C", warm: [240, 230, 160], parts: "leaves", terraces: true },
    ghughutiya: { sky: ["#F4B98E", "#FBDDBE", "#E3E0F1"], sun: [.72, .3, [255, 214, 160]], far: ["#A496B4", "#857898"], snow: true, snowBody: ["#D6C9DE", "#BFB1CC", "#AE9FBE"], mid: ["#8E8AA5", "#5E5A78"], tree: "#4A4560", bloom: false,
                  ground: ["#B7A99B", "#8A7C72"], near: "#6E6060", fig: "#2E2630", warm: [255, 190, 140], parts: "crows", rays: true }
  };
  function crow(ctx, x, y, s, t, i, col) {
    var f = Math.sin(t * 9 + i) * .8; ctx.strokeStyle = col; ctx.lineWidth = s * .28; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(x - s * 1.6, y - s * f); ctx.quadraticCurveTo(x - s * .6, y - s * .3, x, y); ctx.quadraticCurveTo(x + s * .6, y - s * .3, x + s * 1.6, y - s * f); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y + s * .1, s * .45, s * .22, 0, 0, TAU); ctx.fill();
  }
  function petal(ctx, x, y, r, a, col) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r * .8, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  function dayScene(key) { return function (ctx, W, H, t, o) {
    SHADE = .35;
    var P = DAY[key], u = Math.min(H / 640, W / 480), cam = { u: u, mx: o.mx || 0, my: o.my || 0, tc: o.tc }, flick = noise(t * 2), S = o.pass !== "fx", D = o.pass !== "bg", lite = !!o.lite;
    var sx = W * P.sun[0], sy = H * P.sun[1], hx = W * (W > 900 ? .72 : .7), hy = H * .84, hw = 140 * u, hh = 78 * u;
    if (S) {
    var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, P.sky[0]); sky.addColorStop(.55, P.sky[1]); sky.addColorStop(1, P.sky[2]); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    layer(ctx, W, H, t, .15, cam, function () {
      if (P.rays) { ctx.save(); ctx.globalCompositeOperation = "lighter"; for (var r = 0; r < 9; r++) { var a = -Math.PI * .95 + r / 8 * Math.PI * .9 + Math.sin(t * .2 + r) * .02;
        ctx.fillStyle = "rgba(255,225,180," + (.05 + .03 * Math.sin(t * .6 + r)).toFixed(3) + ")"; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a - .05) * W, sy + Math.sin(a - .05) * W); ctx.lineTo(sx + Math.cos(a + .05) * W, sy + Math.sin(a + .05) * W); ctx.fill(); } ctx.restore(); }
      glow(ctx, sx, sy, 160 * u, P.sun[2], .45); glow(ctx, sx, sy, 50 * u, [255, 255, 245], .8);
      ctx.fillStyle = "rgba(255,255,250,.95)"; ctx.beginPath(); ctx.arc(sx, sy, 20 * u, 0, TAU); ctx.fill();
      for (var c = 0; c < 4; c++) { var cw = (120 + h1(c * 3) * 120) * u, cx = ((h1(c * 5) * (W + cw) + t * (5 + c * 2) * u) % (W + cw * 2)) - cw, cy = H * (.12 + h1(c * 7) * .18);
        for (var b = 0; b < 4; b++) glow(ctx, cx + (b - 1.5) * cw * .25, cy + Math.sin(b) * 6 * u, cw * .32, [255, 255, 255], .55); }
    });
    layer(ctx, W, H, t, .3, cam, function () {
      if (P.snow) range(ctx, W, H, H * .62, H * .3, 2.6, 4.1, null, null, true, sx, P.snowBody);
      var far = range(ctx, W, H, H * .66, H * .18, 3, 9.2, P.far[0], P.far[1], false, sx);
      ctx.save(); ctx.globalAlpha = .55; mist(ctx, W, H, t, H * .68, 3, .35, u); ctx.restore();
    });
    layer(ctx, W, H, t, .45, cam, function () {
      range(ctx, W, H, H * .8, H * .14, 1.8, 13.7, P.mid[0], P.mid[1], false, sx);
      for (var i = 0; i < 26; i++) { var x = h1(i * 2.3) * W, y = ridge(x, W, H * .8, H * .14, 1.8, 13.7) + 6 * u, h = (30 + h1(i * 5.9) * 40) * u;
        if (P.bloom && i % 4 === 0) { ctx.fillStyle = "#6B4A3A"; ctx.fillRect(x - h * .03, y - h * .5, h * .06, h * .5);
          for (var k = 0; k < 7; k++) glow(ctx, x + (h1(i * 9 + k) - .5) * h * .6, y - h * (.5 + h1(i * 3 + k) * .35), h * .22, k % 2 ? [255, 160, 190] : [255, 205, 220], .9); }
        else deodar(ctx, x, y, h, t, i, P.tree); }
    });
    layer(ctx, W, H, t, .7, cam, function () {
      var g = ctx.createLinearGradient(0, H * .78, 0, H); g.addColorStop(0, P.ground[0]); g.addColorStop(1, P.ground[1]); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-40, H); ctx.lineTo(-40, H * .86); for (var x = -40; x <= W + 40; x += 12) ctx.lineTo(x, H * .86 - 22 * u * Math.sin(x / W * 3.1 + .4) - 10 * u * fbm(x / W * 6 + 3)); ctx.lineTo(W + 40, H); ctx.closePath(); ctx.fill();
      if (P.terraces) for (var tr = 0; tr < 5; tr++) { var ty = H * (.86 + tr * .028); ctx.strokeStyle = "rgba(40,80,30,.35)"; ctx.lineWidth = 2 * u; ctx.beginPath();
        for (var x2 = -40; x2 <= W * .55; x2 += 10) { var yy = ty - 14 * u * Math.sin(x2 / W * 3 + tr * .3); x2 === -40 ? ctx.moveTo(x2, yy) : ctx.lineTo(x2, yy); } ctx.stroke();
        ctx.fillStyle = "rgba(170,220,110,.25)"; for (var x3 = 0; x3 < W * .55; x3 += 9 * u) { var gy = ty - 14 * u * Math.sin(x3 / W * 3 + tr * .3); ctx.fillRect(x3 + Math.sin(t * 2 + x3) * 1.2, gy - 5 * u, 1.4 * u, 5 * u); } }
      ctx.fillStyle = "#8C7B70"; ctx.fillRect(hx - hw / 2, hy - hh, hw, hh);
      ctx.strokeStyle = "rgba(60,45,40,.35)"; ctx.lineWidth = 1; for (var r = 0; r < 6; r++) for (var cc = 0; cc < 8; cc++) ctx.strokeRect(hx - hw / 2 + (cc + (r % 2) * .5) * hw / 8, hy - hh + r * hh / 6, hw / 8, hh / 6);
      ctx.fillStyle = "#5A5560"; ctx.beginPath(); ctx.moveTo(hx - hw * .62, hy - hh); ctx.lineTo(hx - hw * .38, hy - hh - 40 * u); ctx.lineTo(hx + hw * .38, hy - hh - 40 * u); ctx.lineTo(hx + hw * .62, hy - hh); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(220,215,225,.4)"; for (var s2 = 1; s2 < 7; s2++) { var ry = hy - hh - s2 * 6 * u, k2 = s2 / 7; ctx.beginPath(); ctx.moveTo(hx - hw * (.62 - .24 * k2), ry); ctx.lineTo(hx + hw * (.62 - .24 * k2), ry); ctx.stroke(); }
      ctx.fillStyle = "#4A3428"; [[-.3, .55], [.3, .55]].forEach(function (p) { ctx.fillRect(hx + p[0] * hw - 9 * u, hy - hh * p[1] - 11 * u, 18 * u, 20 * u); });
      ctx.fillStyle = "#6B4A34"; ctx.fillRect(hx - 11 * u, hy - 38 * u, 22 * u, 38 * u);
      ctx.fillStyle = "#C9B8A6"; ctx.fillRect(hx - 22 * u, hy - 3 * u, 44 * u, 5 * u);   // dehri (threshold)
      if (key === "phooldei") for (var f = 0; f < 14; f++) glow(ctx, hx - 18 * u + f * 2.8 * u, hy - 3 * u + (f % 2) * 2 * u, 3 * u, f % 3 === 0 ? [255, 210, 40] : f % 3 === 1 ? [255, 110, 150] : [255, 255, 255], 1);
    });
    layer(ctx, W, H, t, 1, cam, function () {
      ctx.fillStyle = P.near; ctx.beginPath(); ctx.moveTo(-40, H + 10); for (var x = -40; x <= W + 40; x += 14) ctx.lineTo(x, H * .94 - 10 * u * Math.sin(x / W * 4 + 1)); ctx.lineTo(W + 40, H + 10); ctx.closePath(); ctx.fill();
      for (var gx = 0; gx < W; gx += 7 * u) { var gy = H * .94 - 10 * u * Math.sin(gx / W * 4 + 1), sw = Math.sin(t * 2.2 + gx * .05) * 3 * u;
        ctx.strokeStyle = "rgba(20,40,15,.35)"; ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.moveTo(gx, gy + 2); ctx.quadraticCurveTo(gx + sw * .5, gy - 6 * u, gx + sw, gy - 11 * u * (.6 + h1(gx) * .6)); ctx.stroke(); }
    });
    }
    if (!D) { dayPost(ctx, W, H, t, P, .5); return; }
    layer(ctx, W, H, t, 1, cam, function () {
      var base = H * .955, ph = H * .16, kids = [W * .16, W * .3, W * .46];
      kids.forEach(function (kx, i) {
        var bob = Math.abs(Math.sin(t * 3 + i * 1.4)) * 4 * u, x = kx + Math.sin(t * .4 + i) * 6 * u, h = ph * (i === 1 ? .9 : .7);
        if (key === "harela") {   // planting: bent arm to a sapling
          person(ctx, x, base, h, P.fig, [x + h * .3, base - h * .12], 0, { g: i % 2 ? "kid" : "kidg", rim: [255, 240, 210], side: 1, t: t, i: i });
          ctx.strokeStyle = "#2E6A24"; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(x + h * .32, base); ctx.lineTo(x + h * .32, base - h * .22); ctx.stroke();
          for (var l = 0; l < 3; l++) petal(ctx, x + h * .32 + (l - 1) * 4 * u, base - h * (.18 + l * .04), 3 * u, (l - 1) * .8 + Math.sin(t * 2 + i) * .2, "#4FA33A");
        } else if (key === "phooldei") {   // basket of flowers in hand
          person(ctx, x, base, h, P.fig, [x + h * .22, base - h * .5], bob, { g: i % 2 ? "kid" : "kidg", rim: [255, 240, 210], side: 1, t: t, i: i });
          var bx = x + h * .26, by = base - h * .46 - bob; ctx.fillStyle = "#A0703F"; ctx.beginPath(); ctx.ellipse(bx, by, h * .14, h * .07, 0, 0, Math.PI); ctx.fill();
          ctx.strokeStyle = "#A0703F"; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.arc(bx, by, h * .14, Math.PI, 0); ctx.stroke();
          for (var fl = 0; fl < 6; fl++) glow(ctx, bx + (fl - 2.5) * h * .045, by - 2 * u, 3.5 * u, fl % 2 ? [255, 200, 40] : [255, 110, 150], 1);
        } else {   // ghughutiya: arms up calling crows, mala on the neck
          person(ctx, x, base, h, P.fig, null, bob, { g: i % 2 ? "kid" : "kidg", rim: [255, 220, 180], side: 1, t: t, i: i });
          for (var m = 0; m < 7; m++) { var a = Math.PI * .15 + m / 6 * Math.PI * .7; ctx.fillStyle = "#C98A4B"; ctx.beginPath(); ctx.arc(x + Math.cos(a) * h * .11, base - bob - h * .76 + Math.sin(a) * h * .1, 2.2 * u, 0, TAU); ctx.fill(); }
        }
      });
    });
    // particles
    var n = lite ? 30 : o.half ? 30 : 60;
    if (P.parts === "petals" || P.parts === "leaves") for (var i = 0; i < n; i++) {
      var life = 6 + h1(i * 3.3) * 5, age = (t + h1(i * 7.1) * life) % life, k = age / life;
      var x = h1(i * 2.7) * W + Math.sin(age * 1.3 + i) * 30 * u + age * 10 * u, y = -10 + k * (H + 20);
      var col = P.parts === "petals" ? [["#FF8FB1", "#FFD23F", "#FFFFFF", "#F25C8A"][i % 4]][0] : ["#5FA83E", "#8BC34A", "#3E8A2E"][i % 3];
      ctx.globalAlpha = .85; petal(ctx, x, y, (2.2 + h1(i) * 2) * u, age * 2 + i, col); ctx.globalAlpha = 1;
    }
    if (P.parts === "crows") for (var c2 = 0; c2 < 8; c2++) {
      var lf = 9 + h1(c2 * 4) * 5, ag = (t + h1(c2 * 6) * lf) % lf, kk = ag / lf, dir = c2 % 2 ? 1 : -1;
      var cx2 = dir > 0 ? -40 + kk * (W + 80) : W + 40 - kk * (W + 80), cy2 = H * (.2 + h1(c2 * 8) * .3) + Math.sin(ag * 1.5 + c2) * 12 * u;
      crow(ctx, cx2, cy2, (6 + h1(c2) * 4) * u, t, c2, "#2B2430");
    }
    if (P.parts === "crows") for (var d = 0; d < (lite ? 15 : 30); d++) { var x5 = h1(d * 3) * W + Math.sin(t * .3 + d) * 20 * u, y5 = H * (.4 + h1(d * 5) * .5) + Math.cos(t * .25 + d) * 10 * u; ctx.fillStyle = "rgba(255,240,220,.5)"; ctx.fillRect(x5, y5, 1.5 * u, 1.5 * u); }
    if (!S) return;   // fx pass: the light post is already in the cached layer
    dayPost(ctx, W, H, t, P, flick);
  }; }
  // light post: soft vignette, warm wash, grain
  function dayPost(ctx, W, H, t, P, flick) {
    var v = ctx.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .4, W / 2, H * .55, Math.max(W, H) * .85); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(30,20,30,.28)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = rgba(P.warm, .12 + .04 * flick); ctx.fillRect(0, 0, W, H); ctx.restore();
    grain(ctx, W, H, t);
  }

  // ---------- CHHATH (sunset ghat: the sinking sun on the river, arghya, floating diyas) ----------
  function soopPerson(ctx, x, y, h, col, t, i, sunX) {
    // standing waist-deep in a saree, both hands raised holding the soop (winnow) towards the sun
    var sx = x + h * .2 * (sunX < x ? -1 : 1), sy = y - h * 1.08;
    human(ctx, x, y, h, col, { g: "saree", arm: [sx + h * .04 * (sunX < x ? 1 : -1), sy + h * .05], arm2: [sx - h * .1 * (sunX < x ? -1 : 1), sy + h * .05],
      rim: [255, 170, 100], side: sunX < x ? -1 : 1, t: t, i: i, flat: true });
    ctx.fillStyle = "#3A1F14"; ctx.beginPath(); ctx.ellipse(sx - h * .04 * (sunX < x ? -1 : 1), sy, h * .17, h * .05, -.15, 0, TAU); ctx.fill();
    return [sx, sy - h * .03];
  }
  function chhath(ctx, W, H, t, o) {
    var u = Math.min(H / 640, W / 480), cam = { u: u, mx: 0, my: 0, tc: o.tc }, S = o.pass !== "fx", D = o.pass !== "bg", lite = !!o.lite;
    var wide = W > 900, hz = H * .6, sunX = W * (wide ? .5 : .5), sunY = hz - 26 * u, sunR = 42 * u;   // wide: the sun sits in the gap between the text and the phones
    if (S) {
      var sky = ctx.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, "#2A1238"); sky.addColorStop(.45, "#7A2E4A"); sky.addColorStop(.8, "#E0663A"); sky.addColorStop(1, "#FFB46A");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);
      // the sun, half a disc above the far bank, with a wide warm glow
      glow(ctx, sunX, sunY, sunR * 9, [255, 140, 70], .35); glow(ctx, sunX, sunY, sunR * 3.2, [255, 200, 120], .55);
      ctx.fillStyle = "#FFE3A3"; ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,170,90,.35)"; ctx.beginPath(); ctx.arc(sunX, sunY, sunR * .82, 0, TAU); ctx.fill();
      // thin clouds across the sun
      for (var k = 0; k < 5; k++) { var cy = H * (.14 + k * .07), cw = W * (.35 + h1(k * 3) * .4), cx = h1(k * 7) * W;
        ctx.fillStyle = "rgba(255,190,150," + (.10 + .05 * h1(k)) + ")"; ctx.beginPath(); ctx.ellipse(cx, cy, cw / 2, 3 * u + h1(k * 5) * 4 * u, 0, 0, TAU); ctx.fill(); }
      // far bank: trees and a temple shikhar, dark against the sky
      ctx.fillStyle = "#2A1424"; ctx.beginPath(); ctx.moveTo(-10, hz + 2);
      for (var x = -10; x <= W + 10; x += 6) ctx.lineTo(x, hz - 6 * u - 16 * u * Math.pow(fbm(x / W * 7 + 3, 4), 1.4) * 2);
      ctx.lineTo(W + 10, hz + 2); ctx.closePath(); ctx.fill();
      var tx = W * .2; ctx.beginPath(); ctx.moveTo(tx - 14 * u, hz - 8 * u); ctx.lineTo(tx - 9 * u, hz - 34 * u); ctx.lineTo(tx, hz - 52 * u); ctx.lineTo(tx + 9 * u, hz - 34 * u); ctx.lineTo(tx + 14 * u, hz - 8 * u); ctx.fill();
      ctx.fillRect(tx - 1, hz - 62 * u, 2, 11 * u);
      // river
      var wv = ctx.createLinearGradient(0, hz, 0, H); wv.addColorStop(0, "#C9603C"); wv.addColorStop(.35, "#6B2A3E"); wv.addColorStop(1, "#221024");
      ctx.fillStyle = wv; ctx.fillRect(0, hz, W, H - hz);
      // ghat steps, bottom left
      for (var st = 0; st < 5; st++) { var sy = H * .84 + st * H * .035; ctx.fillStyle = st % 2 ? "#3B2230" : "#4A2C38";
        ctx.beginPath(); ctx.moveTo(-10, sy); ctx.lineTo(W * (.36 - st * .03), sy); ctx.lineTo(W * (.36 - st * .03) + 8 * u, sy + H * .035); ctx.lineTo(-10, sy + H * .035); ctx.fill(); }
      // kosi: sugarcane canopy with a pot, on the steps
      var kx = W * (wide ? .42 : .1), ky = H * .845;
      ctx.strokeStyle = "#2E5A23"; ctx.lineWidth = 3 * u; ctx.beginPath();
      for (var c4 = 0; c4 < 4; c4++) { var bx = kx + (c4 - 1.5) * 16 * u; ctx.moveTo(bx, ky); ctx.lineTo(kx + (c4 - 1.5) * 4 * u, ky - 78 * u); } ctx.stroke();
      ctx.strokeStyle = "#3F7A2E"; ctx.lineWidth = 1.6 * u; ctx.beginPath();
      for (var lf = 0; lf < 8; lf++) { var lx = kx + (lf - 3.5) * 5 * u; ctx.moveTo(kx, ky - 76 * u); ctx.quadraticCurveTo(lx, ky - 100 * u, lx + (lf - 3.5) * 6 * u, ky - 84 * u); } ctx.stroke();
      ctx.fillStyle = "#8A3A1E"; ctx.beginPath(); ctx.ellipse(kx, ky - 6 * u, 13 * u, 9 * u, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#F4C542"; ctx.beginPath(); ctx.ellipse(kx, ky - 13 * u, 9 * u, 3 * u, 0, 0, TAU); ctx.fill();
    }
    if (!D) { post(ctx, W, H, t, [255, 150, 90], .5, o); return; }
    // the sun's path on the water: shimmering streaks
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    var nL = lite ? 26 : 44;
    for (var i = 0; i < nL; i++) {
      var k2 = i / nL, y = hz + 3 + Math.pow(k2, 1.6) * (H - hz) * .92, wdt = (14 + k2 * 120) * u * (.6 + .4 * noise(t * 1.3 + i * 3.1));
      var off = Math.sin(t * 1.7 + i * 1.9) * 6 * u * (1 + k2 * 2);
      ctx.fillStyle = rgba([255, 205, 130], (.55 - k2 * .4) * (.5 + .5 * noise(t * 2.1 + i)));
      ctx.fillRect(sunX - wdt / 2 + off, y, wdt, (1.2 + k2 * 2.5) * u);
    }
    ctx.restore();
    // gentle ripples across the river
    ctx.strokeStyle = "rgba(255,190,150,.10)"; ctx.lineWidth = 1;
    for (var r = 0; r < (lite ? 6 : 10); r++) { var ry = hz + 12 * u + h1(r * 3) * (H - hz) * .8, rx = ((h1(r * 5) * W + t * (8 + r) * u) % (W + 120)) - 60;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx + 20 * u, ry - 2 * u, rx + 40 * u, ry); ctx.stroke(); }
    // floating diyas, drifting and bobbing, each with its reflection
    var nd = lite ? 7 : 11;
    for (var d = 0; d < nd; d++) {
      var dk = h1(d * 7.3), dy = hz + 20 * u + dk * (H * .82 - hz - 20 * u), sc = .55 + dk * .7;
      var dx = ((h1(d * 3.1) * (W + 80) + t * (5 + h1(d) * 6) * u) % (W + 80)) - 40, bob = Math.sin(t * 1.6 + d * 2) * 1.6 * u;
      glow(ctx, dx, dy + 6 * u * sc, 16 * u * sc, [255, 150, 60], .25);   // reflection
      ctx.fillStyle = "#7A3418"; ctx.beginPath(); ctx.ellipse(dx, dy + bob, 6 * u * sc, 2.4 * u * sc, 0, 0, Math.PI); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = "lighter"; flame(ctx, dx, dy + bob - 1, 1.6 * u * sc, t, d); ctx.restore();
    }
    // people in the water offering arghya: water pours from the lota in a thin arc
    var base = hz + (H - hz) * .55, ph = H * .2, ppl = wide ? [W * .5, W * .955] : [W * .2, W * .9];
    var col = "#1C0C18";
    for (var p = 0; p < ppl.length; p++) {
      var hgt = ph * (p === 1 ? .95 : .85), px = ppl[p], py = base + p * 4 * u;
      // standing in the river: only the part above the water line is drawn, plus a faint reflection below
      var wl = py - hgt * .38;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, wl); ctx.clip(); var hand = soopPerson(ctx, px, py, hgt, col, t, p, sunX); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, wl, W, hgt * .5); ctx.clip(); ctx.globalAlpha = .12; ctx.translate(0, wl * 2); ctx.scale(1, -1);
      soopPerson(ctx, px, py, hgt, col, t, p, sunX); ctx.restore();
      ctx.strokeStyle = "rgba(255,200,150,.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px, py - hgt * .38, hgt * .22 * (1 + .05 * Math.sin(t * 2 + p)), hgt * .03, 0, 0, TAU); ctx.stroke();
      // the arghya stream
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (var q = 0; q < (lite ? 8 : 14); q++) { var a = ((t * .9 + q / 14 + p * .3) % 1), wx = hand[0] + a * hgt * .12, wy = hand[1] + a * a * hgt * .7;
        glow(ctx, wx, wy, 2.6 * u, [255, 220, 170], .55 * (1 - a)); }
      ctx.restore();
      // a diya on the soop
      ctx.save(); ctx.globalCompositeOperation = "lighter"; flame(ctx, hand[0] - hgt * .1, hand[1] - 1, 1.3 * u, t, p + 20); ctx.restore();
    }
    // birds heading home across the sun
    ctx.strokeStyle = "rgba(30,12,24,.8)"; ctx.lineWidth = 1.4 * u; ctx.lineCap = "round";
    for (var b = 0; b < (lite ? 4 : 7); b++) { var bl = 16 + h1(b * 4) * 8, ba = ((t + h1(b * 6) * bl) % bl) / bl, bx = W + 30 - ba * (W + 60), by = H * (.2 + h1(b * 8) * .2) + Math.sin(ba * 6 + b) * 8 * u, bs = (4 + h1(b) * 3) * u, f = Math.sin(t * 7 + b) * .7;
      ctx.beginPath(); ctx.moveTo(bx - bs * 1.4, by - bs * f); ctx.quadraticCurveTo(bx - bs * .5, by - bs * .3, bx, by); ctx.quadraticCurveTo(bx + bs * .5, by - bs * .3, bx + bs * 1.4, by - bs * f); ctx.stroke(); }
    // warm motes over the water
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var m = 0; m < (lite ? 18 : 34); m++) { var ml = 5 + h1(m * 2) * 4, ma = (t + h1(m * 9) * ml) % ml, mk = ma / ml, mx2 = h1(m * 3.7) * W + Math.sin(ma + m) * 14 * u, my2 = H * .95 - ma * 22 * u;
      glow(ctx, mx2, my2, 3.4 * u, [255, 190, 110], .45 * Math.sin(mk * Math.PI)); }
    ctx.restore();
  }

  var SCENES = { igas: igas, diwali: diwali, chhath: chhath, phooldei: dayScene("phooldei"), harela: dayScene("harela"), ghughutiya: dayScene("ghughutiya") };
  var E = {
    has: function (k) { return !!SCENES[k]; },
    draw: function (ctx, W, H, t, k, o) { (SCENES[k] || igas)(ctx, W, H, t, o || {}); },
    // run on a canvas. Phone-friendly:
    //  - still layers drawn once into an offscreen canvas (again only on resize); each frame = drawImage + the moving parts
    //  - backing store: devicePixelRatio max 1.5 (phones: 1); the canvas is stretched by CSS
    //  - 30 fps cap; after 8 s it keeps going at 20 fps (never freezes while on screen)
    //  - stops when off screen (IntersectionObserver) or the tab is hidden
    //  - low-end (≤ 4 cores, ≤ 3 GB, Save-Data) or reduced motion → one still frame, no loop
    run: function (canvas, k, opt) {
      opt = opt || {};
      var nav = navigator, conn = nav.connection || {};
      var phone = Math.min(screen.width || 9999, innerWidth) < 600 || /Mobi|Android/i.test(nav.userAgent);
      // iPhone / iPad Safari reports few cores on purpose (privacy), so cores only count on Android / desktop
      var apple = /iPhone|iPad|iPod|Macintosh/.test(nav.userAgent);
      var low = (!apple && nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3) || conn.saveData;
      var still = opt.still || low || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
      var dpr = phone ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      var ctx = canvas.getContext("2d"), W = 0, H = 0, raf = 0, played = 0, last = 0, o = { mx: 0, my: 0, tc: 2.2, lite: true };
      var bg = document.createElement("canvas"), bctx = bg.getContext("2d"), visible = true, done = false, STEP = 1000 / 30, STEP_CALM = 1000 / 20, PLAY = 8;
      function size() {
        var b = canvas.getBoundingClientRect(); W = b.width; H = b.height; if (!W || !H) return;
        canvas.width = bg.width = Math.round(W * dpr); canvas.height = bg.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        bctx.setTransform(dpr, 0, 0, dpr, 0, 0); o.pass = "bg"; E.draw(bctx, W, H, 2.2, k, o);   // still layers, once
      }
      function paint(t) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bg, 0, 0); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        o.pass = "fx"; o.half = t > 8; E.draw(ctx, W, H, t, k, o);
      }
      function frame(now) {
        raf = 0; if (done || !visible || document.hidden) return;
        if (!last) last = now;
        var dt = now - last;
        var step = played >= PLAY ? STEP_CALM : STEP;   // after 8 s it keeps moving, a little calmer (saves battery)
        if (dt >= step) { played += Math.min(dt, 100) / 1000; last = now - (dt % step); paint(played); }
        raf = requestAnimationFrame(frame);
      }
      function go() { if (!raf && !done && !still && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
      function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
      size();
      if (still) { paint(2.2); addEventListener("resize", function () { size(); paint(2.2); }); return; }
      paint(0);
      addEventListener("resize", function () { size(); paint(played); });
      // (no mouse parallax: the still layers are cached, so the camera stays put)
      document.addEventListener("visibilitychange", function () { document.hidden ? stop() : go(); });
      if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; visible ? go() : stop(); }).observe(canvas);
      go();
    }
  };
  window.GBFestEngine = E;
})();
