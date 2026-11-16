// 2D sinematik hikaye motoru. window.DATA (out/zaman.js) okur; seek(t) o anın karesini çizer.
// Bölümler: yardımcılar · mekanlar (paralaks katmanlar) · karakter kuklası · sahne durumu · kamera · efektler · ana çizim
(() => {
const D = window.DATA, W = D.W, H = D.H, PORTRAIT = H > W;
const cv = document.getElementById('cv'); cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');
const GY = H * (PORTRAIT ? 0.74 : 0.80);   // zemin çizgisi (ekran y)
const AY = H * 0.6;                         // yakınlaştırma merkezi
const K = PORTRAIT ? 1.35 : 1;              // dikey formatta dünya biraz daha büyük
const FONT = '"Nunito", "DejaVu Sans", sans-serif';

// ---------- yardımcılar ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const smooth = p => p * p * (3 - 2 * p);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function shade(hex, f) { // f<0 koyulaştır, f>0 açıklaştır
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const m = v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function vgrad(c, y0, y1, stops) { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }

// Dünya koordinatı: x=0 sahne ortası, y=0 zemin, yukarı negatif. d = derinlik (0 uzak … 1 karakterler … >1 ön plan)
function withLayer(cam, d, fn) {
  const z = (1 + (cam.zoom - 1) * d) * K;
  ctx.save(); ctx.translate(W / 2, AY); ctx.scale(z, z); ctx.translate(-cam.x * d, (GY - AY) / K - cam.y * d);
  fn(z); ctx.restore();
}

// ---------- mekanlar ----------
const LW = 5600, LH = 1500, LG = 360; // katman tuvali; zemin tuvalin altından LG piksel yukarıda
function bake(draw, blur) {
  const c = mk(LW, LH), g = c.getContext('2d');
  g.translate(LW / 2, LH - LG); draw(g);
  if (!blur) return c;
  const b = mk(LW, LH), bg = b.getContext('2d'); bg.filter = `blur(${blur}px)`; bg.drawImage(c, 0, 0); return b;
}
function mountains(g, r, base, amp, col, step = 140) {
  g.fillStyle = col; g.beginPath(); g.moveTo(-LW / 2, base + 400);
  let y = base - amp * r();
  for (let x = -LW / 2; x <= LW / 2 + step; x += step) { y = clamp(y + (r() - .5) * amp * .9, base - amp, base - amp * .15); g.lineTo(x, y); }
  g.lineTo(LW / 2, base + 400); g.fill();
}
function hills(g, base, amp, col, ph, len = 900) {
  g.fillStyle = col; g.beginPath(); g.moveTo(-LW / 2, base + 600);
  for (let x = -LW / 2; x <= LW / 2; x += 20) g.lineTo(x, base - amp * (.5 + .5 * Math.sin(x / len + ph)) - amp * .3 * Math.sin(x / (len * .37) + ph * 2));
  g.lineTo(LW / 2, base + 600); g.fill();
}
function pine(g, x, y, h, col) {
  g.fillStyle = col; g.fillRect(x - h * .03, y - h * .2, h * .06, h * .2);
  for (let i = 0; i < 4; i++) { const w = h * (.42 - i * .08), yy = y - h * (.12 + i * .21); g.beginPath(); g.moveTo(x - w / 2, yy); g.lineTo(x, yy - h * .36); g.lineTo(x + w / 2, yy); g.fill(); }
}
function leafy(g, x, y, h, trunk, leaf, r) {
  g.fillStyle = trunk; g.beginPath(); g.moveTo(x - h * .05, y); g.lineTo(x - h * .025, y - h * .55); g.lineTo(x + h * .025, y - h * .55); g.lineTo(x + h * .05, y); g.fill();
  for (let i = 0; i < 7; i++) { g.fillStyle = i < 3 ? shade(leaf, -.15) : leaf; g.beginPath(); g.arc(x + (r() - .5) * h * .45, y - h * (.62 + r() * .25), h * (.16 + r() * .1), 0, 7); g.fill(); }
}
function grassTufts(g, r, n, y0, y1, col, hmax) {
  g.strokeStyle = col; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = (r() - .5) * LW, y = lerp(y0, y1, r()), h = hmax * (.4 + r() * .6); g.lineWidth = 2 + r() * 3;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * 4, y); g.quadraticCurveTo(x + k * 6, y - h * .6, x + k * 10 + (r() - .5) * 10, y - h); g.stroke(); }
  }
}
function floor(g, top, cols) { g.fillStyle = vgrad(g, top, LG, cols); g.fillRect(-LW / 2, top, LW, LG - top); }
function windows(g, r, x, y, w, h, lit, colLit) {
  for (let yy = y + 20; yy < y + h - 30; yy += 34) for (let xx = x + 14; xx < x + w - 20; xx += 26)
    if (r() < lit) { g.fillStyle = colLit[(r() * colLit.length) | 0]; g.globalAlpha = .5 + r() * .5; g.fillRect(xx, yy, 12, 18); }
  g.globalAlpha = 1;
}

