#!/usr/bin/env python3
"""Köpekbalığı kancasını bütün sahnelerde AYNI çizimle, ağzın içinde (yanağa saplı) gösterir.
Eski dışarı sarkan kanca + misina silinir (inpaint), yerine tek bir kanca sprite'ı çizilir.
Kullanım (repo kökünden): python3 hikaye-video/projeler/ada9/kanca.py <sahne> [<sahne> ...] [--cikti klasör]
Köpekbalığı çizimi değişmez; yalnızca kanca eklenir."""
import sys, os, math
import cv2, numpy as np

G = os.path.join(os.path.dirname(__file__), '..', '..', 'gorseller', 'ada9')

# her sahne: sil = [(noktalar, kalınlık)] çizgi maskeleri, roi = renk maskesiyle kanca avlanacak kutu,
# kanca = (x, y, açı°, ölçek): sprite'ın sapının tepe noktası, açı 0 = aşağı, + = sağa
SAHNE = {
    # klon: [(çizgiler, kalınlık, dx, dy)] -> bölgeyi, (dx, dy) kadar kaydırılmış temiz yerden kopyalar (dx>0: soldan, dy>0: yukarıdan alır)
    # sil: Telea ile doldurulacak ince çizgiler (su içindeki misina)
    '09c': dict(klon=[([([(455, 1230), (420, 1290), (392, 1340)], 54)], -100, -120),
                      ([([(392, 1340), (350, 1400), (335, 1425)], 54), ([(335, 1425), (330, 1452), (345, 1482), (385, 1478), (430, 1442)], 54)], -120, 0)],
                sil=[([(332, 1480), (320, 1540), (335, 1590), (365, 1630), (405, 1662)], 28),
                     ([(410, 1665), (385, 1685), (365, 1710)], 30), ([(412, 1672), (430, 1710), (440, 1756)], 30),
                     ([(415, 1672), (470, 1698), (512, 1722), (528, 1760), (525, 1795)], 30), ([(420, 1688), (470, 1684), (510, 1690)], 28), ([(395, 1655), (450, 1680), (520, 1705)], 55), ([(430, 1425), (440, 1440)], 30)],
                kanca=(472, 1203, -4, 0.8)),
    '14b': dict(cor=[(200, 1440, 360, 1860)], sil=[([(322, 1282), (330, 1250), (352, 1226), (400, 1214), (432, 1232), (444, 1262), (432, 1292), (396, 1306), (360, 1322), (342, 1352), (338, 1385)], 42),
                     ([(346, 1396), (356, 1416)], 84), ([(338, 1430), (332, 1480), (318, 1540), (312, 1600), (296, 1690), (270, 1770), (245, 1830)], 30),
                     ([(310, 1535), (255, 1565)], 44), ([(285, 1785), (215, 1850)], 56)],
                kanca=(352, 1236, 6, 1.25)),
    '15': dict(cor=[(893, 1490, 1020, 1585)], sil=[([(886, 1492), (892, 1516)], 24), ([(880, 1524), (884, 1530)], 44),
                    ([(900, 1535), (925, 1568), (962, 1582), (992, 1560), (1002, 1528), (990, 1500), (950, 1487)], 46), ([(955, 1490), (970, 1535)], 32)],
               kanca=(880, 1470, 84, 0.55)),
    '01b': dict(cor=[(670, 1090, 920, 1470)], sil=[([(738, 1078), (736, 1122)], 30), ([(745, 1182), (748, 1202)], 56), ([(708, 1160), (716, 1170)], 36), ([(826, 1392), (838, 1400)], 34), ([(880, 1436), (896, 1446)], 36), ([(826, 1330), (840, 1345)], 30)], kanca=(729, 1058, -4, 0.65)),
}


