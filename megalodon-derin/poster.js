// Screen-print poster engine: 4 inks on cream paper, fixed paper grain, sparse halftone, deterministic.
(function (G) {
  'use strict';
  const W = 1080, H = 1920;
  const K = { paper: '#F3F0E6', ink: '#111410', olive: '#68725F', lime: '#D5FA73' };

  // ---------- deterministic noise ----------
  function hash(n) { n = (n + 0x9e3779b9) | 0; n = Math.imul(n ^ (n >>> 16), 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function hash2(x, y) { return hash(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663)); }
  function rng(seed) { let s = (seed * 2654435761) >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = t => t * t * (3 - 2 * t);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
  }
  function fbm(x, y, o) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < (o || 4); i++) { v += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return v; }

  // ---------- easing / time ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    out: t => 1 - Math.pow(1 - t, 3), in: t => t * t * t,
    sine: t => -(Math.cos(Math.PI * t) - 1) / 2, lin: t => t
  };
  const seg = (t, a, b, e) => (e || E.inOut)(clamp((t - a) / (b - a), 0, 1));

  // ---------- canvases ----------
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // fixed paper grain over the whole frame (never moves with the camera)
  let GRAIN = null;
  function grain() {
    if (GRAIN) return GRAIN;
    const c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = hash2(x, y), fib = fbm(x / 9, y / 3.2, 2), blot = fbm(x / 160, y / 160, 3);
      const v = 128 + (n - 0.5) * 38 + (fib - 0.5) * 30 + (blot - 0.5) * 26;
      const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); GRAIN = c; return c;
  }
  // ink mottle: printed solids are never perfectly flat
  let MOTTLE = null;
  function mottle() {
    if (MOTTLE) return MOTTLE;
    const S = 540, c = canvas(S, S * 2), g = c.getContext('2d'), img = g.createImageData(S, S * 2), d = img.data;
    for (let y = 0; y < S * 2; y++) for (let x = 0; x < S; x++) {
      const v = fbm(x / 9, y / 9, 3), i = (y * S + x) * 4; const a = clamp((v - 0.5) * 2.4, 0, 1);
      d[i] = 243; d[i + 1] = 240; d[i + 2] = 230; d[i + 3] = a * 9;
    }
    g.putImageData(img, 0, 0); MOTTLE = c; return c;
  }
  function finish(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(mottle(), 0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.55; ctx.drawImage(grain(), 0, 0); ctx.restore();
    // soft print vignette (paper edge pressure)
    const v = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.32, W / 2, H * 0.5, H * 0.78);
    v.addColorStop(0, 'rgba(17,20,16,0)'); v.addColorStop(1, 'rgba(17,20,16,0.22)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // printed poster: cream paper margin around the inked area
    const m = 34; ctx.save(); ctx.fillStyle = K.paper; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(m, m, W - 2 * m, H - 2 * m); ctx.fill('evenodd');
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.drawImage(grain(), 0, 0); ctx.restore();
  }

  // ---------- halftone ----------
  // dots of `color` over rect; density(x,y)->0..1 (dot area). Cell size in px. Angle fixed 45deg-ish via offset rows.
  function halftone(ctx, x0, y0, w, h, density, color, cell) {
    cell = cell || 12; ctx.fillStyle = color; ctx.beginPath();
    for (let j = 0, y = y0; y < y0 + h + cell; j++, y += cell) {
      const off = (j % 2) * cell / 2;
      for (let x = x0 - cell + off; x < x0 + w + cell; x += cell) {
        const dn = density(x, y); if (dn <= 0.02) continue;
        const r = Math.sqrt(clamp(dn, 0, 1)) * cell * 0.62; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }

  // ---------- type ----------
  const FONT = { title: '"Anton"', label: '"Oswald"' };
  function text(ctx, s, x, y, o) {
    o = o || {}; ctx.save();
    ctx.font = (o.w || 400) + ' ' + (o.size || 60) + 'px ' + (o.fam || FONT.title) + ', sans-serif';
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    if (o.track) ctx.letterSpacing = o.track + 'px';
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha; ctx.fillStyle = o.color || K.paper;
    ctx.fillText(s, x, y); ctx.restore();
  }
  function measure(ctx, s, size, fam, w, track) { ctx.save(); ctx.font = (w || 400) + ' ' + size + 'px ' + (fam || FONT.title) + ', sans-serif'; if (track) ctx.letterSpacing = track + 'px'; const m = ctx.measureText(s).width; ctx.restore(); return m; }
  // text that "prints in": a band mask sweeping down the glyphs, like ink hitting paper
  function printText(ctx, s, x, y, p, o) {
    if (p <= 0) return; o = o || {}; const size = o.size || 60;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y - size * 1.05, W, size * 1.25 * E.out(clamp(p, 0, 1))); ctx.clip();
    text(ctx, s, x, y, o); ctx.restore();
  }

  // ---------- shapes ----------
  function catmull(ctrl, per, closed) {
    const out = [], n = ctrl.length; per = per || 8;
    const get = i => closed ? ctrl[(i + n) % n] : ctrl[clamp(i, 0, n - 1)];
    const lim = closed ? n : n - 1;
    for (let i = 0; i < lim; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    if (!closed) out.push(ctrl[n - 1]);
    return out;
  }
  function poly(pts) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; }

  G.Poster = { W, H, K, hash, hash2, rng, vnoise, fbm, clamp, lerp, E, seg, canvas, grain, mottle, finish, halftone, FONT, text, measure, printText, catmull, poly };
})(window);