// Her mekan: gökyüzü (her karede), pişmiş katmanlar, renk tonu, varsayılan efekt
const SETS = {
  'orman-gece': r => ({
    sky: ['#070b1d', '#15204a', '#2c3b6b'], moon: { x: .72, y: .2, r: 46, col: '#f3f0dc' }, stars: 160,
    layers: [
      [.12, bake(g => mountains(g, r, -230, 260, '#1b2750'))],
      [.3, bake(g => { for (let x = -LW / 2; x < LW / 2; x += 55 + r() * 40) pine(g, x, -190 + r() * 30, 260 + r() * 160, '#141d3d'); })],
      [.6, bake(g => { for (let x = -LW / 2; x < LW / 2; x += 140 + r() * 160) pine(g, x, -110 + r() * 20, 420 + r() * 220, '#0e1530'); })],
      [1, bake(g => { floor(g, -140, [[0, '#18233f'], [.4, '#122036'], [1, '#08101f']]); grassTufts(g, r, 260, -120, 200, '#1d3150', 30); })],
    ],
    fg: [[1.45, bake(g => { grassTufts(g, r, 70, 230, 350, '#050a14', 150); }, 7)]],
    grade: ['#3050a0', .18], light: '#a8c0ff', efekt: 'ates-bocegi',
  }),
  'orman-gunduz': r => ({
    sky: ['#5aa7ea', '#a9d4f5', '#e6f3fb'], sun: { x: .2, y: .14, r: 60, col: '#fff6d0' }, rays: true,
    layers: [
      [.12, bake(g => hills(g, -200, 220, '#9bbfd6', 1.3))],
      [.3, bake(g => { hills(g, -150, 120, '#7fa88f', 2.1); for (let x = -LW / 2; x < LW / 2; x += 90 + r() * 60) leafy(g, x, -150 + r() * 20, 200 + r() * 90, '#4d5b45', '#6f9b6a', r); })],
      [.6, bake(g => { for (let x = -LW / 2; x < LW / 2; x += 220 + r() * 200) leafy(g, x, -100, 480 + r() * 200, '#5a4632', '#3f7d3c', r); })],
      [1, bake(g => { floor(g, -130, [[0, '#7cae55'], [.5, '#5d9442'], [1, '#3d6c2c']]); grassTufts(g, r, 320, -110, 220, '#4f8a37', 34); })],
    ],
    fg: [[1.45, bake(g => grassTufts(g, r, 70, 230, 350, '#2c5520', 160), 7)]],
    grade: ['#ffcf8a', .12], light: '#fff1c9', efekt: 'toz',
  }),
  'sehir-gece': r => ({
    sky: ['#0b0820', '#2a1446', '#5b2a5e'], moon: { x: .18, y: .16, r: 30, col: '#ffe9d6' }, stars: 40,
    layers: [
      [.15, bake(g => { for (let x = -LW / 2; x < LW / 2; x += 70 + r() * 50) { const w = 60 + r() * 90, h = 200 + r() * 380; g.fillStyle = '#1d1838'; g.fillRect(x, -200 - h, w, h + 200); windows(g, r, x, -200 - h, w, h, .25, ['#ffcf7a', '#9fd8ff']); } })],
      [.4, bake(g => { for (let x = -LW / 2; x < LW / 2; x += 140 + r() * 80) { const w = 120 + r() * 120, h = 300 + r() * 400; g.fillStyle = '#130f28'; g.fillRect(x, -130 - h, w, h + 130); windows(g, r, x, -130 - h, w, h, .35, ['#ffd27a', '#ff7ac8', '#7affe6']); } })],
      [1, bake(g => {
        floor(g, -90, [[0, '#2b2740'], [.25, '#1b1830'], [1, '#0c0a18']]); g.fillStyle = '#3a3555'; g.fillRect(-LW / 2, -90, LW, 16);
        for (let x = -LW / 2 + 200; x < LW / 2; x += 700) { g.fillStyle = '#0d0b1a'; g.fillRect(x - 5, -560, 10, 470); g.fillRect(x - 5, -560, 60, 8);
          const lg = g.createRadialGradient(x + 55, -545, 4, x + 55, -545, 160); lg.addColorStop(0, 'rgba(255,214,140,.9)'); lg.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = lg; g.fillRect(x - 110, -710, 330, 330);
          const pg = g.createRadialGradient(x + 55, 40, 4, x + 55, 40, 230); pg.addColorStop(0, 'rgba(255,200,120,.25)'); pg.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = pg; g.fillRect(x - 200, -60, 520, 220); }
      })],
    ],
    fg: [], grade: ['#b040a0', .14], light: '#ffb0e0', efekt: 'yagmur',
  }),
  'oda': r => ({
    sky: ['#1a1410', '#1a1410', '#1a1410'],
    layers: [[.9, bake(g => {
      g.fillStyle = vgrad(g, -1200, 0, [[0, '#4a3628'], [1, '#6b4f3a']]); g.fillRect(-LW / 2, -1200, LW, 1200);
      g.fillStyle = 'rgba(0,0,0,.08)'; for (let x = -LW / 2; x < LW / 2; x += 90) g.fillRect(x, -1200, 45, 1200);
      g.fillStyle = '#3a2a1e'; g.fillRect(-LW / 2, -60, LW, 60);
      // pencere (gece gökyüzü)
      g.fillStyle = '#2a1d14'; g.fillRect(-520, -720, 380, 460); g.fillStyle = vgrad(g, -700, -280, [[0, '#0d1638'], [1, '#2c3d70']]); g.fillRect(-500, -700, 340, 420);
      g.fillStyle = '#f3efd8'; g.beginPath(); g.arc(-260, -600, 26, 0, 7); g.fill(); g.fillStyle = '#2a1d14'; g.fillRect(-335, -700, 10, 420); g.fillRect(-500, -495, 340, 10);
      // tablo + raf
      g.fillStyle = '#c9a25a'; g.fillRect(260, -760, 300, 210); g.fillStyle = '#3d5a6b'; g.fillRect(275, -745, 270, 180); g.fillStyle = '#d98c4a'; g.beginPath(); g.arc(470, -700, 24, 0, 7); g.fill();
      hills(g, -565, 60, '#2c4250', 0, 120);
      g.fillStyle = '#2e2017'; g.fillRect(700, -440, 360, 14); ['#8b3a3a', '#3a6b8b', '#c9a25a', '#4a7a4a', '#6b4a8b'].forEach((c, i) => { g.fillStyle = c; g.fillRect(720 + i * 34, -520 - (i % 2) * 14, 26, 80 + (i % 2) * 14); });
    })], [1, bake(g => { floor(g, -10, [[0, '#7a5338'], [1, '#3e2a1c']]); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3; for (let y = 20; y < LG; y += 50) { g.beginPath(); g.moveTo(-LW / 2, y); g.lineTo(LW / 2, y); g.stroke(); } })]],
    lamp: { x: .82, y: .3 }, fg: [], grade: ['#ff9a50', .16], light: '#ffc890', efekt: 'toz',
  }),
  'gunbatimi': r => ({
    sky: ['#2b1b4d', '#c2456b', '#ffb36b'], sun: { x: .55, y: .55, r: 120, col: '#ffe0a0' }, stars: 0,
    layers: [
      [.12, bake(g => hills(g, -210, 140, '#7b3a6a', .4, 700))],
      [.3, bake(g => hills(g, -160, 110, '#4f2650', 2.2, 520))],
      [.6, bake(g => { hills(g, -90, 90, '#2d1736', 4.1, 420); for (let x = -LW / 2; x < LW / 2; x += 600 + r() * 500) leafy(g, x, -120, 380, '#1d0e24', '#24112d', r); })],
      [1, bake(g => { floor(g, -80, [[0, '#2a1530'], [1, '#120816']]); grassTufts(g, r, 200, -70, 220, '#1c0d22', 34); })],
    ],
    fg: [[1.45, bake(g => grassTufts(g, r, 60, 230, 350, '#0a040d', 160), 7)]],
    grade: ['#ff7a40', .16], light: '#ffb070', efekt: 'toz',
  }),
  'deniz': r => ({
    sky: ['#3d7cc9', '#8cc2ec', '#f0e3c8'], sun: { x: .78, y: .24, r: 54, col: '#fff3cf' }, sea: true,
    layers: [
      [.12, bake(g => { g.fillStyle = vgrad(g, -230, 0, [[0, '#2f6fa8'], [1, '#4f9ac8']]); g.fillRect(-LW / 2, -230, LW, 600); hills(g, -230, 60, '#6d8fb0', 3, 300); })],
      [1, bake(g => { floor(g, -60, [[0, '#e8d3a2'], [1, '#c9ab72']]); g.fillStyle = 'rgba(255,255,255,.55)'; for (let x = -LW / 2; x < LW / 2; x += 60) { g.beginPath(); g.ellipse(x, -66, 50, 6, 0, 0, 7); g.fill(); } })],
    ],
    fg: [], grade: ['#ffd9a0', .1], light: '#fff3d6', efekt: null,
  }),
};
const setCache = {};
function getSet(sc) {
  const key = typeof sc.mekan === 'string' ? sc.mekan : JSON.stringify(sc.mekan || 'orman-gece');
  if (setCache[key]) return setCache[key];
  let s;
  if (sc.mekan && sc.mekan.resim) { // kendi görselin (ör. yapay zekâyla üretilmiş arka plan)
    const img = IMAGES[sc.mekan.resim];
    s = { sky: ['#000', '#000', '#000'], layers: [[.85, bake(g => { const h = 1500, w = img.width * h / img.height; for (let x = -LW / 2; x < LW / 2; x += w) g.drawImage(img, x, -h + LG * .6, w, h); })]], fg: [], grade: sc.mekan.ton || ['#000', 0], light: '#fff', efekt: null };
  } else {
    const f = SETS[sc.mekan] || SETS['orman-gece'];
    if (!SETS[sc.mekan]) console.warn('Bilinmeyen mekan:', sc.mekan, '-> orman-gece');
    s = f(rng(hash(key)));
    s.starPts = Array.from({ length: s.stars || 0 }, (_, i) => { const q = rng(i * 7 + 1); return [q(), q() * .6, q() * 1.6 + .4, q() * 6]; });
  }
  return (setCache[key] = s);
}

