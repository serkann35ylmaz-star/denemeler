// Layered paper illustrations built from many cut pieces.
(function (G) {
  'use strict';
  const P = G.Paper, C = P.C;

  // closed Catmull-Rom through control points -> dense point list
  function catmull(ctrl, per) {
    const out = [], n = ctrl.length; per = per || 8;
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                  0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    return out;
  }
  const path = (key, ctrl, per, j) => P.cutPath(key, catmull(ctrl, per), { j: j == null ? 1.2 : j, seg: 10 });

  // ---------- SHARK (side view, facing right). Local length: tail tip x=-650 .. nose x=500 ----------
  // opt: body, top, belly colours; jaw (0..1 open); tail (swing -1..1); variant 'meg'|'white'
  function shark(ctx, o) {
    o = o || {};
    const v = o.variant || 'meg', key = 'shark-' + v;
    const body = o.body || (v === 'meg' ? C.blueDeep : C.blue), top = o.top || (v === 'meg' ? C.blueDark : P.shade(C.blue, -0.18)),
      belly = o.belly || C.card, jaw = o.jaw || 0, tail = o.tail || 0, depth = o.depth == null ? 6 : o.depth;
    const thick = v === 'meg' ? 1.12 : 1.0; // megalodon: stockier
    const Y = y => y * thick;
    // fins behind body (far side pectoral)
    P.paper(ctx, path(key + 'pecFar', [[200, Y(70)], [150, Y(80)], [70, Y(200)], [120, Y(190)]], 6), P.shade(top, -0.15), { depth: depth * 0.6, tex: 0.18 });
    // caudal fin (swings)
    ctx.save(); ctx.translate(-450, 0); ctx.rotate(tail * 0.12);
    P.paper(ctx, path(key + 'tail', [[10, Y(-24)], [-200, Y(-275)], [-165, Y(-150)], [-115, Y(-10)], [-180, Y(190)], [10, Y(24)]], 7, 1.4), top, { depth: depth, tex: 0.24 });
    P.paper(ctx, path(key + 'tailLow', [[0, Y(12)], [-115, Y(-5)], [-175, Y(185)], [-60, Y(80)]], 6), P.shade(body, 0.12), { depth: 0, edge: 0.8, tex: 0.2 });
    ctx.restore();
    // main body
    const bodyCtrl = [[500, Y(-2)], [440, Y(-58)], [330, Y(-100)], [170, Y(-128)], [0, Y(-134)], [-180, Y(-112)], [-340, Y(-70)], [-440, Y(-30)], [-470, Y(-20)],
      [-470, Y(20)], [-430, Y(32)], [-330, Y(62)], [-180, Y(104)], [0, Y(124)], [170, Y(112)], [330, Y(84)], [440, Y(46)], [492, Y(16)]];
    P.paper(ctx, path(key + 'body', bodyCtrl, 6), body, { depth: depth, tex: 0.26, inner: true });
    // dark back (counter-shading top) clipped to body
    ctx.save(); ctx.clip(path(key + 'body', bodyCtrl, 6));
    P.paper(ctx, path(key + 'back', [[520, Y(-60)], [500, Y(-25)], [380, Y(-55)], [200, Y(-60)], [0, Y(-48)], [-200, Y(-35)], [-480, Y(-6)], [-480, Y(-160)], [520, Y(-160)]], 4), top, { depth: 2, tex: 0.22, edge: 0 });
    // pale belly with wavy cut boundary
    P.paper(ctx, path(key + 'belly', [[505, Y(10)], [420, Y(28)], [300, Y(36)], [160, Y(50)], [20, Y(44)], [-140, Y(58)], [-300, Y(40)], [-480, Y(22)], [-480, Y(160)], [505, Y(160)]], 4), belly, { depth: 2.5, tex: 0.2, edge: 1.2 });
    ctx.restore();
    // gill slits: thin cut strips
    for (let i = 0; i < 5; i++) {
      const gx = 300 - i * 26;
      P.paper(ctx, P.cutPath(key + 'gill' + i, [[gx, Y(-62)], [gx + 7, Y(-62)], [gx - 4, Y(40)], [gx - 11, Y(40)]], { j: 0.6, seg: 8 }), P.shade(top, -0.35), { depth: 0, edge: 0.6, tex: 0 });
    }
    // dorsal fin
    P.paper(ctx, path(key + 'dorsal', [[80, Y(-118)], [20, Y(-200)], [-30, Y(-318)], [-70, Y(-290)], [-95, Y(-200)], [-140, Y(-112)]], 7), top, { depth: depth * 0.8, tex: 0.24 });
    P.paper(ctx, path(key + 'dorsal2', [[-330, Y(-66)], [-372, Y(-112)], [-392, Y(-58)]], 5), top, { depth: depth * 0.5, tex: 0.2 });
    // near pectoral fin
    P.paper(ctx, path(key + 'pec', [[250, Y(56)], [140, Y(80)], [40, Y(260)], [90, Y(262)], [170, Y(160)]], 6), P.shade(top, 0.08), { depth: depth * 0.9, tex: 0.24 });
    P.paper(ctx, path(key + 'pelvic', [[-210, Y(98)], [-260, Y(100)], [-300, Y(170)], [-250, Y(150)]], 5), top, { depth: depth * 0.6, tex: 0.2 });
    // mouth: dark cavity with cream teeth, jaw drops when open
    const open = jaw * 60;
    ctx.save(); ctx.translate(0, 0);
    P.paper(ctx, P.cutPath(key + 'mouth' + Math.round(open), [[480, Y(18)], [430, Y(34 + open * 0.3)], [340, Y(46 + open)], [300, Y(44 + open * 0.6)], [330, Y(30)], [420, Y(22)]], { j: 0.8, seg: 10 }), C.charcoal, { depth: 0, edge: 0.8, tex: 0.1 });
    for (let i = 0; i < 7; i++) {
      const tx = 455 - i * 20, ty = Y(24 + i * 2.4);
      P.paper(ctx, P.cutPath(key + 'tu' + i, [[tx - 7, ty], [tx + 7, ty], [tx, ty + 15]], { j: 0.3, seg: 30 }), C.card, { depth: 0, edge: 0, tex: 0 });
      if (jaw > 0.05) P.paper(ctx, P.cutPath(key + 'tl' + i + Math.round(open), [[tx - 6, ty + open * 0.75 + 16], [tx + 6, ty + open * 0.75 + 16], [tx, ty + open * 0.75 + 2]], { j: 0.3, seg: 30 }), C.card, { depth: 0, edge: 0, tex: 0 });
    }
    ctx.restore();
    // eye
    P.paper(ctx, P.cutPath(key + 'eye', P.ellipsePts(398, Y(-36), 11, 11, 14), { j: 0.4 }), C.charcoal, { depth: 1, edge: 0.6, tex: 0 });
    ctx.fillStyle = 'rgba(255,250,238,0.8)'; ctx.beginPath(); ctx.arc(395, Y(-39), 3, 0, 7); ctx.fill();
  }

  // ---------- FOSSIL TOOTH. Local: tip (0,-1) .. root bottom ~0.5. ----------
  function tooth(ctx, s, o) {
    o = o || {}; const key = 'tooth-' + (o.key || 'm') + Math.round(s), blade = o.blade || '#56646B', root = o.root || '#7B5A45';
    const S = pts => pts.map(q => [q[0] * s, q[1] * s]), cp = (k, pts, j) => P.cutPath(key + k, S(pts), { j: j, seg: Math.max(6, s * 0.05) });
    P.paper(ctx, cp('root', [[-0.5, 0.18], [-0.56, 0.42], [-0.44, 0.55], [-0.2, 0.47], [0, 0.4], [0.2, 0.47], [0.44, 0.55], [0.56, 0.42], [0.5, 0.18]], 1.4), root, { depth: 8, edge: 2, tex: 0.3 });
    P.paper(ctx, cp('bour', [[-0.47, 0.16], [0, 0.08], [0.47, 0.16], [0.47, 0.26], [0, 0.19], [-0.47, 0.26]], 1), '#3B3532', { depth: 2, edge: 1.2, tex: 0.25 });
    const pts = [], n = Math.max(14, Math.round(s / 14));
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([-0.46 * (1 - t) + 0.02 * Math.sin(t * Math.PI) - ((i % 2) ? 0.012 : 0), 0.17 - t * 1.17]); }
    for (let i = n; i >= 0; i--) { const t = i / n; pts.push([0.46 * (1 - t) + 0.05 * Math.sin(t * Math.PI) + ((i % 2) ? 0.012 : 0), 0.17 - t * 1.17]); }
    P.paper(ctx, P.cutPath(key + 'blade', S(pts), { j: 0.4, seg: 1000 }), blade, { depth: 10, edge: 2.2, tex: 0.32 });
    P.paper(ctx, cp('facet', [[-0.3, 0.1], [-0.02, -0.9], [0.08, -0.5], [0.05, 0.08]], 0.8), P.shade(blade, 0.22), { depth: 0, edge: 0, tex: 0.22 });
    P.paper(ctx, cp('facet2', [[0.1, 0.05], [0.04, -0.75], [0.3, 0.05]], 0.8), P.shade(blade, -0.12), { depth: 0, edge: 0, tex: 0.2 });
  }

  // ---------- WHALE (prey), facing left ----------
  function whale(ctx, o) {
    o = o || {}; const col = o.color || C.sage, key = 'whale';
    P.paper(ctx, path(key + 'flukes', [[330, 0], [430, -70], [460, -60], [400, 0], [460, 60], [430, 70]], 5), P.shade(col, -0.2), { depth: 5, tex: 0.24 });
    P.paper(ctx, path(key + 'body', [[-330, 10], [-300, -40], [-180, -78], [0, -82], [180, -56], [330, -10], [340, 10], [180, 50], [0, 74], [-180, 70], [-300, 46]], 7), col, { depth: 6, tex: 0.26, inner: true });
    ctx.save(); ctx.clip(path(key + 'body', [[-330, 10], [-300, -40], [-180, -78], [0, -82], [180, -56], [330, -10], [340, 10], [180, 50], [0, 74], [-180, 70], [-300, 46]], 7));
    for (let i = 0; i < 6; i++) P.paper(ctx, P.cutPath(key + 'groove' + i, [[-300 + i * 14, 34 + i * 6], [-60 + i * 10, 52 + i * 5], [-60 + i * 10, 56 + i * 5], [-300 + i * 14, 38 + i * 6]], { j: 0.4, seg: 30 }), P.shade(col, 0.35), { depth: 0, edge: 0, tex: 0 });
    ctx.restore();
    P.paper(ctx, path(key + 'flip', [[-150, 40], [-90, 46], [-40, 140], [-80, 136]], 5), P.shade(col, -0.12), { depth: 4, tex: 0.22 });
    P.paper(ctx, path(key + 'dors', [[120, -60], [160, -96], [180, -56]], 4), P.shade(col, -0.15), { depth: 3, tex: 0.2 });
    P.paper(ctx, P.cutPath(key + 'eye', P.ellipsePts(-240, 6, 8, 8, 10), { j: 0.3 }), C.charcoal, { depth: 1, edge: 0.5, tex: 0 });
  }

  // ---------- DIVER (1.8 m scale reference), standing; local height 0..-180 ----------
  function person(ctx, o) {
    o = o || {}; const col = o.color || C.charcoal, key = 'person';
    P.paper(ctx, P.cutPath(key + 'legs', [[-20, -90], [20, -90], [22, 0], [6, 0], [0, -50], [-6, 0], [-22, 0]], { j: 0.6, seg: 12 }), col, { depth: 3, tex: 0.2 });
    P.paper(ctx, P.cutPath(key + 'torso', [[-26, -150], [26, -150], [22, -86], [-22, -86]], { j: 0.6, seg: 12 }), C.terracotta, { depth: 3, tex: 0.22 });
    P.paper(ctx, P.cutPath(key + 'arms', [[-36, -148], [-26, -150], [-30, -96], [-40, -98]], { j: 0.5, seg: 12 }), C.terracotta, { depth: 2, tex: 0.2 });
    P.paper(ctx, P.cutPath(key + 'head', P.ellipsePts(0, -166, 15, 16, 16), { j: 0.6 }), col, { depth: 3, tex: 0.2 });
  }

  // ---------- small UI paper pieces ----------
  function card(ctx, key, x, y, w, h, col, o) { if (w < 4 || h < 4) return; P.paper(ctx, P.cutPath(key, P.roundRectPts(x, y, w, h, o && o.r != null ? o.r : 16, 4), { j: 1.1, seg: 26 }), col, Object.assign({ depth: 6, tex: 0.22 }, o)); }
  function tab(ctx, key, x, y, label, col, size, tcol) {
    size = size || 30; const w = P.measure(ctx, label, size, 700, P.F.body, 3) + size * 1.4;
    card(ctx, key, x, y, w, size * 1.7, col, { r: 6, depth: 4 });
    P.text(ctx, label, x + size * 0.7, y + size * 1.17, { size, w: 700, color: tcol || C.charcoal, track: 3 });
    return w;
  }
  function pin(ctx, x, y, col) {
    P.paper(ctx, P.cutPath('pin' + Math.round(x) + Math.round(y), P.ellipsePts(x, y, 14, 14, 14), { j: 0.4 }), col || C.terracotta, { depth: 5, edge: 1, tex: 0.1 });
    ctx.fillStyle = 'rgba(255,250,238,0.7)'; ctx.beginPath(); ctx.arc(x - 4, y - 4, 4, 0, 7); ctx.fill();
  }
  // X or check mark made of two paper strips
  function mark(ctx, key, x, y, s, kind, col) {
    const w = s * 0.18;
    const strip = (k, x1, y1, x2, y2) => { const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
      P.paper(ctx, P.cutPath(key + k, [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], { j: 0.8, seg: 14 }), col, { depth: 3, tex: 0.15 }); };
    if (kind === 'x') { strip('a', x - s / 2, y - s / 2, x + s / 2, y + s / 2); strip('b', x + s / 2, y - s / 2, x - s / 2, y + s / 2); }
    else { strip('a', x - s / 2, y, x - s / 8, y + s / 2.4); strip('b', x - s / 8, y + s / 2.4, x + s / 2, y - s / 2); }
  }
  // round stamp with text
  function stamp(ctx, key, x, y, r, label, sub, col, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.16); ctx.globalAlpha *= alpha == null ? 1 : alpha;
    P.paper(ctx, P.cutPath(key + 'o', P.ellipsePts(0, 0, r, r * 0.62, 48), { j: 1.4, seg: 14 }), col, { depth: 7, tex: 0.25 });
    P.paper(ctx, P.cutPath(key + 'i', P.ellipsePts(0, 0, r - 16, r * 0.62 - 16, 48), { j: 1.1, seg: 14 }), C.card, { depth: 0, edge: 0, tex: 0.2 });
    P.paper(ctx, P.cutPath(key + 'c', P.ellipsePts(0, 0, r - 26, r * 0.62 - 26, 48), { j: 1.1, seg: 14 }), col, { depth: 0, edge: 0.8, tex: 0.25 });
    const ls = Math.min(r * 0.34, r * 0.34 * (2 * r - 90) / P.measure(ctx, label, r * 0.34, 900, P.F.head, 2));
    P.text(ctx, label, 0, ls * 0.38, { size: ls, fam: P.F.head, w: 900, align: 'center', color: C.card, track: 2 });
    if (sub) P.text(ctx, sub, 0, r * 0.36, { size: Math.max(13, r * 0.11), w: 700, align: 'center', color: C.card, track: 2 });
    ctx.restore();
  }
  // thermometer: level 0..1
  function thermo(ctx, key, x, y, h, level) {
    card(ctx, key + 'tube', x - 22, y, 44, h, C.card, { r: 22, depth: 4 });
    P.paper(ctx, P.cutPath(key + 'bulb', P.ellipsePts(x, y + h + 18, 36, 36, 24), { j: 0.6 }), C.terracotta, { depth: 5, tex: 0.22 });
    const lh = (h - 30) * level;
    P.paper(ctx, P.cutPath(key + 'liq' + Math.round(lh), P.roundRectPts(x - 11, y + h - lh, 22, lh + 20, 10, 3), { j: 0.5, seg: 20 }), C.terracotta, { depth: 0, edge: 0.6, tex: 0.2 });
    for (let i = 1; i < 6; i++) { ctx.fillStyle = C.charcoal; ctx.fillRect(x + 26, y + h * i / 6, 16, 3); }
  }
  // dial gauge, value 0..1
  function gauge(ctx, key, x, y, r, v, col) {
    P.paper(ctx, P.cutPath(key + 'face', P.ellipsePts(x, y, r, r, 40), { j: 0.8 }), C.card, { depth: 6, tex: 0.2 });
    ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = C.charcoal; ctx.lineCap = 'round';
    for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.75 + i / 10 * Math.PI * 1.5; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); ctx.lineTo(x + Math.cos(a) * r * (i % 5 ? 0.68 : 0.6), y + Math.sin(a) * r * (i % 5 ? 0.68 : 0.6)); ctx.stroke(); }
    ctx.restore();
    // danger arc as paper strip
    const arc = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * 1.8 + i / 12 * Math.PI * 0.45; arc.push([x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9]); }
    for (let i = 12; i >= 0; i--) { const a = Math.PI * 1.8 + i / 12 * Math.PI * 0.45; arc.push([x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8]); }
    P.paper(ctx, P.cutPath(key + 'arc', arc, { j: 0.6, seg: 12 }), col || C.terracotta, { depth: 2, tex: 0.2 });
    const a = Math.PI * 0.75 + v * Math.PI * 1.5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    P.paper(ctx, P.cutPath(key + 'needle', [[-r * 0.12, -7], [r * 0.82, -2], [r * 0.82, 2], [-r * 0.12, 7]], { j: 0.4, seg: 30 }), C.charcoal, { depth: 4, tex: 0.1 });
    ctx.restore();
    P.paper(ctx, P.cutPath(key + 'hub', P.ellipsePts(x, y, 14, 14, 12), { j: 0.3 }), C.mustard, { depth: 3, tex: 0.1 });
  }

  G.Art = { catmull, path, shark, tooth, whale, person, card, tab, pin, mark, stamp, thermo, gauge };
})(window);
