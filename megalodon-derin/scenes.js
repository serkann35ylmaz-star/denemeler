// MEGALODON — poster-print scenes timed to the narration (window.TIMINGS from vo/timings.json).
(function (G) {
  'use strict';
  const P = G.Poster, K = P.K, W = P.W, H = P.H, E = P.E, seg = P.seg, lerp = P.lerp, clamp = P.clamp;

  // ---------- timing ----------
  const T = G.TIMINGS || { total: 150, lines: Array.from({ length: 29 }, (_, i) => ({ start: 1.5 + i * 5, end: 1.5 + i * 5 + 4 })) };
  const L = i => T.lines[i].start, Le = i => T.lines[i].end;
  const DURATION = Math.ceil((T.total + 1.0) * 24) / 24;

  // ---------- shark silhouettes ----------
  // side view, facing right, local length ~1000 (tail tip -560 .. snout 440). Megalodon: deep body, blunt snout.
  function sharkPts(tail, jaw) {
    tail = tail || 0; jaw = jaw || 0;
    const body = [[440, -10], [415, -62], [340, -118], [200, -160], [40, -172], [-120, -150], [-280, -96], [-400, -44], [-450, -24],
      // tail upper lobe
      [-470 + tail * 10, -60 + tail * 30], [-560 + tail * 30, -250 + tail * 60], [-530 + tail * 26, -150 + tail * 40], [-500 + tail * 10, -10],
      // tail lower lobe
      [-540 + tail * 22, 150 + tail * 40], [-470 + tail * 8, 40 + tail * 10],
      [-410, 34], [-300, 80], [-200, 104], [-80, 140], [60, 156], [210, 140], [320, 106 + jaw * 30], [390, 70 + jaw * 40], [432, 30 + jaw * 20]];
    return P.catmull(body, 6, true);
  }
  const finDorsal = [[40, -168], [-30, -330], [-60, -326], [-120, -160]];
  const finPec = [[210, 120], [120, 150], [-10, 330], [30, 336], [170, 210]];
  const finPelvic = [[-200, 104], [-250, 108], [-290, 170], [-240, 150]];
  function shark(ctx, o) {
    o = o || {};
    const fill = o.fill || K.ink, rim = o.rim || K.olive, jaw = o.jaw || 0, tail = o.tail || 0;
    const bodyP = P.poly(sharkPts(tail, jaw));
    ctx.save();
    // rim light from the surface + a printed outline so the ink body reads against ink water
    const parts = [bodyP, P.poly(P.catmull(finDorsal, 6, true)), P.poly(P.catmull(finPec, 6, true)), P.poly(P.catmull(finPelvic, 5, true))];
    if (rim) { ctx.save(); ctx.strokeStyle = rim; ctx.lineJoin = 'round'; ctx.lineWidth = (o.outline || 9) / Math.abs(ctx.getTransform().a || 1) * Math.abs(ctx.getTransform().a || 1); parts.forEach(q => ctx.stroke(q)); ctx.translate(0, -12); ctx.fillStyle = rim; ctx.fill(bodyP); ctx.fill(parts[1]); ctx.restore(); }
    ctx.fillStyle = fill;
    ctx.fill(P.poly(P.catmull(finPec, 6, true))); ctx.fill(P.poly(P.catmull(finPelvic, 5, true)));
    ctx.fill(P.poly(P.catmull(finDorsal, 6, true)));
    ctx.fill(bodyP);
    // gill slits, mouth line, teeth, eye
    ctx.strokeStyle = rim || K.olive; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const x = 250 - i * 24; ctx.beginPath(); ctx.moveTo(x, -70); ctx.quadraticCurveTo(x - 10, 10, x - 4, 80); ctx.stroke(); }
    if (o.teeth !== false) {
      // gaping mouth: dark cavity, olive gum line, big upper teeth, lower row pointing up
      const g = 18 + jaw * 70;
      const mouth = new Path2D(); mouth.moveTo(432, 22); mouth.quadraticCurveTo(360, 30, 280, 58); mouth.quadraticCurveTo(350, 58 + g, 420, 40 + g * 0.6); mouth.closePath();
      ctx.fillStyle = '#050604'; ctx.fill(mouth); ctx.strokeStyle = rim || K.olive; ctx.lineWidth = 4; ctx.stroke(mouth);
      ctx.fillStyle = K.paper;
      for (let i = 0; i < 10; i++) { const u = i / 9, x = 425 - u * 140, y = 24 + u * 32; const w = 8 - u * 3, l = 30 - u * 12; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x - 2, y + l); ctx.fill(); }
      if (jaw > 0.05) for (let i = 0; i < 8; i++) { const u = i / 7, x = 410 - u * 120, y = 40 + g * 0.6 + (58 + g - 40 - g * 0.6) * u * 0.9; const w = 7 - u * 2, l = (22 - u * 8) * Math.min(1, jaw * 2); ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x + 1, y - l); ctx.fill(); }
    }
    if (o.eye) { ctx.fillStyle = o.eye; ctx.beginPath(); ctx.arc(375, -42, 9, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // backlight: olive halftone pool of light behind a silhouette so it reads in deep water
  function glow(ctx, x, y, rx, ry, amt, col) {
    P.halftone(ctx, x - rx, y - ry, rx * 2, ry * 2, (px, py) => amt * Math.pow(clamp(1 - Math.hypot((px - x) / rx, (py - y) / ry), 0, 1), 1.3), col || K.olive, 15);
  }

  // big frontal jaw (close-up, 3/4 front). open 0..1
  function jaws(ctx, cx, cy, s, open, o) {
    o = o || {};
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    const gap = 60 + open * 170;
    // head mass
    ctx.fillStyle = K.ink;
    ctx.beginPath(); ctx.ellipse(0, -60, 560, 330, 0, Math.PI, 0); ctx.lineTo(560, 120); ctx.quadraticCurveTo(0, 420 + gap * 0.3, -560, 120); ctx.closePath(); ctx.fill();
    // olive rim along the snout top
    ctx.strokeStyle = K.olive; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(0, -60, 560, 330, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    // mouth cavity (deeper ink, with halftone throat)
    const mouth = new Path2D();
    mouth.moveTo(-430, 40); mouth.quadraticCurveTo(0, -60 - gap * 0.25, 430, 40); mouth.quadraticCurveTo(0, 120 + gap, -430, 40); mouth.closePath();
    ctx.fillStyle = '#060805'; ctx.fill(mouth);
    ctx.save(); ctx.clip(mouth);
    P.halftone(ctx, -440, -200, 880, 600, (x, y) => 0.18 * clamp(1 - Math.hypot(x, (y - 80) * 1.6) / 380, 0, 1), K.olive, 16);
    ctx.restore();
    // gums
    ctx.strokeStyle = K.olive; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(-430, 40); ctx.quadraticCurveTo(0, -60 - gap * 0.25, 430, 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-430, 40); ctx.quadraticCurveTo(0, 120 + gap, -430 + 860, 40); ctx.stroke();
    // teeth: big triangles along both jaws, second row smaller behind
    const qb = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
    function row(cyCtrl, dir, n, len, shrink) {
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = qb(-430, 0, 430, t), y = qb(40, cyCtrl, 40, t);
        const dx = qb(-430, 0, 430, t + 0.01) - x, dy = qb(40, cyCtrl, 40, t + 0.01) - y, a = Math.atan2(dy, dx);
        const L = len * (0.55 + 0.45 * Math.sin(Math.PI * t)) * shrink, w = 30 * (0.6 + 0.4 * Math.sin(Math.PI * t)) * shrink;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = K.paper; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0); ctx.lineTo(0, dir * L); ctx.closePath(); ctx.fill();
        // serration ticks
        ctx.strokeStyle = K.olive; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w * 0.5, dir * L * 0.3); ctx.lineTo(0, dir * L * 0.85); ctx.stroke();
        ctx.restore();
      }
    }
    row(-60 - gap * 0.25, 1, 13, 120, 1);
    row(120 + gap, -1, 12, 105, 1);
    // eyes: tiny lime glints far back on the head
    if (o.eyes) { ctx.fillStyle = K.lime; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 440, -150, 10, 0, 7); ctx.fill(); } }
    ctx.restore();
  }

  // fossil tooth (front view). s = height px
  function tooth(ctx, x, y, s, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s / 1.5, s / 1.5);
    const blade = new Path2D(); const n = 30;
    blade.moveTo(-0.46, 0.17);
    for (let i = 1; i <= n; i++) { const t = i / n; blade.lineTo(-0.46 * (1 - t) - ((i % 2) ? 0.014 : 0), 0.17 - t * 1.17); }
    for (let i = n; i >= 0; i--) { const t = i / n; blade.lineTo(0.46 * (1 - t) + 0.04 * Math.sin(t * Math.PI) + ((i % 2) ? 0.014 : 0), 0.17 - t * 1.17); }
    blade.closePath();
    ctx.fillStyle = o.root || K.olive;
    ctx.beginPath(); ctx.moveTo(-0.5, 0.18); ctx.lineTo(-0.56, 0.42); ctx.lineTo(-0.42, 0.55); ctx.lineTo(-0.15, 0.46); ctx.lineTo(0, 0.4); ctx.lineTo(0.15, 0.46); ctx.lineTo(0.42, 0.55); ctx.lineTo(0.56, 0.42); ctx.lineTo(0.5, 0.18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = o.blade || K.paper; ctx.fill(blade);
    ctx.fillStyle = o.band || K.ink; ctx.beginPath(); ctx.moveTo(-0.47, 0.13); ctx.lineTo(0, 0.05); ctx.lineTo(0.47, 0.13); ctx.lineTo(0.47, 0.22); ctx.lineTo(0, 0.15); ctx.lineTo(-0.47, 0.22); ctx.closePath(); ctx.fill();
    // halftone shading on the blade's right half
    ctx.save(); ctx.clip(blade);
    ctx.fillStyle = o.shade || K.olive; const c = 0.035;
    for (let yy = -1.0; yy < 0.2; yy += c) for (let xx = 0; xx < 0.5; xx += c) { const d = clamp((xx - 0.02) * 1.6 + (yy + 1) * 0.15, 0, 0.8); if (d < 0.05) continue; ctx.beginPath(); ctx.arc(xx + ((Math.round(yy / c) % 2) ? c / 2 : 0), yy, Math.sqrt(d) * c * 0.6, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.restore();
  }

  // ---------- environment ----------
  // depth -> ink mix; returns density of ink (0 paper .. 1 ink) for a vertical ocean
  function oceanBg(ctx, top, darkness, o) {
    o = o || {};
    // base: olive -> ink posterised bands, with halftone at band seams
    ctx.fillStyle = K.ink; ctx.fillRect(0, 0, W, H);
    const surf = top; // y of surface line
    if (surf > -400) {
      // sky/paper above the surface
      ctx.fillStyle = K.paper; ctx.fillRect(0, 0, W, Math.max(0, surf));
      ctx.fillStyle = K.olive; ctx.fillRect(0, surf, W, 520 * (1 - darkness));
      // halftone fade olive -> ink
      P.halftone(ctx, 0, surf + 520 * (1 - darkness) - 10, W, 420, (x, y) => clamp(1 - (y - (surf + 520 * (1 - darkness))) / 420, 0, 1) * 0.9, K.olive, 14);
      // surface line: a thin trembling paper line
      ctx.strokeStyle = K.paper; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = 0; x <= W; x += 12) { const y = surf + Math.sin(x / 70 + (o.t || 0) * 0.7) * 4; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      // light shafts: faint paper halftone wedges
      for (let k = 0; k < 4; k++) {
        const x0 = 140 + k * 260 + Math.sin((o.t || 0) * 0.15 + k) * 30;
        P.halftone(ctx, x0 - 160, surf, 420, 900, (x, y) => { const dx = x - (x0 + (y - surf) * 0.25); const w = 40 + (y - surf) * 0.12; return clamp(1 - Math.abs(dx) / w, 0, 1) * clamp(1 - (y - surf) / 900, 0, 1) * 0.18 * (1 - darkness); }, K.paper, 12);
      }
    } else if (!o.noDots) {
      // deep water: very sparse olive halftone haze, stronger near top
      P.halftone(ctx, 0, 0, W, H * 0.45, (x, y) => clamp(1 - y / (H * 0.45), 0, 1) * 0.12 * (1 - darkness) * (0.6 + 0.4 * P.vnoise(x / 200, y / 200)), K.olive, 16);
    }
  }
  // marine snow: few, slow, small paper specks (deterministic)
  function snow(ctx, t, n, alpha) {
    ctx.save(); ctx.fillStyle = K.paper; ctx.globalAlpha = alpha == null ? 0.35 : alpha;
    for (let i = 0; i < (n || 40); i++) {
      const sx = P.hash(i * 3 + 1) * W, sp = 8 + P.hash(i * 3 + 2) * 18, r = 1 + P.hash(i * 3 + 3) * 2.6;
      const y = ((P.hash(i * 7) * H + t * sp) % (H + 40)) - 20, x = sx + Math.sin(t * 0.3 + i) * 10;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  // label: small spaced Oswald caps
  function label(ctx, s, x, y, o) { o = o || {}; P.text(ctx, s, x, y, Object.assign({ fam: P.FONT.label, w: 500, size: 30, track: 6, color: K.paper }, o)); }
  function title(ctx, s, x, y, size, o) { P.text(ctx, s, x, y, Object.assign({ size: size, color: K.paper }, o)); }

  // ---------- scenes ----------
  // each: [startTime, draw(ctx, t, lt)]
  const S = [];
  const add = (start, fn) => S.push({ start, fn });

  // A — descent from the surface into the dark; title MEGALODON as the giant passes
  add(0, (ctx, t, lt) => {
    const dEnd = L(2) - 0.2, p = seg(t, 0, L(1) + 0.6, E.inOut);
    const surf = lerp(420, -700, p);
    oceanBg(ctx, surf, 0.35 * p, { t });
    if (p > 0.5) glow(ctx, W / 2, 1150, 640, 520, 0.45 * seg(t, L(1) - 1.5, L(1) + 0.5), K.olive);
    snow(ctx, t, 30, 0.3);
    // the silhouette passes behind the title, huge, diagonal
    const sp = seg(t, L(1) - 1.8, dEnd, E.inOut);
    if (sp > 0) {
      ctx.save(); ctx.translate(lerp(1900, -900, sp), lerp(1250, 980, sp)); ctx.rotate(-0.12); ctx.scale(-2.1, 2.1);
      shark(ctx, { tail: Math.sin(t * 1.6), rim: K.olive, eye: K.lime, jaw: 0.6 }); ctx.restore();
    }
    // title prints in on "Megalodon."
    const tp = seg(t, L(1), L(1) + 0.5, E.out);
    if (tp > 0) {
      const fit = Math.min(250, 250 * 940 / P.measure(ctx, 'MEGALODON', 250, P.FONT.title, 400, 4));
      P.printText(ctx, 'MEGALODON', W / 2, 520, tp, { size: fit, align: 'center', color: K.paper, track: 4 });
      label(ctx, 'DERİNLERİN EFSANESİ', W / 2, 600, { align: 'center', alpha: seg(t, L(1) + 0.6, L(1) + 1.2), color: K.lime, size: 28 });
    }
  });

  // B — ruler of the ancient sea: 20 million years, 15–20 m, bigger than a bus
  add(L(2) - 0.2, (ctx, t, lt) => {
    oceanBg(ctx, -2000, 0.65, { t });
    snow(ctx, t, 26, 0.25);
    const mpx = 44, x0 = 80, len = 18 * mpx; // 18 m drawn
    const sc = len / 1000, cam = 1 + 0.03 * seg(t, L(2), L(4));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(cam, cam); ctx.translate(-W / 2, -H / 2);
    // era counter first (line 2)
    const era = seg(t, L(2) + 0.2, Le(2), E.out);
    title(ctx, Math.round(20 * era) + ' MİLYON YIL', W / 2, 360, 120, { align: 'center' });
    label(ctx, 'DENİZLERİN HÜKÜMDARI', W / 2, 420, { align: 'center', color: K.lime, alpha: era });
    // shark glides in from the left and settles
    const gp = seg(t, L(2) + 0.6, L(3) + 1.2, E.out);
    glow(ctx, lerp(-200, 540, gp), 960, 620, 360, 0.5);
    ctx.save(); ctx.translate(lerp(-700, x0 + 560 * sc, gp), 960 + Math.sin(t * 0.8) * 10); ctx.scale(sc, sc);
    shark(ctx, { tail: Math.sin(t * 1.3) * 0.6, eye: K.lime, jaw: 0.35 + 0.35 * Math.max(0, Math.sin(t * 0.9)) }); ctx.restore();
    // scale bar + bus outline (line 3)
    const bp = seg(t, L(3), L(3) + 1.0, E.out);
    if (bp > 0) {
      const y = 1330;
      ctx.fillStyle = K.paper; ctx.fillRect(x0, y, 20 * mpx * bp, 4);
      for (let m = 0; m <= 20; m += 5) if (m * mpx <= 20 * mpx * bp) { ctx.fillRect(x0 + m * mpx - 2, y - 14, 4, 32); label(ctx, m + ' M', x0 + m * mpx, y + 52, { align: m ? (m === 20 ? 'right' : 'center') : 'left', size: 24, track: 2 }); }
      ctx.fillStyle = K.lime; ctx.fillRect(x0 + 15 * mpx, y - 6, 5 * mpx * seg(t, L(3) + 0.8, L(3) + 1.6), 16);
      label(ctx, '15–20 M', x0 + 20 * mpx, y - 30, { align: 'right', color: K.lime, alpha: seg(t, L(3) + 1.2, L(3) + 1.8) });
      // city bus (12 m) as paper outline underneath, for scale
      const bb = seg(t, L(3) + 4.6, L(3) + 5.4, E.out);
      if (bb > 0) {
        ctx.save(); ctx.globalAlpha = bb; ctx.strokeStyle = K.paper; ctx.lineWidth = 4;
        const bx = x0, by = 1460, bw = 12 * mpx, bh = 150;
        ctx.strokeRect(bx, by, bw, bh); for (let k = 0; k < 7; k++) ctx.strokeRect(bx + 30 + k * 84, by + 22, 60, 52);
        for (const wx of [bx + 120, bx + bw - 120]) { ctx.beginPath(); ctx.arc(wx, by + bh, 34, 0, 7); ctx.stroke(); }
        label(ctx, 'OTOBÜS · 12 M', bx + bw + 24, by + 90, { size: 26 });
        ctx.restore();
      }
    }
    ctx.restore();
  });

  // C — the tooth (line 4), then the bite force with the jaw close-up (line 5)
  add(L(4) - 0.15, (ctx, t, lt) => {
    oceanBg(ctx, -2000, 0.8, { t, noDots: true });
    if (t < L(5) - 0.1) {
      // tooth on a paper card, next to a hand outline for scale
      const tp = seg(t, L(4), L(4) + 1.2, E.out);
      ctx.fillStyle = K.paper; ctx.fillRect(110, 380, 860, 1200);
      tooth(ctx, 470, lerp(1260, 1010, tp), 660 * lerp(0.9, 1, tp), { blade: K.ink, root: K.olive, band: K.olive, shade: '#2b3128' });
      // ruler
      const rp = seg(t, L(4) + 0.8, L(4) + 2.0);
      ctx.fillStyle = K.ink; ctx.fillRect(820, 1350 - 720 * rp, 8, 720 * rp);
      for (let cm = 0; cm <= 18; cm++) if (cm * 40 <= 720 * rp) ctx.fillRect(820, 1350 - cm * 40, cm % 3 ? 22 : 40, 4);
      P.printText(ctx, '18 CM', W / 2, 1520, seg(t, L(4) + 3.8, L(4) + 4.3), { size: 120, color: K.ink, align: 'center' });
      label(ctx, 'TEK BİR DİŞ', 160, 470, { color: K.olive, alpha: tp });
      ctx.fillStyle = K.lime; ctx.fillRect(W / 2 - 110, 1545, 220 * seg(t, L(4) + 4.2, L(4) + 4.8), 12);
    } else {
      const op = seg(t, L(5), L(5) + 1.6, E.inOut), cam = lerp(1.0, 1.2, seg(t, L(5), L(6)));
      jaws(ctx, W / 2, 1080, cam, op, { eyes: true });
      const np = seg(t, L(5) + 1.0, L(5) + 2.2, E.out);
      title(ctx, Math.round(100000 * np).toLocaleString('tr-TR') + '+ N', W / 2, 400, 140, { align: 'center', alpha: clamp(np * 3, 0, 1) });
      label(ctx, 'ISIRMA KUVVETİ · TAHMİN', W / 2, 460, { align: 'center', color: K.lime, alpha: np });
    }
  });

  // D — whale bones with bite gouges
  add(L(6) - 0.15, (ctx, t, lt) => {
    ctx.fillStyle = K.paper; ctx.fillRect(0, 0, W, H);
    const cam = lerp(1.0, 1.08, seg(t, L(6), L(7)));
    ctx.save(); ctx.translate(W / 2, 1000); ctx.scale(cam, cam); ctx.translate(-W / 2, -1000);
    // one huge fossil rib, diagonal, printed in ink with olive halftone shading
    const rib = new Path2D();
    rib.moveTo(120, 1650); rib.bezierCurveTo(260, 1150, 600, 760, 980, 640); rib.lineTo(1000, 760);
    rib.bezierCurveTo(660, 880, 360, 1230, 250, 1700); rib.closePath();
    ctx.fillStyle = K.ink; ctx.fill(rib);
    ctx.save(); ctx.clip(rib); P.halftone(ctx, 100, 600, 920, 1120, (x, y) => 0.35 * clamp((x + y - 1500) / 900, 0, 1), K.olive, 12); ctx.restore();
    // bite gouges: deep V notches cut out of the upper edge, appearing one by one
    const gp = seg(t, L(6) + 0.5, L(6) + 2.4, E.lin);
    for (let i = 0; i < 7; i++) {
      if (gp < (i + 1) / 7) break;
      const u = 0.22 + i * 0.09, bx = (1 - u) ** 3 * 120 + 3 * (1 - u) ** 2 * u * 260 + 3 * (1 - u) * u * u * 600 + u ** 3 * 980;
      const by = (1 - u) ** 3 * 1650 + 3 * (1 - u) ** 2 * u * 1150 + 3 * (1 - u) * u * u * 760 + u ** 3 * 640;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(-0.75 + i * 0.05);
      ctx.fillStyle = K.paper; ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(16, -6); ctx.lineTo(0, 70); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = K.lime; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(0, 70); ctx.lineTo(16, -6); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    label(ctx, 'FOSİL BALİNA KEMİĞİ', 80, 380, { color: K.ink, size: 30 });
    title(ctx, 'ISIRIK İZLERİ', 80, 520, 130, { color: K.ink, alpha: seg(t, L(6) + 0.4, L(6) + 1.2) });
    ctx.fillStyle = K.lime; ctx.fillRect(80, 545, 280 * seg(t, L(6) + 1.2, L(6) + 1.8), 12);
  });

  // E — the sea cools, a rival arrives, the giant dissolves into dots (extinction)
  add(L(7) - 0.15, (ctx, t, lt) => {
    // cooling: paper creeps up as the warm olive retreats
    const cool = seg(t, L(7), L(8), E.inOut);
    ctx.fillStyle = K.ink; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = K.olive; ctx.fillRect(0, 0, W, lerp(900, 380, cool));
    P.halftone(ctx, 0, lerp(900, 380, cool) - 10, W, 360, (x, y) => clamp(1 - (y - lerp(900, 380, cool)) / 360, 0, 1) * 0.85, K.olive, 14);
    // thermometer line falling
    const th = lerp(0.85, 0.25, cool);
    ctx.fillStyle = K.paper; ctx.fillRect(950, 300, 12, 600);
    ctx.fillStyle = K.lime; ctx.fillRect(946, 300 + 600 * (1 - th), 20, 600 * th);
    ctx.beginPath(); ctx.arc(956, 930, 34, 0, 7); ctx.fill();
    label(ctx, 'OKYANUS SOĞUDU', 80, 360, { alpha: seg(t, L(7) + 0.2, L(7) + 0.8) });
    // great white (line 8) slides in, sleeker, olive
    const wp = seg(t, L(8) + 1.2, L(8) + 2.8, E.out);
    if (wp > 0 && t < L(9) + 0.6) {
      ctx.save(); ctx.translate(lerp(1500, 690, wp), 1360); ctx.scale(-0.42, 0.42);
      shark(ctx, { fill: K.olive, rim: K.paper, teeth: false }); ctx.restore();
      label(ctx, 'YENİ RAKİP · BÜYÜK BEYAZ', 80, 1660, { color: K.lime, alpha: wp });
    }
    // megalodon, then dissolve into halftone dots (line 9)
    const dis = seg(t, L(9) + 0.3, Le(9) + 0.6, E.inOut);
    const mx = 470, my = 1080;
    if (dis < 1) glow(ctx, mx, my, 520, 330, 0.5 * (1 - dis));
    if (dis < 1) {
      const c = P.canvas(W, H), g = c.getContext('2d');
      g.translate(mx, my); g.scale(0.62, 0.62); shark(g, { tail: Math.sin(t), eye: K.lime, rim: K.olive });
      if (dis <= 0) ctx.drawImage(c, 0, 0);
      else {
        // erase with a growing halftone mask, so the body breaks into dots
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in';
        P.halftone(g, 0, 0, W, H, (x, y) => clamp(1 - dis * 1.4 + (P.vnoise(x / 90, y / 90) - 0.5) * 0.6 - (x - 100) / W * dis * 0.5, 0, 1), '#000', 18);
        ctx.drawImage(c, 0, 0);
      }
    }
    const yp = seg(t, L(9) + 0.6, L(9) + 1.4, E.out);
    if (yp > 0) { title(ctx, '3,6 MİLYON', W / 2, 1640, 150, { align: 'center', alpha: yp }); label(ctx, 'YIL ÖNCE · FOSİL KAYITLARINDAN SİLİNDİ', W / 2, 1710, { align: 'center', size: 26, track: 3, color: K.lime, alpha: yp }); }
  });

  // F — "but some never said goodbye": an eye in the dark, then the descent into the trench
  add(L(10) - 0.2, (ctx, t, lt) => {
    ctx.fillStyle = K.ink; ctx.fillRect(0, 0, W, H);
    if (t < L(11) - 0.1) {
      // single lime eye glint opens, a faint olive contour around it
      const e = seg(t, L(10) + 0.2, L(10) + 1.0, E.out);
      ctx.save(); ctx.globalAlpha = e * 0.6; ctx.strokeStyle = K.olive; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(540, 980, 520, 180, -0.05, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke(); ctx.restore();
      ctx.fillStyle = K.lime; ctx.beginPath(); ctx.ellipse(700, 900, 22, 22 * e, 0, 0, 7); ctx.fill();
      snow(ctx, t, 18, 0.18);
      return;
    }
    // trench descent (lines 11–14). depth meter 0 -> 10.900 m
    const dp = seg(t, L(11), L(14) + 1.0, E.inOut), depth = Math.round(10900 * dp);
    const wallScroll = dp * 5200;
    // trench walls: layered ink/olive strata scrolling up as we sink
    for (const side of [-1, 1]) {
      ctx.fillStyle = K.olive; ctx.beginPath();
      const pts = [];
      for (let y = -40; y <= H + 40; y += 30) { const wy = y + wallScroll; const nar = clamp(dp * 1.2, 0, 1); const x = W / 2 + side * (520 - nar * 220 - 70 * P.fbm(wy / 260, side * 3, 3) - 40 * Math.sin(wy / 400)); pts.push([x, y]); }
      ctx.moveTo(side < 0 ? 0 : W, -40); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(side < 0 ? 0 : W, H + 40); ctx.closePath(); ctx.fill();
      // strata lines
      ctx.strokeStyle = K.ink; ctx.lineWidth = 5;
      for (let k = 0; k < 14; k++) { const y = ((k * 170 - wallScroll) % (H + 200) + H + 200) % (H + 200) - 100; ctx.beginPath(); ctx.moveTo(side < 0 ? 0 : W, y); ctx.lineTo(side < 0 ? W / 2 - 260 : W / 2 + 260, y + 30 * side); ctx.stroke(); }
      // inner ink shading on the walls
      P.halftone(ctx, side < 0 ? 0 : W / 2 + 120, 0, W / 2 - 120, H, (x, y) => 0.5 * clamp(1 - Math.abs(x - W / 2) / 520, 0, 1), K.ink, 16);
    }
    snow(ctx, t, 22, 0.22);
    // depth readout
    title(ctx, depth.toLocaleString('tr-TR') + ' M', W / 2, 330, 150, { align: 'center' });
    label(ctx, 'MARİANA ÇUKURU', W / 2, 395, { align: 'center', color: K.lime });
    // conditions (lines 12–13)
    const conds = [['SONSUZ KARANLIK', L(12) + 2.6], ['1.000+ ATM', L(13)], ['1–4 °C', L(13) + 3.4]];
    conds.forEach(([s, a], i) => { const c = seg(t, a, a + 0.6, E.out); if (c > 0 && t < L(14)) label(ctx, s, W / 2, 1500 + i * 70, { align: 'center', size: 40, track: 8, alpha: c }); });
    // the shadow waiting at the bottom (line 14)
    const sh = seg(t, L(14) + 0.4, L(14) + 2.4, E.inOut);
    if (sh > 0) {
      ctx.save(); ctx.globalAlpha = sh; ctx.translate(560, 1560); ctx.scale(-0.55, 0.55);
      shark(ctx, { fill: '#050604', rim: K.olive, eye: K.lime, teeth: false, tail: Math.sin(t * 0.6) * 0.4 }); ctx.restore();
    }
  });

  // G — "Peki bu mümkün mü?" / "Hayır."
  add(L(15) - 0.2, (ctx, t, lt) => {
    const no = t >= L(16) + 1.9;
    ctx.fillStyle = no ? K.paper : K.ink; ctx.fillRect(0, 0, W, H);
    if (!no) {
      P.printText(ctx, 'MÜMKÜN', W / 2, 860, seg(t, L(15), L(15) + 0.4), { size: 230, align: 'center', color: K.paper });
      P.printText(ctx, 'MÜ?', W / 2, 1100, seg(t, L(15) + 0.3, L(15) + 0.7), { size: 230, align: 'center', color: K.lime });
    } else {
      P.printText(ctx, 'HAYIR.', W / 2, 1000, seg(t, L(16) + 1.9, L(16) + 2.2), { size: 300, align: 'center', color: K.ink });
      label(ctx, 'BENİM GÖRÜŞÜM', W / 2, 1100, { align: 'center', color: K.olive, alpha: seg(t, L(16) + 2.4, L(16) + 3.0) });
      const why = seg(t, L(16) + 3.4, L(16) + 4.2);
      ctx.fillStyle = K.lime; ctx.fillRect(W / 2 - 160, 1140, 320 * why, 12);
    }
  });

  // H — a warm engine: the body heat core needs hundreds of kilos of meat a day
  add(L(17) - 0.2, (ctx, t, lt) => {
    oceanBg(ctx, -2000, 0.6, { t });
    const sc = 0.82, cx = 560, cy = 980;
    glow(ctx, cx, cy, 600, 380, 0.5);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); shark(ctx, { tail: Math.sin(t * 1.4) * 0.6, eye: K.lime }); ctx.restore();
    // heat core: concentric halftone rings in lime inside the body (warm-bodied)
    const hp = seg(t, L(17) + 2.0, L(17) + 3.2, E.out);
    if (hp > 0) {
      const c = P.canvas(W, H), g = c.getContext('2d');
      g.translate(cx, cy); g.scale(sc, sc); g.fillStyle = '#000'; g.fill(P.poly(sharkPts(Math.sin(t * 1.4) * 0.6, 0))); g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-in';
      P.halftone(g, 0, 600, W, 800, (x, y) => hp * 0.55 * clamp(1 - Math.hypot((x - cx + 30) / 1.6, y - cy + 10) / 260, 0, 1) * (0.75 + 0.25 * Math.sin(t * 3 - Math.hypot(x - cx, y - cy) / 30)), K.lime, 13);
      ctx.drawImage(c, 0, 0);
      label(ctx, 'ÇEVRESİNDEN SICAK BİR VÜCUT', 80, 420, { alpha: hp, color: K.lime });
    }
    // fuel (line 18)
    const fp = seg(t, L(18) + 2.4, L(18) + 3.0, E.out);
    if (fp > 0) {
      title(ctx, 'YÜZLERCE KİLO', 80, 1540, 140, { alpha: fp });
      label(ctx, 'ET · HER GÜN', 84, 1600, { color: K.lime, alpha: fp });
    }
    title(ctx, 'SICAK SULARIN AVCISI', 80, 360, 84, { alpha: seg(t, L(17), L(17) + 0.6) });
  });

  // I — the trench floor is a desert; the deepest fish is tiny
  add(L(19) - 0.2, (ctx, t, lt) => {
    ctx.fillStyle = K.ink; ctx.fillRect(0, 0, W, H);
    // seabed ridge in olive with paper speck sediment
    ctx.fillStyle = K.olive; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 1560 + 40 * P.fbm(x / 300, 1.3, 3) + 30 * Math.sin(x / 200));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    P.halftone(ctx, 0, 1540, W, 380, (x, y) => 0.25 * P.vnoise(x / 60, y / 60), K.ink, 12);
    snow(ctx, t, 10, 0.18);
    // empty: dashed outline of a megalodon that is not there
    const op = seg(t, L(19) + 0.6, L(19) + 1.8);
    ctx.save(); ctx.globalAlpha = op * 0.8; ctx.translate(560, 1000); ctx.scale(0.75, 0.75);
    ctx.setLineDash([18, 16]); ctx.strokeStyle = K.olive; ctx.lineWidth = 5; ctx.stroke(P.poly(sharkPts(0, 0))); ctx.restore();
    label(ctx, 'YİYECEK NEREDEYSE YOK', W / 2, 420, { align: 'center', alpha: seg(t, L(19), L(19) + 0.6), size: 34 });
    // tiny snailfish (line 20) with its depth
    const sp = seg(t, L(20) + 5.0, L(20) + 6.0, E.out);
    if (sp > 0) {
      const fx = 300 + Math.sin(t * 0.7) * 8, fy = 1500;
      ctx.save(); ctx.translate(fx, fy); ctx.globalAlpha = sp; ctx.fillStyle = K.paper;
      ctx.beginPath(); ctx.ellipse(0, 0, 30, 14, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-70, -10 + Math.sin(t * 4) * 6, -96, 4); ctx.quadraticCurveTo(-70, 10, -26, 6); ctx.fill();
      ctx.fillStyle = K.ink; ctx.beginPath(); ctx.arc(16, -3, 3, 0, 7); ctx.fill(); ctx.restore();
      ctx.strokeStyle = K.lime; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx + 40, fy - 10); ctx.lineTo(fx + 160, fy - 140); ctx.lineTo(fx + 330, fy - 140); ctx.stroke();
      title(ctx, '8.000+ M', fx + 170, fy - 160, 90, { alpha: sp });
      label(ctx, 'EN DERİN BALIK · KÜÇÜCÜK', fx + 172, fy - 100, { size: 24, track: 3, color: K.lime, alpha: sp });
    }
  });

  // J — shed teeth rain down; every one ever found is a fossil
  add(L(21) - 0.2, (ctx, t, lt) => {
    ctx.fillStyle = K.ink; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = K.olive; ctx.fillRect(0, 1560, W, 360);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const born = L(21) + P.hash(i + 50) * 3.2, fall = seg(t, born, born + 2.6, E.in);
      if (fall <= 0) continue;
      const x = 80 + P.hash(i + 70) * 920, yEnd = 1560 + P.hash(i + 90) * 220, y = lerp(-100, yEnd, fall);
      const r = (P.hash(i + 30) - 0.5) * 1.2 + (1 - fall) * Math.sin(t * 3 + i) * 0.4;
      ctx.save(); ctx.translate(x, y); ctx.rotate(r); tooth(ctx, 0, 0, 70 + P.hash(i + 11) * 40, { blade: K.paper, root: K.olive, band: K.ink, shade: '#cfcbbd' }); ctx.restore();
    }
    title(ctx, 'BİNLERCE DİŞ', 80, 420, 130, { alpha: seg(t, L(21), L(21) + 0.6) });
    // line 22: the found teeth get stamped FOSİL
    const st = seg(t, L(22) + 8.4, L(22) + 8.8, E.out);
    if (st > 0) {
      ctx.save(); ctx.translate(W / 2, 1000); ctx.rotate(-0.12); ctx.scale(lerp(1.6, 1, st), lerp(1.6, 1, st)); ctx.globalAlpha = st;
      ctx.strokeStyle = K.lime; ctx.lineWidth = 14; ctx.strokeRect(-330, -110, 660, 220);
      title(ctx, 'HEPSİ FOSİL', 0, 52, 140, { align: 'center', color: K.lime });
      ctx.restore();
    }
    label(ctx, 'TAZE DİŞ: YOK', 84, 480, { color: K.lime, alpha: seg(t, L(22) + 5.0, L(22) + 5.6) });
  });

  // K — why we still believe: unmapped seafloor; the mind fills darkness with monsters
  add(L(23) - 0.2, (ctx, t, lt) => {
    ctx.fillStyle = K.ink; ctx.fillRect(0, 0, W, H);
    if (t < L(24) + 2.2) {
      P.printText(ctx, 'NEDEN', W / 2, 860, seg(t, L(23), L(23) + 0.4), { size: 200, align: 'center' });
      P.printText(ctx, 'İNANIYORUZ?', W / 2, 1060, seg(t, L(23) + 0.3, L(23) + 0.8), { size: 150, align: 'center', color: K.lime });
      if (t > L(24)) label(ctx, 'CEVAP OKYANUSTA DEĞİL, BİZDE.', W / 2, 1180, { align: 'center', alpha: seg(t, L(24), L(24) + 0.8) });
      return;
    }
    // sonar map grid: mapped cells in olive, unmapped cells dark; dark blobs form a shark shape
    const g = 60, mp = seg(t, L(25), L(25) + 2.5);
    for (let y = 300; y < 1700; y += g) for (let x = 60; x < 1020; x += g) {
      const mapped = P.hash2(x / g, y / g) < 0.28; const show = P.hash2(x / g + 9, y / g + 3) < mp;
      if (!show) continue;
      ctx.fillStyle = mapped ? K.olive : '#1d211b'; ctx.fillRect(x + 3, y + 3, g - 6, g - 6);
    }
    label(ctx, 'HARİTALANMAMIŞ DİP', 60, 270, { color: K.lime, alpha: mp });
    // pareidolia: unmapped cells darken into a silhouette (line 25 second half)
    const pr = seg(t, L(25) + 5.5, Le(25) + 0.5, E.inOut);
    if (pr > 0) {
      ctx.save(); ctx.globalAlpha = pr; ctx.translate(540, 1000); ctx.scale(0.8, 0.8);
      ctx.fillStyle = '#050604'; ctx.fill(P.poly(sharkPts(Math.sin(t) * 0.4, 0.3)));
      ctx.fillStyle = K.lime; ctx.beginPath(); ctx.arc(375, -42, 10, 0, 7); ctx.fill(); ctx.restore();
    }
  });

  // L — it swims on in imagination; the secret is written in stone. End card.
  add(L(26) - 0.2, (ctx, t, lt) => {
    if (t < L(27) - 0.1) {
      oceanBg(ctx, -2000, 0.75, { t });
      const sp = seg(t, L(26), Le(26) + 1.0, E.inOut);
      glow(ctx, lerp(-400, 1500, sp), 980, 700, 420, 0.5);
      ctx.save(); ctx.translate(lerp(-400, 1500, sp), 980 + Math.sin(t) * 20); ctx.scale(1.1, 1.1);
      shark(ctx, { tail: Math.sin(t * 1.5), eye: K.lime, jaw: 0.7 }); ctx.restore();
      label(ctx, 'HAYAL GÜCÜMÜZDE', W / 2, 1560, { align: 'center', size: 36, alpha: seg(t, L(26) + 2.0, L(26) + 2.6) });
      return;
    }
    // stone: paper with olive strata, a fossil tooth embedded
    ctx.fillStyle = K.paper; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = k % 2 ? K.olive : '#8c9384'; const y = 900 + k * 120;
      ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 30) ctx.lineTo(x, y + 26 * P.fbm(x / 260, k * 1.7, 3)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    P.halftone(ctx, 0, 900, W, 1020, (x, y) => 0.18 * P.vnoise(x / 40, y / 40), K.ink, 10);
    const tp = seg(t, L(27), L(27) + 1.6, E.out);
    tooth(ctx, W / 2, lerp(1500, 1320, tp), 420, { blade: K.ink, root: '#3a4034', band: K.olive, shade: '#2b3128' });
    const tt = seg(t, L(28) + 3.3, L(28) + 3.9, E.out);
    const fit = Math.min(230, 230 * 940 / P.measure(ctx, 'MEGALODON', 230, P.FONT.title, 400, 4));
    P.printText(ctx, 'MEGALODON', W / 2, 560, seg(t, L(27) + 0.4, L(27) + 1.0, E.out), { size: fit, align: 'center', color: K.ink, track: 4 });
    P.printText(ctx, 'BİR ZAMANLAR GERÇEKTİ.', W / 2, 680, tt, { size: 64, fam: P.FONT.label, w: 700, align: 'center', color: K.olive, track: 4 });
    ctx.fillStyle = K.lime; ctx.fillRect(W / 2 - 120, 720, 240 * seg(t, L(28) + 4.0, L(28) + 4.6), 12);
  });

  function drawFrame(ctx, t) {
    t = clamp(t, 0, DURATION - 1e-6);
    let s = S[0]; for (const x of S) if (t >= x.start) s = x;
    ctx.save(); s.fn(ctx, t, t - s.start); ctx.restore();
    P.finish(ctx);
    // fade in from black ink at start, fade out at the end
    if (t < 1.0) { ctx.fillStyle = 'rgba(17,20,16,' + (1 - t) + ')'; ctx.fillRect(0, 0, W, H); }
    if (t > DURATION - 1.0) { ctx.fillStyle = 'rgba(17,20,16,' + seg(t, DURATION - 1.0, DURATION) + ')'; ctx.fillRect(0, 0, W, H); }
  }
  G.Scenes = { W, H, DURATION, drawFrame, T, shark, jaws, tooth, glow };
})(window);