function drawSky(s, cam, t) {
  ctx.fillStyle = vgrad(ctx, 0, GY, [[0, s.sky[0]], [.55, s.sky[1]], [1, s.sky[2]]]); ctx.fillRect(0, 0, W, H);
  const px = -cam.x * .04;
  for (const [x, y, rad, ph] of s.starPts || []) { ctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * .8 + ph)); ctx.fillStyle = '#fff'; ctx.fillRect(((x * W + px) % W + W) % W, y * H, rad, rad); }
  ctx.globalAlpha = 1;
  for (const o of [s.moon, s.sun].filter(Boolean)) {
    const x = o.x * W + px * 2, y = o.y * H, gl = ctx.createRadialGradient(x, y, o.r * .6, x, y, o.r * 5);
    gl.addColorStop(0, o.col + 'aa'); gl.addColorStop(1, o.col + '00'); ctx.fillStyle = gl; ctx.fillRect(x - o.r * 5, y - o.r * 5, o.r * 10, o.r * 10);
    ctx.fillStyle = o.col; ctx.beginPath(); ctx.arc(x, y, o.r, 0, 7); ctx.fill();
  }
}

// ---------- karakter kuklası ----------
// Yerel koordinat: ayaklar (0,0), yukarı negatif, sağa bakıyor (+x). yon=-1 ise aynalanır.
const OUT = '#16121f';
const EMO = { // kaş kalkışı, kaş eğimi (+ iç uç yukarı), ağız kavisi, göz büyüklüğü, baş eğimi
  notr: [0, 0, 2, 1, 0], mutlu: [3, -.1, 7, 1, -.03], uzgun: [2, .45, -5, .95, .1], kizgin: [-3, -.5, -4, .9, .04],
  saskin: [9, 0, 0, 1.25, -.04], korkmus: [7, .4, -2, 1.2, .05], dusunceli: [1, .2, 0, .9, .06],
};
function limb(a, b, c, w, col) { // iki parçalı uzuv: önce kontur, sonra renk
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [lw, cl] of [[w + 7, OUT], [w, col]]) { ctx.strokeStyle = cl; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
}
const seg = (p, ang, len) => [p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len];
function blob(fill, path) { ctx.fillStyle = fill; ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath(); path(); ctx.fill(); ctx.stroke(); }