def sprite(scale):
    """Paslı J kanca: siyah mürekkep konturlu, turuncu-kahve gövde, parlak vurgu. RGBA, tepe (sap ucu) = (ox, oy)."""
    S = 4 * scale; W = int(120 * S); H = int(150 * S); ox, oy = int(30 * S), int(10 * S)
    lay = np.zeros((H, W, 4), np.float32)
    def P(x, y): return (int(ox + x * S), int(oy + y * S))
    pts = [(0, 0), (0, 62)]
    for a in np.linspace(180, 360, 24):  # alt yay, merkez (24, 62), r=24
        pts.append((24 + 24 * math.cos(math.radians(a)) * -1 if False else 24 - 24 * math.cos(math.radians(a - 180)), 62 + 24 * math.sin(math.radians(a - 180))))
    pts += [(48, 62), (48, 30)]
    poly = np.array([P(*p) for p in pts], np.int32)
    barb = np.array([P(48, 28), P(37, 42), P(48, 40)], np.int32)
    def stroke(col, th, off=(0, 0)):
        layer = np.zeros((H, W, 3), np.uint8); m = np.zeros((H, W), np.uint8)
        cv2.polylines(m, [poly + np.array(off, np.int32)], False, 255, int(th * S), cv2.LINE_AA)
        cv2.fillPoly(m, [barb + np.array(off, np.int32)], 255)
        return m
    outline = stroke(0, 14)
    base = stroke(0, 9.5)
    shade = stroke(0, 3.4, (int(2.2 * S), int(2.2 * S)))
    hi = stroke(0, 2.2, (int(-1.8 * S), int(-1.8 * S)))
    rgb = np.zeros((H, W, 3), np.float32)
    rgb[:] = (18, 20, 28)  # kontur (BGR)
    rng = np.random.default_rng(3)
    tex = cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 1.2 * S / 4) - .5
    rust = np.array([34, 74, 128], np.float32)  # BGR: pas rengi
    col = rust[None, None, :] * (1 + 1.1 * tex[..., None])
    rgb = np.where(base[..., None] > 127, col, rgb)
    rgb = np.where((shade[..., None] > 127) & (base[..., None] > 127), rust * .45, rgb)
    rgb = np.where((hi[..., None] > 127) & (base[..., None] > 127), np.array([84, 138, 190], np.float32), rgb)
    spots = (cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 2.2 * S / 4) > .58) & (base > 127)
    rgb = np.where(spots[..., None], rust * .38, rgb)
    alpha = cv2.GaussianBlur(outline.astype(np.float32) / 255, (0, 0), 0.8 * S / 4)
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255])
    # kısa yeşil misina ucu (yanağa doğru kaybolur), sapın tepesinden
    ln = np.zeros((H, W), np.uint8); cv2.polylines(ln, [np.array([P(0, 0), P(-4, -6), P(-1, -12)], np.int32)], False, 255, int(3 * S), cv2.LINE_AA)
    lnk = np.zeros((H, W), np.uint8); cv2.polylines(lnk, [np.array([P(0, 0), P(-4, -6), P(-1, -12)], np.int32)], False, 255, int(5.4 * S), cv2.LINE_AA)
    a2 = cv2.GaussianBlur(lnk.astype(np.float32) / 255, (0, 0), .7 * S / 4)
    out[..., :3] = np.where(lnk[..., None] > 127, (18, 20, 28), out[..., :3]); out[..., 3] = np.maximum(out[..., 3], a2 * 255)
    out[..., :3] = np.where(ln[..., None] > 127, (70, 150, 90), out[..., :3])
    return out, (ox, oy), S


def yerlestir(im, x, y, aci, olcek):
    sp, (ox, oy), S = sprite(olcek)
    h, w = sp.shape[:2]
    M = cv2.getRotationMatrix2D((ox, oy), -aci, 1.0)
    sp = cv2.warpAffine(sp, M, (w, h), flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0, 0))
    f = 1 / 4  # süper örneklemeyi küçült
    sp = cv2.resize(sp, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
    ox, oy = ox * f, oy * f
    X0, Y0 = int(round(x - ox)), int(round(y - oy))
    h, w = sp.shape[:2]
    y0c, x0c = max(0, Y0), max(0, X0); y1c, x1c = min(im.shape[0], Y0 + h), min(im.shape[1], X0 + w)
    s = sp[y0c - Y0:y1c - Y0, x0c - X0:x1c - X0]
    a = s[..., 3:4] / 255
    reg = im[y0c:y1c, x0c:x1c].astype(np.float32)
    im[y0c:y1c, x0c:x1c] = np.clip(reg * (1 - a) + s[..., :3] * a, 0, 255).astype(np.uint8)


def temizle(im, cfg):
    for lines, dx, dy in cfg.get('klon', []):
        m = np.zeros(im.shape[:2], np.uint8)
        for pts, th in lines: cv2.polylines(m, [np.array(pts, np.int32)], False, 255, th, cv2.LINE_AA)
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
        src = np.roll(im, (dy, dx), axis=(0, 1))   # çıktı[y,x] = im[y-dy, x-dx]
        ys, xs = np.where(m > 0)
        box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        c = ((box[0] + box[2]) // 2, (box[1] + box[3]) // 2)
        im = cv2.seamlessClone(src, im, m, c, cv2.NORMAL_CLONE)
    mask = np.zeros(im.shape[:2], np.uint8)
    for x0, y0, x1, y1 in cfg.get('cor', []):  # renk maskesi: pas/kırmızı-kahve kanca + bej misina
        hsv = cv2.cvtColor(im[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)
        h, sa, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
        rust = (((h <= 24) | (h >= 168)) & (sa >= 70) & (v >= 40) & (v <= 240))
        tan = ((h >= 18) & (h <= 64) & (sa >= 55) & (v >= 70))
        mask[y0:y1, x0:x1] |= ((rust | tan).astype(np.uint8) * 255)
    for pts, th in cfg.get('sil', []):
        cv2.polylines(mask, [np.array(pts, np.int32)], False, 255, th, cv2.LINE_AA)
    if mask.any():
        im = cv2.inpaint(im, cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))), 6, cv2.INPAINT_TELEA)
    return im


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    cikti = sys.argv[sys.argv.index('--cikti') + 1] if '--cikti' in sys.argv else None
    if cikti: args = [a for a in args if a != cikti]
    for n in args:
        cfg = SAHNE[n]; im = cv2.imread(os.path.join(G, n + '.jpg'))
        im = temizle(im, cfg); yerlestir(im, *cfg['kanca'])
        cv2.imwrite(os.path.join(cikti or G, n + '.jpg'), im, [cv2.IMWRITE_JPEG_QUALITY, 95]); print('tamam', n)


if __name__ == '__main__':
    main()
