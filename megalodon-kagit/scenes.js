// Scenes + global timeline. drawFrame(ctx, t) renders the exact frame at time t (seconds) at 1080x1920.
(function (G) {
  'use strict';
  const P = G.Paper, A = G.Art, C = P.C, E = P.E, seg = P.seg, lerp = P.lerp;
  const W = 1080, H = 1920, DURATION = 90;

  const SCENES = [
    { id: 1, start: 0, end: 17, kicker: 'FOSİL KAYIT', draw: scene1 },
    { id: 2, start: 17, end: 35, kicker: 'BOYUT', draw: scene2 },
    { id: 3, start: 35, end: 53, kicker: 'YAŞAM VE SON', draw: scene3 },
    { id: 4, start: 53, end: 74, kicker: 'SÖYLENTİ', draw: scene4 },
    { id: 5, start: 74, end: 90, kicker: 'KANIT', draw: scene5 }
  ];

  // ---------------- shared chrome ----------------
  function header(ctx, lt, n, kicker, lines, o) {
    o = o || {};
    const k = P.liftIn(lt, 0.1, 0.5, [-80, 0]);
    ctx.save(); ctx.globalAlpha = k.alpha; ctx.translate(k.x, 0);
    A.tab(ctx, 'kick' + n, 72, 120, n + ' / 5  ·  ' + kicker, o.tabCol || C.mustard, 28);
    ctx.restore();
    lines.forEach((ln, i) => {
      const p = seg(lt, 0.35 + i * 0.18, 1.1 + i * 0.18, E.out);
      P.revealText(ctx, ln.t, 72, 300 + i * 112, p, { size: ln.size || 104, fam: P.F.head, w: 900, color: ln.color || o.color || C.charcoal });
    });
  }
  function progress(ctx, t, dark) {
    const y = 1838, w = 160, gap = 24, x0 = (W - (w * 5 + gap * 4)) / 2;
    SCENES.forEach((s, i) => {
      const x = x0 + i * (w + gap);
      A.card(ctx, 'prog' + i, x, y, w, 16, dark ? P.shade(C.charcoal, 0.15) : C.creamDark, { r: 8, depth: 1, edge: 0.6 });
      const f = P.clamp((t - s.start) / (s.end - s.start), 0, 1);
      if (f > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x, y - 4, w * f, 26); ctx.clip(); A.card(ctx, 'progf' + i, x, y, w, 16, C.terracotta, { r: 8, depth: 2, edge: 0.6 }); ctx.restore(); }
    });
  }

  // ---------------- SCENE 1: the tooth ----------------
  function scene1(ctx, lt) {
    P.backdrop(ctx, W, H, C.cream);
    // background paper blocks (layered cardstock)
    A.card(ctx, 's1bgA', -40, 520, 700, 980, P.shade(C.blue, 0.55), { depth: 3, r: 0 });
    A.card(ctx, 's1bgB', 600, 640, 520, 860, P.shade(C.sage, 0.55), { depth: 3, r: 0 });
    header(ctx, lt, 1, 'FOSİL KAYIT', [{ t: '18 santimlik' }, { t: 'bir ipucu', color: C.terracotta }]);
    // note tag
    const nt = P.liftIn(lt, 6.0, 0.6, [0, -40]);
    if (nt.alpha > 0) { ctx.save(); ctx.globalAlpha = nt.alpha; ctx.translate(nt.x, nt.y);
      A.card(ctx, 's1note', 72, 470, 936, 92, C.card, { depth: nt.depth, r: 10 });
      P.text(ctx, 'İskeleti kıkırdaktı → fosillerin çoğu diş ve omur', 104, 530, { size: 36, w: 500, color: C.charcoal });
      ctx.restore(); }
    // big tooth assembles: root, then blade drops in with stepped stop-motion settle
    const tp = seg(lt, 0.6, 2.0, E.outBack), wob = Math.sin(P.step12(lt) * 9) * 0.012 * (1 - seg(lt, 1.5, 3));
    ctx.save(); ctx.translate(360, lerp(1500, 1110, tp)); ctx.rotate(lerp(0.35, -0.04, tp) + wob);
    A.tooth(ctx, 480, { key: 'meg' }); ctx.restore();
    // ruler unfolds upward
    const rp = seg(lt, 2.2, 3.6, E.out), top = 1350 - 750 * rp;
    if (rp > 0) {
      A.card(ctx, 's1ruler' + Math.round(rp * 30), 650, top, 92, 1350 - top, C.mustard, { depth: 5, r: 4 });
      ctx.save(); ctx.beginPath(); ctx.rect(650, top, 92, 1350 - top); ctx.clip();
      for (let cm = 0; cm <= 18; cm++) { const y = 1350 - cm * 40; ctx.fillStyle = C.charcoal; ctx.fillRect(650, y - 2, cm % 3 ? 22 : 40, 4);
        if (cm % 3 === 0 && cm) P.text(ctx, String(cm), 700, y + 12, { size: 30, w: 700 }); }
      ctx.restore();
    }
    // measuring label "≈18 cm" flags out from ruler top
    const lp = seg(lt, 3.6, 4.3, E.outBack);
    if (lp > 0) { ctx.save(); ctx.translate(770, 660); ctx.scale(lp, lp);
      A.card(ctx, 's1lab', 0, -44, 230, 88, C.terracotta, { depth: 6, r: 8 });
      P.text(ctx, '~18 cm', 115, 18, { size: 52, fam: P.F.head, w: 900, align: 'center', color: C.card }); ctx.restore(); }
    // great white tooth slides in for comparison
    const gp = seg(lt, 4.6, 5.6, E.outBack);
    if (gp > 0) { ctx.save(); ctx.translate(lerp(1250, 900, gp), 1270); ctx.rotate(0.05);
      A.tooth(ctx, 160, { key: 'gw', blade: '#E9E2D2', root: '#C9B79A' }); ctx.restore();
      P.text(ctx, '~6 cm', 900, 1050, { size: 40, w: 700, align: 'center', alpha: seg(lt, 5.2, 5.8) }); }
    // label cards
    const c1 = P.liftIn(lt, 6.6, 0.6), c2 = P.liftIn(lt, 6.9, 0.6);
    [[c1, 72, 'MEGALODON', 'diş: ~18 cm', C.charcoal, C.card], [c2, 560, 'BÜYÜK BEYAZ', 'diş: ~6 cm', C.card, C.charcoal]].forEach(([c, x, a, b, bg, fg], i) => {
      if (c.alpha <= 0) return; ctx.save(); ctx.globalAlpha = c.alpha; ctx.translate(c.x, c.y);
      A.card(ctx, 's1c' + i, x, 1400, 448, 150, bg, { depth: c.depth, r: 12 });
      P.text(ctx, a, x + 32, 1458, { size: 32, w: 700, color: fg, track: 3 });
      P.text(ctx, b, x + 32, 1520, { size: 46, fam: P.F.head, w: 600, color: fg });
      ctx.restore(); });
    // timeline strip
    const sp = seg(lt, 8.5, 10.5, E.inOut);
    if (sp > 0) {
      A.card(ctx, 's1tlbg', 72, 1610, 936, 170, C.card, { depth: 4, r: 12, alpha: P.clamp(sp * 3, 0, 1) });
      P.text(ctx, 'NE ZAMAN YAŞADI?', 104, 1660, { size: 28, w: 700, track: 3, alpha: P.clamp(sp * 3, 0, 1) });
      const bx = 104, bw = 872 * sp;
      A.card(ctx, 's1bar' + Math.round(sp * 40), bx, 1688, bw, 30, C.sage, { depth: 3, r: 6 });
      P.text(ctx, '23 milyon yıl önce', 104, 1756, { size: 32, w: 500, alpha: seg(lt, 9, 9.6) });
      P.text(ctx, '3,6 milyon yıl önce', 976, 1756, { size: 32, w: 700, align: 'right', color: C.terraDark, alpha: seg(lt, 10.4, 11) });
    }
    // closing beat of scene: the tooth tilts toward the next scene
    progress(ctx, SCENES[0].start + lt);
  }

  // ---------------- SCENE 2: size ----------------
  function scene2(ctx, lt) {
    P.backdrop(ctx, W, H, C.cream);
    header(ctx, lt, 2, 'BOYUT', [{ t: 'Ne kadar' }, { t: 'büyüktü?', color: C.terracotta }]);
    // sea band (three layered wave sheets)
    const sea = seg(lt, 0.3, 1.4, E.out);
    ['s2w1', 's2w2', 's2w3'].forEach((k, i) => {
      const y = lerp(1400, 520 + i * 40, sea), ph = P.step12(lt) * 0.6 + i;
      ctx.save(); ctx.translate(Math.sin(P.step12(lt) * 0.9 + i) * 6, y);
      P.paper(ctx, P.cutPath(k, P.wavePts(-40, 1120, 0, 16 - i * 3, 260 + i * 60, 900, i * 1.3), { j: 1.2 }), [P.shade(C.blue, 0.45), P.shade(C.blue, 0.25), C.blue][i], { depth: 5, tex: 0.22, alpha: 1 });
      ctx.restore();
    });
    // (wave sheets positioned via translate)
    // ruler 0-20 m
    const mpx = 46, rx0 = 74, ry = 1330, rp = seg(lt, 1.2, 2.4, E.out);
    if (rp > 0) {
      A.card(ctx, 's2rul' + Math.round(rp * 40), rx0 - 10, ry, (20 * mpx + 20) * rp, 64, C.card, { depth: 4, r: 6 });
      ctx.save(); ctx.beginPath(); ctx.rect(rx0 - 10, ry, (20 * mpx + 20) * rp, 64); ctx.clip();
      for (let m = 0; m <= 20; m++) { const x = rx0 + m * mpx; ctx.fillStyle = C.charcoal; ctx.fillRect(x - 1.5, ry, 3, m % 5 ? 14 : 26); if (m % 5 === 0) P.text(ctx, m + ' m', x, ry + 56, { size: 24, w: 700, align: m === 20 ? 'right' : (m ? 'center' : 'left') }); }
      ctx.restore();
    }
    // megalodon swims in from right and settles, length ~18 m
    const sharkLen = 1150, megS = (18 * mpx) / sharkLen, mp = seg(lt, 1.8, 4.0, E.out);
    const swim = Math.sin(lt * 2.2) * 0.5;
    ctx.save(); ctx.translate(lerp(1500, rx0 + 650 * megS, mp), 840 + Math.sin(lt * 1.1) * 8); ctx.scale(megS, megS);
    A.shark(ctx, { variant: 'meg', tail: swim, jaw: 0.25 + 0.25 * Math.max(0, Math.sin(lt * 0.8)) }); ctx.restore();
    // bracket 15-20 m
    const bp = seg(lt, 4.2, 5.2, E.out);
    if (bp > 0) { const x1 = rx0 + 15 * mpx, x2 = rx0 + 20 * mpx * 0.999;
      ctx.save(); ctx.globalAlpha = bp; A.card(ctx, 's2br', x1, 1290, (x2 - x1), 22, C.terracotta, { depth: 3, r: 4 });
      P.text(ctx, 'tahmin: 15–20 m', x2, 1272, { size: 34, w: 700, align: 'right', color: C.terraDark }); ctx.restore(); }
    // great white + human for scale
    const wp = seg(lt, 5.4, 6.6, E.out), whS = (6 * mpx) / sharkLen;
    if (wp > 0) { ctx.save(); ctx.translate(lerp(-300, rx0 + 650 * whS, wp), 1170); ctx.scale(whS, whS); A.shark(ctx, { variant: 'white', tail: Math.sin(lt * 4) * 0.6, depth: 4 }); ctx.restore();
      P.text(ctx, 'büyük beyaz ~6 m', rx0, 1110, { size: 30, w: 700, alpha: wp }); }
    const hp = seg(lt, 6.4, 7.2, E.outBack);
    if (hp > 0) { ctx.save(); ctx.translate(560, 1236); ctx.scale(hp * (1.8 * mpx) / 180, hp * (1.8 * mpx) / 180); A.person(ctx); ctx.restore();
      P.text(ctx, 'insan 1,8 m', 600, 1232, { size: 30, w: 700, alpha: hp }); }
    // bite force panel
    const fp = P.liftIn(lt, 8.0, 0.7);
    if (fp.alpha > 0) {
      ctx.save(); ctx.globalAlpha = fp.alpha; ctx.translate(fp.x, fp.y);
      A.card(ctx, 's2bite', 72, 1450, 936, 330, C.card, { depth: fp.depth, r: 14 });
      P.text(ctx, 'ISIRMA KUVVETİ (TAHMİN)', 104, 1508, { size: 30, w: 700, track: 3 });
      const maxN = 182000, bw = 860, g = seg(lt, 8.8, 11.0, E.out);
      // megalodon range bar: solid to 108k, lighter extension to 182k
      A.card(ctx, 's2b1', 104, 1540, bw * (108000 / maxN) * g, 56, C.terracotta, { depth: 3, r: 6 });
      A.card(ctx, 's2b1x' + Math.round(g * 20), 104 + bw * (108000 / maxN) * g, 1540, bw * (74000 / maxN) * seg(lt, 10, 11.5, E.out), 56, P.shade(C.terracotta, 0.45), { depth: 2, r: 6 });
      P.text(ctx, 'Megalodon  108.000–182.000 N', 104, 1640, { size: 34, w: 700, alpha: seg(lt, 10.5, 11.2) });
      A.card(ctx, 's2b2', 104, 1664, bw * (18000 / maxN) * seg(lt, 11.5, 12.4, E.out), 40, C.blue, { depth: 3, r: 6 });
      P.text(ctx, 'Büyük beyaz  ~18.000 N', 220, 1696, { size: 32, w: 500, alpha: seg(lt, 12, 12.6) });
      P.text(ctx, 'Wroe ve ark., 2008', 976, 1755, { size: 24, w: 500, align: 'right', color: C.charcoalSoft, alpha: seg(lt, 12.5, 13) });
      ctx.restore();
    }
    progress(ctx, SCENES[1].start + lt);
  }

  // ---------------- SCENE 3: life & extinction ----------------
  function scene3(ctx, lt) {
    P.backdrop(ctx, W, H, C.cream);
    header(ctx, lt, 3, 'YAŞAM VE SON', [{ t: 'Sıcak sularda' }, { t: 'bir avcı', color: C.terracotta }]);
    // cross-section window
    const wx = 72, wy = 480, ww = 936, wh = 640, op = seg(lt, 0.3, 1.2, E.out);
    ctx.save(); ctx.beginPath(); ctx.rect(wx, wy + wh * (1 - op), ww, wh * op); ctx.clip();
    A.card(ctx, 's3sky', wx, wy, ww, wh, P.shade(C.mustard, 0.62), { depth: 0, r: 0 });
    // sun
    P.paper(ctx, P.cutPath('s3sun', P.ellipsePts(880, 580, 60, 60, 30)), C.mustard, { depth: 4, tex: 0.2 });
    // water layers
    P.paper(ctx, P.cutPath('s3sea1', P.wavePts(wx - 20, wx + ww + 20, wy + 170, 10, 220, wy + wh + 20, 0.5)), P.shade(C.blue, 0.3), { depth: 4 });
    P.paper(ctx, P.cutPath('s3sea2', P.wavePts(wx - 20, wx + ww + 20, wy + 200, 8, 300, wy + wh + 20, 2)), C.blue, { depth: 4 });
    // continental shelf seabed: shallow left, drop-off right
    P.paper(ctx, P.cutPath('s3shelf', [[wx - 10, wy + 520], [wx + 520, wy + 560], [wx + 640, wy + 600], [wx + 760, wy + 700], [wx - 10, wy + 700]]), C.sage, { depth: 6, tex: 0.26 });
    P.paper(ctx, P.cutPath('s3shelf2', [[wx - 10, wy + 590], [wx + 400, wy + 610], [wx + 560, wy + 650], [wx - 10, wy + 700]]), C.sageDark, { depth: 4, tex: 0.26 });
    // warm-water label
    // prey + predator chase (megalodon follows whale)
    const ch = seg(lt, 1.0, 6.0, E.inOut);
    ctx.save(); ctx.translate(lerp(820, 420, ch), 800 + Math.sin(lt * 1.6) * 6); ctx.scale(0.6, 0.6); A.whale(ctx); ctx.restore();
    ctx.save(); ctx.translate(lerp(1300, 840, ch), 930 + Math.sin(lt * 1.3 + 1) * 8); ctx.scale(-0.4, 0.4); A.shark(ctx, { variant: 'meg', tail: Math.sin(lt * 3), jaw: 0.6 * seg(lt, 4.5, 5.5) }); ctx.restore();
    ctx.restore();
    // window frame (paper mat)
    if (op > 0) {
      const t1 = P.liftIn(lt, 2.0, 0.6), t2 = P.liftIn(lt, 2.6, 0.6);
      if (t1.alpha > 0) { ctx.save(); ctx.globalAlpha = t1.alpha; A.tab(ctx, 's3t1', 104, 712 + t1.y * 0.3, 'Sıcak, sığ kıyı suları', C.card, 30); ctx.restore(); }
      if (t2.alpha > 0) { ctx.save(); ctx.globalAlpha = t2.alpha; A.tab(ctx, 's3t2', 580, 1040 + t2.y * 0.3, 'Av: balinalar', C.card, 30); ctx.restore(); }
    }
    // "why extinct" cause cards
    const hp = seg(lt, 7.0, 7.8, E.out);
    P.revealText(ctx, 'Neden yok oldu?', 72, 1210, hp, { size: 60, fam: P.F.head, w: 900 });
    const causes = [
      ['Okyanuslar soğudu', 'sıcak kıyı suları ve yavru alanları daraldı', 'thermo'],
      ['Av değişti', 'büyük deniz memelileri azaldı, yer değiştirdi', 'whale'],
      ['Yeni rakip', 'büyük beyaz köpekbalığı aynı avlara yöneldi', 'white']
    ];
    causes.forEach((c, i) => {
      const k = P.liftIn(lt, 8.0 + i * 1.3, 0.7, [120, 0]);
      if (k.alpha <= 0) return;
      const y = 1250 + i * 165;
      ctx.save(); ctx.globalAlpha = k.alpha; ctx.translate(k.x, 0);
      A.card(ctx, 's3c' + i, 72, y, 936, 145, i % 2 ? P.shade(C.blue, 0.55) : C.card, { depth: k.depth, r: 12 });
      // icon tile
      A.card(ctx, 's3ci' + i, 92, y + 18, 110, 110, [C.terracotta, C.sage, C.blue][i], { depth: 3, r: 10 });
      ctx.save(); ctx.translate(147, y + 73);
      if (c[2] === 'thermo') { A.thermo(ctx, 's3th', 0, -46, 64, lerp(0.9, 0.25, seg(lt, 8.6, 10.5))); }
      else if (c[2] === 'whale') { ctx.scale(0.13, 0.13); A.whale(ctx, { color: C.card }); }
      else { ctx.scale(0.075, 0.075); A.shark(ctx, { variant: 'white', body: C.card, top: P.shade(C.blue, 0.3), depth: 2 }); }
      ctx.restore();
      P.text(ctx, c[0], 230, y + 62, { size: 40, fam: P.F.head, w: 900 });
      P.text(ctx, c[1], 230, y + 112, { size: 29, w: 500, color: C.charcoalSoft });
      ctx.restore();
    });
    // extinction stamp
    const sp = seg(lt, 12.5, 13.0, E.outBack);
    if (sp > 0) { ctx.save(); ctx.translate(870, 1175); ctx.scale(lerp(1.6, 1, sp), lerp(1.6, 1, sp)); A.stamp(ctx, 's3st', 0, 0, 120, '3,6 MY', 'ÖNCE', C.terracotta, P.clamp(sp * 2, 0, 1)); ctx.restore(); }
    progress(ctx, SCENES[2].start + lt);
  }

  // ---------------- SCENE 4: Mariana depth column ----------------
  function scene4(ctx, lt) {
    P.backdrop(ctx, W, H, C.cream);
    header(ctx, lt, 4, 'SÖYLENTİ', [{ t: 'Mariana', size: 96 }, { t: 'söylentisi', size: 96, color: C.terracotta }]);
    const cl = P.liftIn(lt, 1.2, 0.6);
    if (cl.alpha > 0) { ctx.save(); ctx.globalAlpha = cl.alpha; ctx.translate(cl.x, cl.y);
      A.card(ctx, 's4claim', 560, 120, 450, 230, C.charcoal, { depth: cl.depth, r: 12 });
      P.text(ctx, 'İDDİA', 590, 172, { size: 26, w: 700, color: C.mustard, track: 4 });
      P.text(ctx, 'Megalodon en derin çukurda hâlâ yaşıyor.', 590, 222, { size: 32, w: 500, color: C.card, maxW: 390, lh: 40 });
      ctx.restore(); }
    // depth column 0..11000 m
    const top = 470, bot = 1790, px = (bot - top) / 11000, colX = 300, colW = 420;
    const dy = d => top + d * px;
    const grow = seg(lt, 1.8, 4.5, E.inOut), reveal = top + (bot - top) * grow;
    ctx.save(); ctx.beginPath(); ctx.rect(0, top - 20, W, reveal - top + 20); ctx.clip();
    const bands = [[0, 200, P.shade(C.blue, 0.35)], [200, 1000, C.blue], [1000, 4000, C.blueDeep], [4000, 6000, C.blueDark], [6000, 11000, C.abyss]];
    bands.forEach(([a, b, col], i) => P.paper(ctx, P.cutPath('s4band' + i, P.wavePts(colX - 20, colX + colW + 20, dy(a), i ? 6 : 10, 120 + i * 30, dy(b) + 30, i), { j: 1 }), col, { depth: 4, tex: 0.24 }));
    // trench walls (V shape narrowing), terracotta-charcoal layered rock
    P.paper(ctx, P.cutPath('s4wallL', [[colX - 30, dy(5800)], [colX + 60, dy(6400)], [colX + 120, dy(8200)], [colX + 170, dy(10200)], [colX + 200, dy(11000) + 20], [colX - 30, dy(11000) + 20]], { j: 3, seg: 18 }), P.shade(C.terracotta, -0.45), { depth: 6, tex: 0.3 });
    P.paper(ctx, P.cutPath('s4wallR', [[colX + colW + 30, dy(5600)], [colX + colW - 50, dy(6600)], [colX + colW - 110, dy(8600)], [colX + colW - 170, dy(10400)], [colX + 230, dy(11000) + 20], [colX + colW + 30, dy(11000) + 20]], { j: 3, seg: 18 }), P.shade(C.terracotta, -0.55), { depth: 6, tex: 0.3 });
    ctx.restore();
    // ruler on the left
    for (let d = 2000; d <= 10000; d += 2000) { if (dy(d) > reveal) break; ctx.fillStyle = C.card; ctx.fillRect(colX, dy(d) - 2, 26, 4); P.text(ctx, (d / 1000) + '.000 m', colX + 34, dy(d) + 9, { size: 24, w: 700, color: C.card }); }
    // markers: [depth, label, sub, colour, appear time]
    const marks = [
      [200, '200 m', 'güneş ışığı biter', C.mustard, 4.6],
      [3700, '~3.700 m', 'bilinen en derin köpekbalığı', C.sage, 6.4],
      [8300, '~8.300 m', 'kaydedilen en derin balık', C.blue, 8.2],
      [10900, '~10.900 m', 'Challenger Derinliği', C.terracotta, 10.0]
    ];
    marks.forEach(([d, a, b, col, at], i) => {
      const p = seg(lt, at, at + 0.7, E.out); if (p <= 0) return;
      const y = dy(d);
      ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = d > 3000 ? C.card : C.charcoal; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(colX, y); ctx.lineTo(colX + colW * p + 20, y); ctx.stroke(); ctx.restore();
      const cx = 740, cw = 300, ch = 108, cy = P.clamp(y - ch / 2, top, bot - ch);
      ctx.save(); ctx.globalAlpha = p; ctx.translate((1 - p) * 60, 0);
      A.card(ctx, 's4m' + i, cx, cy, cw, ch, C.card, { depth: 6, r: 10 });
      A.card(ctx, 's4mc' + i, cx, cy, 16, ch, col, { depth: 0, r: 4, edge: 0 });
      P.text(ctx, a, cx + 34, cy + 46, { size: 34, fam: P.F.head, w: 900 });
      P.text(ctx, b, cx + 34, cy + 86, { size: 24, w: 500, color: C.charcoalSoft, maxW: cw - 44, lh: 26 });
      ctx.restore();
    });
    // megalodon icon in shallow layer, tries to descend, path stops with X
    const mp = seg(lt, 4.8, 6.0, E.out);
    if (mp > 0) {
      const sy = dy(120);
      ctx.save(); ctx.translate(colX + 210, sy + Math.sin(lt * 2) * 4); ctx.scale(0.13 * mp, 0.13 * mp); A.shark(ctx, { variant: 'meg', tail: Math.sin(lt * 4), depth: 3 }); ctx.restore();
      const dp = seg(lt, 11.0, 13.0, E.inOut);
      if (dp > 0) {
        ctx.save(); ctx.setLineDash([4, 14]); ctx.lineCap = 'round'; ctx.strokeStyle = C.mustard; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(colX + 210, sy + 40); ctx.lineTo(colX + 210, lerp(sy + 40, dy(10700), dp)); ctx.stroke(); ctx.restore();
        if (dp >= 1) A.mark(ctx, 's4x', colX + 210, dy(10750), 70, 'x', C.terracotta);
      }
    }
    // condition cards at the bottom-left over the abyss
    const conds = [['BASINÇ', '>1.000 atm'], ['SICAKLIK', '1–4 °C'], ['IŞIK', 'yok']];
    conds.forEach(([a, b], i) => {
      const k = P.liftIn(lt, 13.5 + i * 0.6, 0.6, [-80, 0]); if (k.alpha <= 0) return;
      const y = 1250 + i * 150;
      ctx.save(); ctx.globalAlpha = k.alpha; ctx.translate(k.x, 0);
      A.card(ctx, 's4k' + i, 30, y, 250, 128, C.mustard, { depth: k.depth, r: 10 });
      P.text(ctx, a, 62, y + 44, { size: 24, w: 700, track: 3 });
      P.text(ctx, b, 54, y + 100, { size: 34, fam: P.F.head, w: 900 });
      ctx.restore();
    });
    progress(ctx, SCENES[3].start + lt);
  }

  // ---------------- SCENE 5: evidence ----------------
  function scene5(ctx, lt) {
    P.backdrop(ctx, W, H, C.cream);
    header(ctx, lt, 5, 'KANIT', [{ t: 'Kanıt ne' }, { t: 'diyor?', color: C.terracotta }]);
    // evidence board
    A.card(ctx, 's5board', 50, 470, 980, 640, P.shade(C.sage, 0.25), { depth: 8, r: 6 });
    // red string linking the cards
    const sp = seg(lt, 3.0, 4.0, E.inOut);
    if (sp > 0) { ctx.save(); ctx.strokeStyle = C.terracotta; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(300, 535); ctx.quadraticCurveTo(540, 640, lerp(300, 770, sp), lerp(535, 555, sp)); ctx.stroke(); if (sp > 0.6) { ctx.beginPath(); ctx.moveTo(770, 555); ctx.quadraticCurveTo(560, 760, lerp(770, 320, (sp - 0.6) / 0.4), lerp(555, 845, (sp - 0.6) / 0.4)); ctx.stroke(); } ctx.restore(); }
    const src = [
      ['1875', 'HMS Challenger', 'Pasifik tabanından fosil dişler çıkarıldı; yaşları tartışmalı', 90, 520, -0.04],
      ['2013', 'Sahte belgesel', 'kurgu, gerçek belgesel gibi sunuldu', 560, 540, 0.035],
      ['2018', 'Sinema filmi', 'bilimkurgu; söylentiyi yaydı', 110, 830, -0.02]
    ];
    src.forEach(([y, a, b, x, yy, r], i) => {
      const k = P.liftIn(lt, 0.8 + i * 0.7, 0.7, [0, -120]); if (k.alpha <= 0) return;
      ctx.save(); ctx.globalAlpha = k.alpha; ctx.translate(x + 210 + k.x, yy + 115 + k.y); ctx.rotate(r + k.rot);
      A.card(ctx, 's5s' + i, -210, -115, 420, 230, C.card, { depth: k.depth + 4, r: 6 });
      P.text(ctx, y, -180, -48, { size: 44, fam: P.F.head, w: 900, color: C.terracotta });
      P.text(ctx, a, -180, 0, { size: 32, w: 700 });
      P.text(ctx, b, -180, 42, { size: 24, w: 500, color: C.charcoalSoft, maxW: 360, lh: 28 });
      A.pin(ctx, 0, -100, [C.terracotta, C.mustard, C.blue][i]);
      ctx.restore();
    });
    // checklist
    const ck = P.liftIn(lt, 4.6, 0.7);
    if (ck.alpha > 0) {
      ctx.save(); ctx.globalAlpha = ck.alpha; ctx.translate(ck.x, ck.y);
      A.card(ctx, 's5list', 72, 1150, 936, 470, C.card, { depth: ck.depth, r: 14 });
      P.text(ctx, 'HÂLÂ YAŞASAYDI…', 104, 1210, { size: 30, w: 700, track: 3 });
      const items = ['taze, fosilleşmemiş dişler bulunurdu', 'balinalarda yeni dev ısırık izleri olurdu', 'soğuk, karanlık dipte yeterli av olurdu'];
      items.forEach((s, i) => {
        const a = 5.6 + i * 1.4, y = 1290 + i * 110;
        P.revealText(ctx, s, 180, y, seg(lt, a, a + 0.8, E.out), { size: 32, w: 500 });
        if (lt > a + 0.9) A.mark(ctx, 's5x' + i, 130, y - 12, 44, 'x', C.terracotta);
      });
      P.text(ctx, 'Hiçbiri gözlenmedi.', 104, 1590, { size: 34, w: 700, color: C.terraDark, alpha: seg(lt, 10.2, 10.8) });
      ctx.restore();
    }
    // verdict stamp lands on the board
    const st = seg(lt, 11.0, 11.4, E.outBack);
    if (st > 0) { ctx.save(); ctx.translate(800, 975); ctx.scale(lerp(1.8, 1, st), lerp(1.8, 1, st)); A.stamp(ctx, 's5st', 0, 0, 180, 'SÖYLENTİ', 'KANIT YOK', C.terracotta, P.clamp(st * 2, 0, 1)); ctx.restore(); }
    // closing line
    const cp = seg(lt, 12.4, 13.4, E.out);
    if (cp > 0) {
      A.card(ctx, 's5end', 72, 1650, 936, 160, C.charcoal, { depth: 6, r: 14, alpha: cp });
      P.revealText(ctx, 'Megalodon gerçekti —', 104, 1716, cp, { size: 44, fam: P.F.head, w: 900, color: C.card });
      P.revealText(ctx, 'ama 3,6 milyon yıl önce yok oldu.', 104, 1774, seg(lt, 12.9, 14, E.out), { size: 40, w: 500, color: C.mustard });
    }
    progress(ctx, SCENES[4].start + lt);
  }

  function drawFrame(ctx, t) {
    t = P.clamp(t, 0, DURATION - 1e-6);
    const s = SCENES.find(s => t >= s.start && t < s.end) || SCENES[SCENES.length - 1];
    ctx.save(); s.draw(ctx, t - s.start); ctx.restore();
  }

  G.Scenes = { W, H, DURATION, SCENES, drawFrame };
})(window);