// jest -> [ön kol üst açısı, dirsek bükümü, arka kol üst açısı, dirsek] (0 = aşağı sarkık, + = ileri)
function gesturePose(name, t) {
  switch (name) {
    case 'el-salla': return [2.7, .3 + Math.sin(t * 11) * .45, -.1, .2];
    case 'isaret': return [1.55, .05, -.1, .2];
    case 'kollar-acik': return [1.0, .4, -1.0, -.4];
    case 'dusun': return [.35, 2.55, -.05, .3];
    case 'yumruk': return [2.3, 1.2 + Math.sin(t * 16) * .15, -.2, .3];
    case 'omuz-silk': return [.45, 1.5, -.45, -1.5];
    case 'dur': return [1.45, -.9, -.1, .2];
    case 'yuz-kapat': return [.6, 2.75, .5, 2.65];
    case 'konus': return [.45 + Math.sin(t * 3.1) * .18, .95 + Math.sin(t * 4.3) * .2, -.08, .2];
    default: return null;
  }
}

function drawCharacter(ch, st, t) {
  const s = ch.boy || 1, skin = ch.ten || '#f2c6a0', shirt = ch.kiyafet || '#3a6ea5', pants = ch.pantolon || '#2b2f45';
  const hair = ch.sac || '#3b2a20', shoes = ch.ayakkabi || '#1e1a1a', e = EMO[st.emo] || EMO.notr;
  const seed = hash(st.kim) % 1000;
  ctx.save(); ctx.translate(st.x, 0);
  // gölge
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 4, 70 * s, 12 * s, 0, 0, 7); ctx.fill();
  ctx.scale(st.yon * s, s);

  const ph = st.ph, walk = st.walking ? 1 : 0;
  const breath = Math.sin(t * 2.2 + seed) * 1.6;
  const L1 = 84, L2 = 84;
  const hipY0 = -184;
  const legs = [1, -1].map(side => {
    // bacaklar kalçada biraz ayrık
    const p = ph + (side > 0 ? 0 : Math.PI);
    const th = walk ? Math.sin(p) * .48 : side * .05, kn = walk ? .12 + Math.max(0, -Math.cos(p)) * .8 : .03;
    const hip = [side * 9, hipY0], knee = seg(hip, th, L1), ank = seg(knee, th - kn, L2);
    return { hip, knee, ank };
  });
  const ground = -9 - Math.max(...legs.map(l => l.ank[1])); // en alttaki ayak yere bassın
  ctx.translate(0, ground);
  const shY = -312 + breath * .5 - (st.gest === 'omuz-silk' ? 10 * st.gw : 0);

  // kollar
  let fa = walk ? -Math.sin(ph) * .5 : .08 + Math.sin(t * 1.3 + seed) * .03, fe = walk ? .35 : .15;
  let ba = walk ? Math.sin(ph) * .5 : -.06 + Math.sin(t * 1.1 + seed) * .03, be = walk ? .35 : .12;
  const g = st.gest && gesturePose(st.gest, t);
  if (g) { fa = lerp(fa, g[0], st.gw); fe = lerp(fe, g[1], st.gw); ba = lerp(ba, g[2], st.gw); be = lerp(be, g[3], st.gw); }
  const arm = (sx, a, el) => { const sh = [sx, shY + 12], elb = seg(sh, a, 80), hand = seg(elb, a + el, 74); return { sh, elb, hand }; };
  const backArm = arm(-18, ba, be), frontArm = arm(20, fa, fe);
  const drawArm = (A, col) => { limb(A.sh, A.elb, A.hand, 28, col); blob(skin, () => ctx.arc(A.hand[0], A.hand[1], 14, 0, 7)); };

  // pelerin (en arkada)
  if (ch.pelerin) {
    const sw = Math.sin(t * 2.5 + seed) * 12 - walk * 40;
    blob(ch.pelerin, () => { ctx.moveTo(-22, shY); ctx.quadraticCurveTo(-70 + sw, -150, -95 + sw * 1.6, -30); ctx.lineTo(10 + sw * .4, -40); ctx.lineTo(24, shY); ctx.closePath(); });
  }
  drawArm(backArm, shade(shirt, -.25));
  legs.slice().reverse().forEach((l, i) => {
    const col = i === 0 ? shade(pants, -.25) : pants;
    limb(l.hip, l.knee, l.ank, 36, col);
    blob(i === 0 ? shade(shoes, -.2) : shoes, () => { ctx.ellipse(l.ank[0] + 14, l.ank[1] + 2, 26, 11, 0, 0, 7); });
  });
  // gövde
  const hipY = hipY0 + 6;
  if (ch.etek) blob(shade(pants, 0), () => { ctx.moveTo(-28, hipY - 20); ctx.lineTo(32, hipY - 20); ctx.lineTo(50 + walk * Math.sin(ph) * 6, hipY + 62); ctx.lineTo(-46, hipY + 62); ctx.closePath(); });
  const tg = ctx.createLinearGradient(-30, shY, 40, hipY); tg.addColorStop(0, shade(shirt, .12)); tg.addColorStop(1, shade(shirt, -.15));
  blob(tg, () => { ctx.moveTo(-36, shY + 8); ctx.quadraticCurveTo(4, shY - 12, 44, shY + 8); ctx.lineTo(36, hipY); ctx.quadraticCurveTo(2, hipY + 10, -30, hipY); ctx.closePath(); });
  if (!ch.etek) { ctx.fillStyle = shade(pants, -.1); ctx.fillRect(-29, hipY - 14, 64, 12); }
  // boyun + baş
  blob(shade(skin, -.08), () => ctx.rect(-4, shY - 26, 20, 30));
  const hx = 8, hy = shY - 70;
  ctx.save(); ctx.translate(hx, hy + 40); ctx.rotate(e[4] + Math.sin(t * 7.3) * .035 * st.talk + Math.sin(t * .9 + seed) * .015); ctx.translate(0, -40);
  drawHead(ch, st, e, t, skin, hair, seed);
  ctx.restore();
  drawArm(frontArm, shirt);
  ctx.restore();
}

