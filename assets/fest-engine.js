// Gali Bazaar — festival scene engine (the same algorithm is ported to the app: FestEngine.kt).
// draw(ctx, W, H, t, key, opt) is deterministic: the same t gives the same frame (no state, no Math.random).
// Layers back → front, each with its own parallax depth (0.15 / 0.45 / 0.7 / 1.0), a slow camera drift sin(t·0.35)
// and a light zoom-in. Particles are functions of t (birth = floor((t+off)/life)), so a still frame (t = 2.2 s) is exact.
// Original drawing only: faceless silhouettes, no copyrighted art. Logo colours are never touched (the logo is HTML).
(function () {
  "use strict";
  var TAU = Math.PI * 2;
  // ---------- deterministic helpers ----------
  function h1(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function noise(x) { var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; }
  function fbm(x, o) { var v = 0, a = .5, fq = 1; for (var k = 0; k < (o || 5); k++) { v += a * noise(x * fq + k * 17.3); fq *= 2.03; a *= .5; } return v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")"; }
  function mix(c1, c2, k) { return [Math.round(lerp(c1[0], c2[0], k)), Math.round(lerp(c1[1], c2[1], k)), Math.round(lerp(c1[2], c2[2], k))]; }
  function hex(s) { var n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function glow(ctx, x, y, r, c, a) { var g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

  // ---------- camera ----------
  function layer(ctx, W, H, t, depth, cam, fn) {
    ctx.save();
    var dx = Math.sin(t * .35) * 14 * cam.u * depth + cam.mx * 10 * depth, dy = cam.my * 4 * depth;
    var z = 1 + .006 * Math.min(t, 10) * depth;
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
  function post(ctx, W, H, t, warm, flick) {
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
  function range(ctx, W, H, base, amp, fq, seed, top, bot, snow, moonX) {
    var step = Math.max(3, W / 260), pts = [];
    for (var x = -40; x <= W + 40; x += step) pts.push([x, ridge(x, W, base, amp, fq, seed)]);
    var minY = Math.min.apply(null, pts.map(function (p) { return p[1]; }));
    var g = ctx.createLinearGradient(0, minY, 0, base + 20);
    if (snow) { g.addColorStop(0, "#8E7FA0"); g.addColorStop(.45, "#6D5A7E"); g.addColorStop(1, "#3A2236"); }
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
      sh.addColorStop(0, "rgba(28,14,38,.38)"); sh.addColorStop(m, "rgba(255,250,240,.06)"); sh.addColorStop(1, "rgba(28,14,38,.22)");
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
      var m = ctx.createRadialGradient(x, yy, 0, x, yy, w * .5); m.addColorStop(0, "rgba(240,215,215," + (a * 1.3) + ")"); m.addColorStop(1, "rgba(240,215,215,0)");
      ctx.save(); ctx.translate(x, yy); ctx.scale(1, .28); ctx.translate(-x, -yy); ctx.fillStyle = m; ctx.beginPath(); ctx.arc(x, yy, w * .5, 0, TAU); ctx.fill(); ctx.restore();
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
  function person(ctx, x, y, h, col, armTo, bounce) {
    y -= bounce || 0;
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x, y - h * .9, h * .085, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - h * .1, y - h * .78); ctx.lineTo(x + h * .1, y - h * .78); ctx.lineTo(x + h * .16, y - h * .32); ctx.lineTo(x - h * .16, y - h * .32); ctx.closePath(); ctx.fill();
    ctx.lineWidth = h * .055; ctx.beginPath(); ctx.moveTo(x - h * .06, y - h * .34); ctx.lineTo(x - h * .08, y); ctx.moveTo(x + h * .06, y - h * .34); ctx.lineTo(x + h * .08, y); ctx.stroke();
    ctx.lineWidth = h * .045; ctx.beginPath();
    if (armTo) { ctx.moveTo(x + h * .08, y - h * .74); ctx.lineTo(armTo[0], armTo[1]); ctx.moveTo(x - h * .08, y - h * .74); ctx.lineTo(x - h * .2, y - h * .5); }
    else { ctx.moveTo(x - h * .08, y - h * .74); ctx.lineTo(x - h * .22, y - h * 1.08); ctx.moveTo(x + h * .08, y - h * .74); ctx.lineTo(x + h * .22, y - h * 1.08); }
    ctx.stroke();
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
    var u = Math.min(H / 640, W / 480), cam = { u: u, mx: o.mx || 0, my: o.my || 0 }, flick = noise(t * 7);
    var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#160B1F"); sky.addColorStop(.55, "#3A1530"); sky.addColorStop(1, "#8C3A1E");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    var moonX = W * .8, moonY = H * .17;
    layer(ctx, W, H, t, .15, cam, function () { stars(ctx, W, H, t, 150, .62); moon(ctx, moonX, moonY, 22 * u); });
    var near = W > 900 ? 1 : 0;
    layer(ctx, W, H, t, .3, cam, function () {
      range(ctx, W, H, H * .58, H * .28, 3.2, 2.1, "#8E9BC4", "#5C5F8E", false, moonX);       // far blue-white range
      ctx.fillStyle = "rgba(200,210,240,.05)"; ctx.fillRect(0, H * .45, W, H * .2);
      range(ctx, W, H, H * .66, H * .3, 2.4, 7.3, null, null, true, moonX);                   // snow peaks
      mist(ctx, W, H, t, H * .67, 3, .09, u);
    });
    layer(ctx, W, H, t, .45, cam, function () {
      var pts = range(ctx, W, H, H * .8, H * .14, 1.8, 13.7, "#3B1C33", "#22101E", false, moonX);
      for (var i = 0; i < 26; i++) {
        var x = h1(i * 2.3) * W, y = ridge(x, W, H * .8, H * .14, 1.8, 13.7) + 6 * u, h = (34 + h1(i * 5.9) * 46) * u;
        deodar(ctx, x, y, h, t, i, i % 3 ? "#1A0C17" : "#24111F");
      }
    });
    // terrace with the pahadi house
    var hx = W * (near ? .7 : .66), hy = H * .84, hw = 150 * u, hh = 84 * u;
    layer(ctx, W, H, t, .7, cam, function () {
      ctx.fillStyle = "#170A14"; ctx.beginPath(); ctx.moveTo(-40, H); ctx.lineTo(-40, H * .86);
      for (var x = -40; x <= W + 40; x += 12) ctx.lineTo(x, H * .86 - 22 * u * Math.sin(x / W * 3.1 + .4) - 10 * u * fbm(x / W * 6 + 3));
      ctx.lineTo(W + 40, H); ctx.closePath(); ctx.fill();
      glow(ctx, hx, hy - hh * .4, hw * 1.6, [255, 150, 60], .16 + .06 * flick);
      ctx.fillStyle = "#4A3A3C"; ctx.fillRect(hx - hw / 2, hy - hh, hw, hh);                       // stone wall
      ctx.strokeStyle = "rgba(20,10,15,.45)"; ctx.lineWidth = 1;
      for (var r = 0; r < 6; r++) for (var c = 0; c < 8; c++) { var bx = hx - hw / 2 + (c + (r % 2) * .5) * hw / 8, by = hy - hh + r * hh / 6; ctx.strokeRect(bx, by, hw / 8, hh / 6); }
      ctx.fillStyle = "#2B2530"; ctx.beginPath(); ctx.moveTo(hx - hw * .62, hy - hh); ctx.lineTo(hx - hw * .38, hy - hh - 42 * u); ctx.lineTo(hx + hw * .38, hy - hh - 42 * u); ctx.lineTo(hx + hw * .62, hy - hh); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(160,150,170,.35)"; for (var s = 1; s < 7; s++) { var yy = hy - hh - s * 6 * u, k = s / 7; ctx.beginPath(); ctx.moveTo(hx - hw * (.62 - .24 * k), yy); ctx.lineTo(hx + hw * (.62 - .24 * k), yy); ctx.stroke(); }
      var wl = .75 + .25 * noise(t * 8);
      [[-.3, .55], [.3, .55]].forEach(function (p, i) { var wx = hx + p[0] * hw, wy = hy - hh * p[1]; glow(ctx, wx, wy, 26 * u, [255, 170, 70], .5 * wl);
        ctx.fillStyle = "rgba(255," + Math.round(180 + 40 * wl) + ",90,1)"; ctx.fillRect(wx - 9 * u, wy - 11 * u, 18 * u, 20 * u); ctx.fillStyle = "#2B1A16"; ctx.fillRect(wx - 1, wy - 11 * u, 2, 20 * u); });
      ctx.fillStyle = "rgba(255," + Math.round(160 + 50 * wl) + ",80,1)"; ctx.fillRect(hx - 11 * u, hy - 38 * u, 22 * u, 38 * u);
      for (var d = 0; d < 7; d++) { var dx = hx - hw * .55 + d * hw * 1.1 / 6; flame(ctx, dx, hy - hh - 2 * u, 2.2 * u, t, d); }
    });
    // people + bhailo
    layer(ctx, W, H, t, 1, cam, function () {
      ctx.fillStyle = "#0C060B"; ctx.beginPath(); ctx.moveTo(-40, H + 10);
      for (var x = -40; x <= W + 40; x += 14) ctx.lineTo(x, H * .93 - 10 * u * Math.sin(x / W * 4 + 1));
      ctx.lineTo(W + 40, H + 10); ctx.closePath(); ctx.fill();
      var ph = H * .17, col = "#0C060B", base = H * .95;
      var swingers = near ? [[W * .2, 0], [W * .42, 2.4]] : [[W * .18, 0], [W * .46, 2.4]];
      var fires = [];
      swingers.forEach(function (s, i) {
        var px = s[0], hand = [px + ph * .12, base - ph * 1.05];
        var cx = px + ph * .1, cy = base - ph * 1.35, rx = ph * .62, ry = ph * .2;
        var b = bhailoPos(t, cx, cy, rx, ry, s[1]); fires.push(b);
        // trail
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (var k = 25; k >= 1; k--) { var q = bhailoPos(t - k * .012, cx, cy, rx, ry, s[1]); var sz = (1 + .35 * q[2]) * 7 * u * (1 - k / 28);
          ctx.fillStyle = "rgba(255," + Math.round(120 + 60 * (1 - k / 25)) + ",40," + (.22 * (1 - k / 25)).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(q[0], q[1], sz, 0, TAU); ctx.fill(); }
        ctx.restore();
        var behind = b[2] < 0;
        function rope() { ctx.strokeStyle = "rgba(30,15,15,.9)"; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        function fire() { ctx.save(); ctx.globalCompositeOperation = "lighter"; flame(ctx, b[0], b[1], (5 + 2.5 * b[2]) * u, t, i * 3); ctx.restore(); }
        if (behind) { rope(); fire(); }
        // light pool on the ground
        ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.translate(b[0], base); ctx.scale(1, .22); glow(ctx, 0, 0, ph * .9, [255, 140, 50], .22); ctx.restore();
        person(ctx, px, base, ph, col, hand);
        if (!behind) { rope(); fire(); }
      });
      var kids = near ? [W * .3, W * .55, W * .86] : [W * .3, W * .6, W * .86];
      kids.forEach(function (kx, i) { person(ctx, kx, base + 2 * u, ph * .62, col, null, Math.abs(Math.sin(t * 4 + i * 1.3)) * 6 * u); });
      o._fires = fires;
    });
    // particles: sparks from the bhailo fires, smoke, bokeh
    var nS = o.half ? 30 : 60, fires = o._fires || [];
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < nS && fires.length; i++) {
      var life = 1.2 + h1(i * 3.3) * 1.4, age = (t + h1(i * 7.1) * life) % life, k = age / life, src = i % fires.length;
      var sw = swingersPos(t - age, i % 2, W, H, u, near);
      var x = sw[0] + Math.sin(age * 3 + i) * 14 * u + (h1(i) - .5) * 30 * u * k, y = sw[1] - age * (60 + h1(i * 2) * 70) * u;
      var c = mix([255, 230, 150], [230, 60, 20], k), r = (1.6 - k) * 1.8 * u + .4;
      glow(ctx, x, y, r * 5, c, .35 * (1 - k)); ctx.fillStyle = rgba(c, 1 - k); ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.restore();
    for (var j = 0; j < 14; j++) {
      var life2 = 6 + h1(j * 5) * 4, a2 = (t + h1(j * 11) * life2) % life2, k2 = a2 / life2, sx = (j % 2 ? hx : swingersPos(t - a2, j % 2, W, H, u, near)[0]);
      var sy = (j % 2 ? H * .84 - 84 * u : H * .7) - a2 * 18 * u, rr = (18 + a2 * 16) * u;
      var g = ctx.createRadialGradient(sx + Math.sin(a2 + j) * 20 * u, sy, 0, sx, sy, rr); g.addColorStop(0, "rgba(120,100,110," + (.10 * (1 - k2)).toFixed(3) + ")"); g.addColorStop(1, "rgba(120,100,110,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill();
    }
    bokeh(ctx, W, H, t, u, [255, 170, 80]);
    post(ctx, W, H, t, [255, 140, 60], flick);
  }
  function swingersPos(t, i, W, H, u, near) {
    var ph = H * .17, base = H * .95, px = i === 0 ? W * (near ? .2 : .18) : W * (near ? .42 : .46);
    var b = bhailoPos(t, px + ph * .1, base - ph * 1.35, ph * .62, ph * .2, i === 0 ? 0 : 2.4); return b;
  }
  function bokeh(ctx, W, H, t, u, c) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 5; i++) {
      var x = (h1(i * 13) * W + Math.sin(t * .2 + i) * 30 * u), y = H * (.25 + h1(i * 17) * .6) + Math.cos(t * .17 + i) * 20 * u, r = (30 + h1(i * 19) * 40) * u;
      var g = ctx.createRadialGradient(x, y, r * .5, x, y, r); g.addColorStop(0, rgba(c, .035)); g.addColorStop(.85, rgba(c, .03)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- DIWALI (street of lights, fireworks) ----------
  var FW = [[255, 200, 90], [255, 110, 160], [140, 200, 255], [190, 255, 140], [255, 150, 60]];
  function firework(ctx, W, H, t, i, u) {
    var P = 3.4 + h1(i * 3) * 1.4, ph = (t + h1(i * 5) * P) % P, n = Math.floor((t + h1(i * 5) * P) / P);
    var tx = W * (.12 + h1(i * 7 + n * 1.3) * .76), ty = H * (.12 + h1(i * 11 + n * 2.1) * .22), col = FW[(i + n) % FW.length], rise = .8;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    if (ph < rise) {   // rocket going up
      var k = ph / rise, y = lerp(H * .9, ty, 1 - Math.pow(1 - k, 2));
      for (var s = 0; s < 6; s++) glow(ctx, tx + Math.sin((ph - s * .02) * 20) * 1.5, y + s * 6 * u, 3 * u, [255, 220, 160], .5 * (1 - s / 6));
    } else {
      var tau = ph - rise, fade = clamp(1 - tau / 1.9, 0, 1);
      if (tau < .25) glow(ctx, tx, ty, 120 * u * (tau / .25), col, .25 * (1 - tau / .25));
      for (var r = 0; r < 46; r++) {
        var a = r / 46 * TAU + h1(i + n) * .3, v = (90 + h1(r * 1.7 + n) * 40) * u;
        // 6-step trail as a fading streak, bright head
        for (var s2 = 5; s2 >= 0; s2--) {
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
    var u = Math.min(H / 640, W / 480), cam = { u: u, mx: o.mx || 0, my: o.my || 0 }, flick = noise(t * 6);
    var sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#0B0B2A"); sky.addColorStop(.6, "#2A1240"); sky.addColorStop(1, "#5A2340");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    layer(ctx, W, H, t, .15, cam, function () { stars(ctx, W, H, t, 90, .5); for (var i = 0; i < 4; i++) firework(ctx, W, H, t, i, u); });
    // street of houses
    layer(ctx, W, H, t, .45, cam, function () {
      var n = Math.max(5, Math.round(W / (150 * u))), bw = W / n * 1.02;
      for (var i = 0; i < n; i++) {
        var x = i * W / n, h = (190 + h1(i * 3.7) * 120) * u, top = H * .9 - h, c = ["#2A1830", "#331C38", "#25142B"][i % 3];
        ctx.fillStyle = c; ctx.fillRect(x, top, bw, h);
        ctx.fillStyle = "#1C0F22"; ctx.fillRect(x - 4 * u, top - 8 * u, bw + 8 * u, 10 * u);
        for (var r = 0; r < 3; r++) for (var cl = 0; cl < 3; cl++) {
          var on = h1(i * 31 + r * 7 + cl + Math.floor(t * .5 + h1(i + r + cl) * 3)) > .35, wx = x + bw * (.18 + cl * .26), wy = top + 26 * u + r * 52 * u;
          if (wy > H * .82) continue;
          if (on) glow(ctx, wx + 9 * u, wy + 12 * u, 26 * u, [255, 180, 80], .3);
          ctx.fillStyle = on ? "#FFC870" : "#1A0E1E"; ctx.fillRect(wx, wy, 18 * u, 24 * u);
        }
        // three jhalar lines with chasing bulbs
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        for (var L = 0; L < 3; L++) {
          var y0 = top + (10 + L * 34) * u, sag = (14 + L * 3) * u, cols = [[255, 200, 80], [255, 90, 140], [120, 200, 255]];
          ctx.strokeStyle = "rgba(60,40,40,.6)"; ctx.lineWidth = 1; ctx.beginPath();
          for (var s = 0; s <= 12; s++) { var p = catenary(x, x + bw, y0, sag, s / 12); s ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke();
          for (var b = 0; b < 12; b++) { var q = catenary(x, x + bw, y0, sag, (b + .5) / 12), on2 = ((b + L - Math.floor(t * 6)) % 4 + 4) % 4 === 0 ? 1 : .45;
            glow(ctx, q[0], q[1], 7 * u, cols[(b + L) % 3], .55 * on2); ctx.fillStyle = rgba(cols[(b + L) % 3], on2); ctx.beginPath(); ctx.arc(q[0], q[1], 1.6 * u, 0, TAU); ctx.fill(); }
        }
        ctx.restore();
      }
    });
    // ground, rangoli, diyas
    layer(ctx, W, H, t, .8, cam, function () {
      var g = ctx.createLinearGradient(0, H * .88, 0, H); g.addColorStop(0, "#2A1420"); g.addColorStop(1, "#140910"); ctx.fillStyle = g; ctx.fillRect(-40, H * .88, W + 80, H * .2);
      var rx = W * .5, ry = H * .955, R = Math.min(W * .22, 170 * u), cols = ["#E8456B", "#F6B33C", "#3FA7D6", "#8E5BD9", "#F2F0E6"];
      ctx.save(); ctx.translate(rx, ry); ctx.scale(1, .22); ctx.globalAlpha = .55;
      for (var k = 5; k >= 1; k--) { ctx.fillStyle = cols[k % 5]; ctx.beginPath(); for (var p = 0; p < 16; p++) { var a = p / 16 * TAU, rr = R * k / 5 * (p % 2 ? .82 : 1); p ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
      ctx.restore();
      var nd = Math.max(7, Math.round(W / (70 * u)));
      for (var d = 0; d < nd; d++) { var dx = (d + .5) * W / nd, dy = H * .93 + (d % 2) * 4 * u;
        if (Math.abs(dx - rx) < R * .9) dy = H * .985;
        ctx.fillStyle = "#8A4A2A"; ctx.beginPath(); ctx.ellipse(dx, dy, 9 * u, 4 * u, 0, 0, Math.PI); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = "lighter"; flame(ctx, dx, dy - 1 * u, 2.6 * u, t, d); ctx.restore(); }
    });
    // sparks + smoke + bokeh
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    var nS = o.half ? 30 : 60;
    for (var i = 0; i < nS; i++) {
      var life = 1.4 + h1(i * 3.3) * 1.6, age = (t + h1(i * 7.1) * life) % life, k = age / life, nd2 = Math.max(7, Math.round(W / (70 * u)));
      var x = (Math.floor(h1(i * 2.2) * nd2) + .5) * W / nd2 + Math.sin(age * 3 + i) * 10 * u, y = H * .92 - age * (40 + h1(i) * 50) * u;
      var c = mix([255, 230, 150], [230, 70, 30], k); glow(ctx, x, y, 5 * u, c, .3 * (1 - k)); ctx.fillStyle = rgba(c, 1 - k); ctx.fillRect(x, y, 1.6 * u, 1.6 * u);
    }
    ctx.restore();
    for (var j = 0; j < 14; j++) { var l2 = 7 + h1(j * 5) * 4, a2 = (t + h1(j * 11) * l2) % l2, k2 = a2 / l2, sx = h1(j * 3) * W, sy = H * .9 - a2 * 16 * u, rr = (20 + a2 * 14) * u;
      var sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr); sg.addColorStop(0, "rgba(150,130,150," + (.08 * (1 - k2)).toFixed(3) + ")"); sg.addColorStop(1, "rgba(150,130,150,0)"); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, rr, 0, TAU); ctx.fill(); }
    bokeh(ctx, W, H, t, u, [255, 190, 110]);
    post(ctx, W, H, t, [255, 160, 70], flick);
  }

  var SCENES = { igas: igas, diwali: diwali };
  var E = {
    has: function (k) { return !!SCENES[k]; },
    draw: function (ctx, W, H, t, k, o) { (SCENES[k] || igas)(ctx, W, H, t, o || {}); },
    // run on a canvas: 30–60 fps, particles halved after 8 s, stops when hidden, still frame at t = 2.2 s for reduced motion
    run: function (canvas, k, opt) {
      opt = opt || {};
      var ctx = canvas.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, H = 0, raf = 0, t0 = performance.now(), o = { mx: 0, my: 0 };
      var still = opt.still || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
      function size() { var b = canvas.getBoundingClientRect(); W = b.width; H = b.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
      function frame(now) { var t = still ? 2.2 : (now - t0) / 1000; o.half = t > 8; E.draw(ctx, W, H, t, k, o); if (!still) raf = requestAnimationFrame(frame); }
      size(); addEventListener("resize", function () { size(); if (still) frame(0); });
      if (!still) {
        (opt.hover || canvas).addEventListener("mousemove", function (e) { var b = canvas.getBoundingClientRect(); o.mx = (e.clientX - b.left) / b.width - .5; o.my = (e.clientY - b.top) / b.height - .5; }, { passive: true });
        document.addEventListener("visibilitychange", function () { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(frame); });
      }
      raf = requestAnimationFrame(frame);
    }
  };
  window.GBFestEngine = E;
})();
