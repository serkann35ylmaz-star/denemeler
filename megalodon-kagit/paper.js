// Paper cut-out rendering engine: deterministic RNG, cached textures, jittered cut paths,
// layered paper drawing (shadow, exposed edge, fill, fibre texture), type helpers, easing.
(function (G) {
  'use strict';

  // ---------- deterministic randomness (splitmix32-style hash; well mixed for any seed) ----------
  function hash32(n) {
    n = (n + 0x9e3779b9) | 0;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    return (n ^ (n >>> 16)) >>> 0;
  }
  function rng(seed) {
    let s = hash32(seed | 0);
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function strSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---------- colour ----------
  const C = {
    cream: '#F3EBDD', charcoal: '#243139', terracotta: '#C56B50', mustard: '#E8B65C',
    sage: '#8A9B7C', blue: '#7C9DA5', card: '#FFF8EB',
    blueDeep: '#4E7280', blueDark: '#35505B', abyss: '#1B262C', terraDark: '#9C4F39',
    mustardDark: '#C8933A', sageDark: '#66775B', creamDark: '#E2D6C1', charcoalSoft: '#3A4A53'
  };
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function shade(h, k) { // k>0 lighten toward card, k<0 darken toward charcoal-ish
    const a = hex(h), b = k > 0 ? [255, 250, 238] : [20, 26, 30], t = Math.abs(k);
    return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
  }
  function rgba(h, a) { const c = hex(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(h1, h2, t) { const a = hex(h1), b = hex(h2); return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')'; }

  // ---------- easing ----------
  const E = {
    lin: t => t,
    inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    out: t => 1 - Math.pow(1 - t, 3),
    in: t => t * t * t,
    outBack: t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
    sine: t => -(Math.cos(Math.PI * t) - 1) / 2
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // progress of t within [a,b], eased
  function seg(t, a, b, ease) { const p = clamp((t - a) / (b - a), 0, 1); return (ease || E.inOut)(p); }
  const lerp = (a, b, t) => a + (b - a) * t;
  // stepped stop-motion time (12 poses/s) for physical paper wobble only
  const step12 = t => Math.floor(t * 12) / 12;

  // ---------- cached fibre texture ----------
  let FIBRE = null;
  function fibreCanvas() {
    if (FIBRE) return FIBRE;
    const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'), img = g.createImageData(S, S), r = rng(7331);
    // value noise at two scales + per-pixel grain, tileable
    const N = 64, grid = new Float32Array(N * N); for (let i = 0; i < N * N; i++) grid[i] = r();
    const N2 = 16, grid2 = new Float32Array(N2 * N2); for (let i = 0; i < N2 * N2; i++) grid2[i] = r();
    function vn(gr, n, x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const s = t => t * t * (3 - 2 * t), a = gr[(yi % n) * n + (xi % n)], b = gr[(yi % n) * n + ((xi + 1) % n)],
        c = gr[((yi + 1) % n) * n + (xi % n)], d = gr[((yi + 1) % n) * n + ((xi + 1) % n)];
      return lerp(lerp(a, b, s(xf)), lerp(c, d, s(xf)), s(yf));
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = 0.55 * vn(grid, N, x / S * N, y / S * N) + 0.45 * vn(grid2, N2, x / S * N2, y / S * N2);
      const grain = (hash32(x * 7919 + y * 104729) / 4294967296);
      const l = 128 + (v - 0.5) * 46 + (grain - 0.5) * 34;
      const i = (y * S + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = l; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // fibres
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = r() * S, y = r() * S, a = r() * Math.PI * 2, L = 4 + r() * 18, dark = r() < 0.55;
      g.strokeStyle = dark ? 'rgba(60,50,40,' + (0.10 + r() * 0.14) + ')' : 'rgba(255,255,250,' + (0.12 + r() * 0.18) + ')';
      g.lineWidth = 0.5 + r() * 0.9;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        g.beginPath(); g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(x + ox + Math.cos(a + 0.6) * L * 0.5, y + oy + Math.sin(a + 0.6) * L * 0.5, x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L);
        g.stroke();
      }
    }
    FIBRE = cv; return cv;
  }
  const patterns = new WeakMap();
  function fibrePattern(ctx) { let p = patterns.get(ctx); if (!p) { p = ctx.createPattern(fibreCanvas(), 'repeat'); patterns.set(ctx, p); } return p; }

  // ---------- cut paths ----------
  // Build a closed path from points with subdivision + seeded perpendicular jitter (imperfect scissor cut).
  const pathCache = new Map();
  function cutPath(key, pts, opt) {
    opt = opt || {};
    const ck = key + '|' + (opt.j || 1.6);
    if (key && pathCache.has(ck)) return pathCache.get(ck);
    const r = rng(strSeed(key || 'p')), j = opt.j == null ? 1.6 : opt.j, segLen = opt.seg || 22;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), n = Math.max(1, Math.round(L / segLen));
      const nx = -dy / (L || 1), ny = dx / (L || 1);
      for (let k = 0; k < n; k++) {
        const t = k / n, off = k === 0 ? 0 : (r() - 0.5) * 2 * j;
        out.push([a[0] + dx * t + nx * off, a[1] + dy * t + ny * off]);
      }
    }
    const p = new Path2D(); p.moveTo(out[0][0], out[0][1]); for (let i = 1; i < out.length; i++) p.lineTo(out[i][0], out[i][1]); p.closePath();
    if (key) pathCache.set(ck, p);
    return p;
  }
  // Sample a smooth closed shape given by a function f(u)->[x,y], u in [0,1)
  function sampled(key, f, n, opt) { const pts = []; for (let i = 0; i < n; i++) pts.push(f(i / n)); return cutPath(key, pts, opt); }
  function rectPts(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
  function ellipsePts(cx, cy, rx, ry, n) { const p = []; n = n || 40; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; }
  function roundRectPts(x, y, w, h, r, n) {
    const p = [], c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
    n = n || 5; for (const [cx, cy, a0] of c) for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return p;
  }
  // wavy band: top edge from x0..x1 at y with waves, closed down to yBottom
  function wavePts(x0, x1, y, amp, wl, yBottom, phase) {
    const p = []; for (let x = x0; x <= x1 + 1; x += 18) p.push([x, y + Math.sin((x / wl) * Math.PI * 2 + (phase || 0)) * amp + Math.sin((x / wl) * 5.3 + 1.7) * amp * 0.25]);
    p.push([x1, yBottom], [x0, yBottom]); return p;
  }

  // ---------- paper drawing ----------
  // depth: lift in px (shadow distance). light from top-left.
  function paper(ctx, path, fill, o) {
    o = o || {};
    const depth = o.depth == null ? 4 : o.depth, edge = o.edge == null ? 1.6 : o.edge, tex = o.tex == null ? 0.22 : o.tex;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (depth > 0) { // soft warm shadow
      ctx.save();
      ctx.shadowColor = 'rgba(70,45,25,' + (o.shadowA || 0.30) + ')';
      ctx.shadowBlur = depth * 2.2; ctx.shadowOffsetX = depth * 0.55; ctx.shadowOffsetY = depth * 0.9;
      ctx.fillStyle = fill; ctx.fill(path);
      ctx.restore();
      // tight contact shadow
      ctx.save(); ctx.translate(depth * 0.18, depth * 0.3); ctx.fillStyle = 'rgba(50,35,25,0.18)'; ctx.fill(path); ctx.restore();
    }
    if (edge > 0) { // exposed lighter paper core on the lit (top-left) edge
      ctx.save(); ctx.translate(-edge * 0.7, -edge * 0.8); ctx.fillStyle = o.edgeColor || 'rgba(255,250,238,0.85)'; ctx.fill(path); ctx.restore();
    }
    ctx.fillStyle = fill; ctx.fill(path);
    if (tex > 0) {
      ctx.save(); ctx.clip(path);
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha *= tex * 2.2;
      ctx.fillStyle = fibrePattern(ctx);
      const m = ctx.getTransform(); // keep texture anchored to the object, not the screen
      ctx.fillStyle.setTransform && ctx.fillStyle.setTransform(new DOMMatrix().translate(o.texOff || 0, o.texOff || 0));
      ctx.fill(path);
      ctx.restore();
    }
    if (o.inner) { // subtle inner shading toward bottom-right for thickness
      ctx.save(); ctx.clip(path); ctx.strokeStyle = 'rgba(40,30,20,0.16)'; ctx.lineWidth = 3; ctx.translate(1.2, 1.6); ctx.stroke(path); ctx.restore();
    }
    ctx.restore();
  }

  // full background sheet with texture
  function backdrop(ctx, W, H, color) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.45; ctx.fillStyle = fibrePattern(ctx); ctx.fillRect(0, 0, W, H); ctx.restore();
    // soft vignette like a lit tabletop
    const g = ctx.createRadialGradient(W * 0.4, H * 0.35, H * 0.2, W * 0.5, H * 0.5, H * 0.75);
    g.addColorStop(0, 'rgba(255,248,235,0)'); g.addColorStop(1, 'rgba(90,60,35,0.16)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---------- typography ----------
  const F = { head: '"Fraunces"', body: '"Work Sans"' };
  function font(w, size, fam) { return w + ' ' + size + 'px ' + (fam || F.body) + ', sans-serif'; }
  // text printed on paper: slight shadow for ink-on-card feel
  function text(ctx, s, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = font(o.w || 700, o.size || 40, o.fam);
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    if (o.track) ctx.letterSpacing = o.track + 'px';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.fillStyle = o.color || C.charcoal;
    if (o.maxW) { // wrap
      const words = s.split(' '); let line = '', ly = y; const lh = o.lh || (o.size || 40) * 1.18;
      for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > o.maxW && line) { ctx.fillText(line, x, ly); line = w; ly += lh; } else line = test; }
      ctx.fillText(line, x, ly); ctx.restore(); return ly;
    }
    ctx.fillText(s, x, y);
    ctx.restore(); return y;
  }
  function measure(ctx, s, size, w, fam, track) { ctx.save(); ctx.font = font(w || 700, size, fam); if (track) ctx.letterSpacing = track + 'px'; const m = ctx.measureText(s).width; ctx.restore(); return m; }
  // text revealed by a paper strip sliding out (mask grows left->right)
  function revealText(ctx, s, x, y, p, o) {
    if (p <= 0) return; o = o || {};
    const wid = measure(ctx, s, o.size || 40, o.w || 700, o.fam, o.track) + 20;
    ctx.save(); ctx.beginPath();
    const left = o.align === 'center' ? x - wid / 2 : o.align === 'right' ? x - wid : x;
    ctx.rect(left - 10, y - (o.size || 40) * 1.2, wid * p + 10, (o.size || 40) * 1.7); ctx.clip();
    text(ctx, s, x, y + (1 - p) * 6, o); ctx.restore();
  }

  // ---------- helpers ----------
  function withT(ctx, x, y, rot, sc, fn) { ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (sc != null && sc !== 1) ctx.scale(sc, sc); fn(); ctx.restore(); }
  // paper lift-in: returns transform params for an element entering over [a, a+d]
  function liftIn(t, a, d, from) {
    const p = seg(t, a, a + (d || 0.6), E.outBack), q = seg(t, a, a + (d || 0.6), E.out);
    from = from || [0, 60];
    return { p: q, x: from[0] * (1 - p), y: from[1] * (1 - p), rot: (1 - q) * 0.06, depth: 2 + 10 * (1 - q), alpha: clamp(q * 1.6, 0, 1) };
  }

  G.Paper = { hash32, rng, strSeed, C, shade, rgba, mix, E, clamp, seg, lerp, step12, fibreCanvas, cutPath, sampled, rectPts, ellipsePts, roundRectPts, wavePts, paper, backdrop, F, font, text, measure, revealText, withT, liftIn };
})(window);