function drawHead(ch, st, e, t, skin, hair, seed) {
  const style = ch.sacStil || 'kisa';
  // arka saç
  if (style === 'uzun') blob(shade(hair, -.15), () => { ctx.moveTo(-58, -20); ctx.quadraticCurveTo(-70, 70, -40, 100); ctx.lineTo(30, 95); ctx.quadraticCurveTo(10, 40, 30, -20); ctx.closePath(); });
  if (style === 'at-kuyrugu') { const sw = Math.sin(t * 3 + seed) * 10; blob(hair, () => { ctx.moveTo(-48, -30); ctx.quadraticCurveTo(-95 + sw, 10, -78 + sw, 80); ctx.quadraticCurveTo(-60, 20, -38, -8); ctx.closePath(); }); }
  if (style === 'topuz') blob(hair, () => ctx.arc(-36, -56, 24, 0, 7));
  // yüz
  blob(skin, () => ctx.ellipse(0, 0, 56, 62, 0, 0, 7));
  blob(shade(skin, -.1), () => ctx.ellipse(-12, 6, 9, 13, 0, 0, 7)); // kulak
  blob(skin, () => { ctx.moveTo(50, -2); ctx.quadraticCurveTo(66, 10, 52, 18); }); // burun
  // gözler
  const blink = st.blink, big = e[3];
  for (const ex of [16, 40]) {
    const k = ex === 16 ? .82 : 1; // uzak göz biraz küçük (3/4 görünüm)
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, -6, 8.5 * k * big, 11 * big * (1 - blink * .92), 0, 0, 7); ctx.fill();
    if (blink < .7) { ctx.fillStyle = ch.goz || '#2a1a12'; ctx.beginPath(); ctx.arc(ex + 2.5 + st.look * 2, -5, 5.2 * k, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(ex + 3.5, -9, 2, 2); }
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(ex, -6, 8.5 * k * big, 11 * big * (1 - blink * .92), 0, 0, 7); ctx.stroke();
    // kaş: iç uç (öteki göze bakan) eğimle kalkar
    const inner = ex === 16 ? 1 : -1, by = -24 - e[0];
    ctx.strokeStyle = shade(hair, -.2); ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(ex - 10 * inner, by + e[1] * 7); ctx.lineTo(ex + 10 * inner, by - e[1] * 9); ctx.stroke();
  }
  if (ch.gozluk) { ctx.strokeStyle = '#222'; ctx.lineWidth = 3; for (const ex of [16, 40]) { ctx.beginPath(); ctx.arc(ex, -6, 14, 0, 7); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(26, -8); ctx.lineTo(30, -8); ctx.stroke(); }
  if (st.emo === 'mutlu' || ch.yanak) { ctx.fillStyle = 'rgba(240,110,120,.35)'; ctx.beginPath(); ctx.ellipse(40, 14, 10, 6, 0, 0, 7); ctx.fill(); }
  // ağız: konuşurken ses zarfına göre açılır
  const mx = 30, my = 30, open = st.talk;
  if (open > .06) {
    ctx.fillStyle = '#4a1c22'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(mx, my + open * 4, 9 + (1 - open) * 4, 2 + open * 11, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d0626a'; ctx.beginPath(); ctx.ellipse(mx, my + open * 9, 6, open * 4, 0, 0, 7); ctx.fill();
  } else if (st.emo === 'saskin') { ctx.fillStyle = '#4a1c22'; ctx.beginPath(); ctx.ellipse(mx, my + 2, 6, 8, 0, 0, 7); ctx.fill(); }
  else { ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mx - 12, my); ctx.quadraticCurveTo(mx, my + e[2], mx + 12, my - 1); ctx.stroke(); }
  if (ch.sakal) blob(ch.sakal, () => { ctx.moveTo(-30, 18); ctx.quadraticCurveTo(-10, 70, 30, 66); ctx.quadraticCurveTo(58, 60, 54, 20); ctx.quadraticCurveTo(30, 44 + open * 10, 12, 30); ctx.closePath(); });
  // ön saç
  if (style === 'kel') return;
  if (style === 'kivircik') { for (let i = 0; i < 9; i++) { const a = Math.PI * (1.02 + i * .12); blob(hair, () => ctx.arc(Math.cos(a) * 50, Math.sin(a) * 54 - 8, 20, 0, 7)); } return; }
  blob(hair, () => { ctx.ellipse(-2, -14, 60, 54, 0, Math.PI * .93, Math.PI * 2.02); ctx.quadraticCurveTo(40, -30, 22, -38); ctx.quadraticCurveTo(0, -20, -50, 4); ctx.closePath(); });
  if (style === 'uzun') blob(hair, () => { ctx.moveTo(-50, -10); ctx.quadraticCurveTo(-64, 40, -46, 70); ctx.quadraticCurveTo(-34, 30, -30, -14); ctx.closePath(); });
}

// ---------- sahne durumu (t anında kim nerede, ne yapıyor) ----------
function sceneAt(t) { const S = D.sahneler; for (let i = 0; i < S.length; i++) if (t < S[i].end) return [S[i], i]; return [S[S.length - 1], S.length - 1]; }
function castAt(sc, t) {
  const cast = {}, order = [];
  for (const o of sc.oyuncular || []) { cast[o.kim] = { kim: o.kim, x: o.x ?? 0, yon: o.yon ?? 1, emo: o.duygu || 'notr', walking: false, ph: 0, talk: 0, gest: null, gw: 0, look: 0, vis: o.gorunur !== false, auto: true }; order.push(o.kim); }
  let lastSpeaker = null;
  for (const ev of sc.olaylar) {
    if (t < ev.start) continue;
    const c = ev.kim && cast[ev.kim];
    const win = (a, b) => { const w = Math.min(clamp((t - a) / .25), clamp((b - t) / .25)); return w; };
    switch (ev.tip) {
      case 'yuru': if (!c) break; {
        const p = clamp((t - ev.start) / Math.max(.01, ev.end - ev.start));
        c.x = lerp(ev.from, ev.x, p); if (ev.x !== ev.from) c.yon = Math.sign(ev.x - ev.from);
        if (p < 1) { c.walking = true; c.ph = Math.abs(c.x - ev.from) / 52; c.auto = false; } else if (ev.sonYon) c.yon = ev.sonYon;
        c.vis = true; break; }
      case 'duygu': if (c) c.emo = ev.duygu; break;
      case 'bak': if (c) { c.yon = ev.yon ?? (cast[ev.hedef] ? Math.sign(cast[ev.hedef].x - c.x) || c.yon : c.yon); c.auto = false; } break;
      case 'goster': if (c) c.vis = true; break;
      case 'gizle': if (c) c.vis = false; break;
      case 'jest': if (c && t < ev.end) { c.gest = ev.jest; c.gw = win(ev.start, ev.end); } break;
      case 'replik': if (!c) break;
        if (ev.duygu) c.emo = ev.duygu;
        lastSpeaker = ev.kim;
        if (t < ev.start + ev.konusma) {
          const i = Math.floor((t - ev.start) * 30), env = ev.env || [];
          c.talk = env.length ? smooth(clamp((env[i] || 0) * 1.1)) : .5 + .5 * Math.sin(t * 18);
          const j = ev.jest || (sc.otomatikJest !== false && !c.walking ? 'konus' : null);
          if (j) { c.gest = j; c.gw = win(ev.start, ev.start + ev.konusma); }
        }
        break;
    }
  }
  // dinleyenler son konuşana döner
  if (lastSpeaker && sc.otomatikBakis !== false) for (const k of order) { const c = cast[k]; if (k !== lastSpeaker && c.auto && !c.walking) c.yon = Math.sign(cast[lastSpeaker].x - c.x) || c.yon; }
  for (const k of order) { const c = cast[k]; const bt = (t + (hash(k) % 97) / 31) % 3.7; c.blink = bt < .14 ? Math.sin(bt / .14 * Math.PI) : 0; }
  return { cast, order };
}

// ---------- kamera ----------
function camAt(sc, t, cast) {
  const b = sc.kamera || {}, son = b.son;
  const c0 = { x: b.x ?? 0, y: b.y ?? 0, zoom: b.zoom ?? 1 };
  const drift = tt => son ? mix(c0, { x: son.x ?? c0.x, y: son.y ?? c0.y, zoom: son.zoom ?? c0.zoom }, ease(clamp((tt - sc.start) / (sc.end - sc.start)))) : c0;
  const resolve = ev => { const h = ev.hedef && cast[ev.hedef]; if (h) { const z = ev.zoom ?? 1.8, s = D.karakterler[ev.hedef].boy || 1; return frame(h.x, -340 * s, z, .5 - h.yon * .12, .45); } return { x: ev.x ?? 0, y: ev.y ?? 0, zoom: ev.zoom ?? 1 }; };
  const kams = sc.olaylar.filter(e => e.tip === 'kamera');
  let c = drift(kams.length ? Math.min(t, kams[0].start) : t);
  let shake = b.sarsinti || 0;
  for (const ev of kams) {
    if (t < ev.start) break;
    const p = ev.kesme ? 1 : ease(clamp((t - ev.start) / Math.max(.01, ev.end - ev.start)));
    c = mix(c, resolve(ev), p);
    if (ev.sarsinti) shake = ev.sarsinti * clamp(1 - (t - ev.start) / Math.max(.3, ev.end - ev.start));
  }
  // replik planı: yakın / orta çekim (konuşma boyunca kesme)
  for (const ev of sc.olaylar) if (ev.tip === 'replik' && ev.plan && t >= ev.start - .05 && t < ev.end) {
    const h = cast[ev.kim]; if (!h) continue;
    const s = D.karakterler[ev.kim].boy || 1;
    const P = { yakin: [2.1, -350, .44, .14], cokyakin: [3, -370, .46, .1], orta: [1.45, -270, .48, .16] }[ev.plan] || [1.45, -270, .48, .16];
    c = frame(h.x, P[1] * s, P[0], .5 - h.yon * P[3], P[2]);
  }
  // el kamerası hissi + sarsıntı
  c = { x: c.x + Math.sin(t * .7) * 4 + Math.sin(t * 1.9) * 2, y: c.y + Math.sin(t * .9 + 1) * 3, zoom: c.zoom * (1 + Math.sin(t * .5) * .004) };
  if (shake) { c.x += (Math.sin(t * 47) + Math.sin(t * 31)) * shake; c.y += (Math.sin(t * 53) + Math.cos(t * 29)) * shake; }
  return c;
}
// Dünya noktasını (wx,wy) ekranda (fx,fy) oranına yerleştiren kamera
function frame(wx, wy, z, fx, fy) { const zk = z * K; return { x: wx - (fx - .5) * W / zk, y: (GY - AY) / K + wy - (fy * H - AY) / zk, zoom: z }; }
const mix = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), zoom: lerp(a.zoom, b.zoom, p) });

// ---------- efektler ----------
const glow = (() => { const c = mk(64, 64), g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c; })();
const tinted = {}; function glowOf(col) { if (tinted[col]) return tinted[col]; const c = mk(64, 64), g = c.getContext('2d'); g.drawImage(glow, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, 64, 64); return (tinted[col] = c); }
function particles(type, t) {
  if (!type) return;
  const q = i => rng(i * 131 + 7);
  if (type === 'ates-bocegi') { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 45; i++) { const r = q(i), a = r(), b = r(), c = r(), d = r();
      const x = (a * W + Math.sin(t * .35 + b * 9) * 90) % W, y = H * (.35 + .55 * c) + Math.sin(t * .5 + d * 7) * 50, s = 18 + 26 * r(), on = .3 + .7 * Math.max(0, Math.sin(t * (1 + d) + a * 20));
      ctx.globalAlpha = on; ctx.drawImage(glowOf('#d8ff8a'), x - s / 2, y - s / 2, s, s); } }
  else if (type === 'yagmur') { ctx.strokeStyle = 'rgba(190,210,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 320; i++) { const r = q(i), x0 = r() * (W + 300), sp = 1500 + r() * 700, y = ((r() * H + t * sp) % (H + 120)) - 60, x = x0 - y * .18; ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 38); } ctx.stroke(); }
  else if (type === 'kar') { ctx.fillStyle = '#fff'; for (let i = 0; i < 180; i++) { const r = q(i), s = 2 + r() * 4, y = ((r() * H + t * (40 + s * 25)) % (H + 20)) - 10, x = (r() * W + Math.sin(t + r() * 9) * 30); ctx.globalAlpha = .5 + r() * .5; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); } }
  else if (type === 'toz') { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 60; i++) { const r = q(i), x = ((r() * W + t * (8 + r() * 14)) % W), y = r() * H * .85 + Math.sin(t * .4 + r() * 9) * 20, s = 6 + r() * 12; ctx.globalAlpha = .12 + .2 * Math.abs(Math.sin(t * .6 + i)); ctx.drawImage(glowOf('#ffe6b0'), x, y, s, s); } }
  else if (type === 'kivilcim') { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 70; i++) { const r = q(i), sp = 60 + r() * 120, y = H - ((r() * H + t * sp) % (H * 1.1)), x = r() * W + Math.sin(t * 2 + i) * 25, s = 6 + r() * 14; ctx.globalAlpha = clamp(y / H) * .9; ctx.drawImage(glowOf('#ff9a40'), x, y, s, s); } }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function godRays(t, col) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) { const a = .05 + .04 * Math.sin(t * .4 + i * 1.7), x = W * (.08 + i * .13); ctx.fillStyle = col; ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + 70, -10); ctx.lineTo(x + 520, H); ctx.lineTo(x + 300, H); ctx.fill(); }
  ctx.restore();
}
const vignette = (() => { const c = mk(W, H), g = c.getContext('2d'), r = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = r; g.fillRect(0, 0, W, H); return c; })();
const grains = [0, 1, 2, 3].map(k => { const c = mk(256, 256), g = c.getContext('2d'), im = g.createImageData(256, 256), r = rng(k + 99); for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); return c; });

function wrap(text, maxW) { const out = []; let line = ''; for (const w of text.split(' ')) { const tryL = line ? line + ' ' + w : w; if (ctx.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL; } if (line) out.push(line); return out; }
function subtitles(sc, t, barH) {
  if (!D.altyazi) return;
  for (const ev of sc.olaylar) {
    if ((ev.tip !== 'replik' && ev.tip !== 'anlatici') || t < ev.start || t > ev.start + ev.konusma + .2) continue;
    const a = Math.min(clamp((t - ev.start) / .15), clamp((ev.start + ev.konusma + .2 - t) / .15));
    const fs = PORTRAIT ? 50 : 42, ch = ev.kim && D.karakterler[ev.kim];
    ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const name = ch ? (ch.ad || ev.kim) : '', lines = wrap(ev.tip === 'anlatici' ? ev.metin : ev.metin, W * .78);
    const lh = fs * 1.25, base = H - Math.max(barH * .5, PORTRAIT ? H * .1 : 60) - (lines.length - 1) * lh * .5 + fs * .35;
    ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 10;
    lines.forEach((l, i) => {
      const y = base + i * lh;
      if (i === 0 && name) { const nw = ctx.measureText(name + ': ').width, tw = ctx.measureText(l).width, x0 = W / 2 - (nw + tw) / 2;
        ctx.textAlign = 'left'; ctx.fillStyle = ch.renk || shade(ch.kiyafet || '#ffffff', .35); ctx.fillText(name + ': ', x0, y); ctx.fillStyle = '#fff'; ctx.fillText(l, x0 + nw, y); ctx.textAlign = 'center'; }
      else { ctx.fillStyle = ev.tip === 'anlatici' ? '#f3e6c8' : '#fff'; if (ev.tip === 'anlatici') ctx.font = `italic 700 ${fs}px ${FONT}`; ctx.fillText(l, W / 2, y); }
    });
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
}
function titleCards(sc, t) {
  for (const ev of sc.olaylar) {
    if (ev.tip !== 'yazi' || t < ev.start || t > ev.end) continue;
    const a = Math.min(clamp((t - ev.start) / .6), clamp((ev.end - t) / .6));
    if (ev.arkaplan === 'siyah') { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
    ctx.globalAlpha = a; ctx.fillStyle = ev.renk || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 20;
    const fs = ev.boyut || (PORTRAIT ? 96 : 88); ctx.font = `900 ${fs}px ${FONT}`;
    const y = H * (ev.konum === 'ust' ? .22 : .45), sc2 = 1 + (t - ev.start) * .012;
    ctx.save(); ctx.translate(W / 2, y); ctx.scale(sc2, sc2); wrap(ev.metin, W * .8).forEach((l, i, arr) => ctx.fillText(l, 0, (i - (arr.length - 1) / 2) * fs * 1.1)); ctx.restore();
    if (ev.alt) { ctx.font = `700 ${fs * .4}px ${FONT}`; ctx.fillStyle = '#e8dcc0'; ctx.fillText(ev.alt, W / 2, y + fs * .95); }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
}

// ---------- ana çizim ----------
function seek(t) {
  const [sc, si] = sceneAt(t), set = getSet(sc);
  const { cast, order } = castAt(sc, t), cam = camAt(sc, t, cast);
  drawSky(set, cam, t);
  for (const [d, c] of set.layers) withLayer(cam, d, () => ctx.drawImage(c, -LW / 2, -(LH - LG)));
  if (set.rays) godRays(t, set.light);
  if (set.lamp) { const x = set.lamp.x * W, y = set.lamp.y * H, g = ctx.createRadialGradient(x, y, 10, x, y, W * .5); g.addColorStop(0, 'rgba(255,190,120,.35)'); g.addColorStop(1, 'rgba(255,190,120,0)'); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  if (set.sea) { ctx.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 12; i++) { const x = ((i * 211 + t * 30) % (W + 200)) - 100, y = GY - 120 + (i % 4) * 22 - cam.y * .3; ctx.fillRect(x, y, 80, 3); } }
  // karakterler: arkadakiler (z küçük) önce
  withLayer(cam, 1, () => {
    const list = order.map(k => [k, (sc.oyuncular.find(o => o.kim === k).z) || 0]).sort((a, b) => a[1] - b[1]);
    for (const [k] of list) { const c = cast[k]; if (c.vis && D.karakterler[k]) drawCharacter(D.karakterler[k], c, t); }
  });
  for (const [d, c] of set.fg || []) withLayer(cam, d, () => ctx.drawImage(c, -LW / 2, -(LH - LG)));
  particles(sc.efekt === undefined ? set.efekt : sc.efekt, t);
  // renk tonu + vinyet + film greni
  const [gc, ga] = sc.ton || set.grade; ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = ga * 2.2; ctx.fillStyle = gc; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.drawImage(vignette, 0, 0);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .07; ctx.fillStyle = ctx.createPattern(grains[Math.floor(t * D.fps) % 4], 'repeat'); ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  titleCards(sc, t);
  // geçişler
  const next = D.sahneler[si + 1], gIn = si === 0 ? 'karart' : (sc.gecis || 'karart'), gOut = next ? (next.gecis || 'karart') : 'karart';
  let fade = 0, fcol = '0,0,0';
  if (gIn !== 'kesme') { fade = Math.max(fade, 1 - clamp((t - sc.start) / (si === 0 ? 1 : .45))); if (gIn === 'beyaz') fcol = '255,255,255'; }
  if (gOut !== 'kesme') { const f = 1 - clamp((sc.end - t) / (next ? .4 : .9)); if (f > fade) { fade = f; fcol = gOut === 'beyaz' ? '255,255,255' : '0,0,0'; } }
  if (fade > 0) { ctx.fillStyle = `rgba(${fcol},${fade})`; ctx.fillRect(0, 0, W, H); }
  // sinema bantları
  let barH = 0;
  if (D.sinemaBantlari) { barH = (H - W / 2.39) / 2 * smooth(clamp(t / 1.2)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, barH); ctx.fillRect(0, H - barH, W, barH); }
  subtitles(sc, t, barH);
}

// ---------- başlatma ----------
const IMAGES = {};
const imgs = D.sahneler.map(s => s.mekan && s.mekan.resim).filter(Boolean);
const TR = 'Aa ıİşŞğĞüÜöÖçÇ';
Promise.all([document.fonts.load(`700 40px Nunito`, TR), document.fonts.load(`900 40px Nunito`, TR), document.fonts.load(`italic 700 40px Nunito`, TR).catch(() => 0),
  ...imgs.map(src => new Promise((ok, no) => { const im = new Image(); im.onload = () => { IMAGES[src] = im; ok(); }; im.onerror = () => no(new Error('Görsel yüklenemedi: ' + src)); im.src = src; }))])
  .then(() => { D.sahneler.forEach(getSet); seek(0); window.READY = true; if (!/render/.test(location.hash)) player(); });
window.seek = seek;

// Tarayıcıda açınca oynatıcı: boşluk = oynat/durdur, tıkla = o ana atla
function player() {
  const au = new Audio('out/ses.wav'), bar = document.getElementById('bar'); let playing = false, t0 = 0, base = 0;
  const now = () => playing ? base + (performance.now() - t0) / 1000 : base;
  const loop = () => { const t = now() % D.total; seek(t); bar.textContent = `${t.toFixed(1)} / ${D.total.toFixed(1)} sn  ·  boşluk: oynat/durdur  ·  tıkla: atla`; requestAnimationFrame(loop); };
  const toggle = () => { if (playing) { base = now(); playing = false; au.pause(); } else { t0 = performance.now(); playing = true; au.currentTime = base; au.play().catch(() => 0); } };
  document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); toggle(); } });
  cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(); base = (e.clientX - r.left) / r.width * D.total; t0 = performance.now(); au.currentTime = base; });
  loop();
}
})();
