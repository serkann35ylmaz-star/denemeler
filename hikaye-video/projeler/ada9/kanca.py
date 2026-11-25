#!/usr/bin/env python3
"""Köpekbalığı kancasını bütün sahnelerde AYNI çizimle, ağzın içinde (yanağa saplı) gösterir.
Eski dışarı sarkan kanca + misina silinir (inpaint), yerine tek bir kanca sprite'ı çizilir.
Kullanım (repo kökünden): python3 hikaye-video/projeler/ada9/kanca.py <sahne> [<sahne> ...] [--kaynak orijinal_klasör] [--cikti klasör]
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
                orijinal=(458, 1214, 0, 1.05)),
    '14b': dict(cor=[(200, 1440, 360, 1860)], sil=[([(322, 1282), (330, 1250), (352, 1226), (400, 1214), (432, 1232), (444, 1262), (432, 1292), (396, 1306), (360, 1322), (342, 1352), (338, 1385)], 42),
                     ([(346, 1396), (356, 1416)], 84), ([(338, 1430), (332, 1480), (318, 1540), (312, 1600), (296, 1690), (270, 1770), (245, 1830)], 30),
                     ([(310, 1535), (255, 1565)], 44), ([(285, 1785), (215, 1850)], 56)], orijinal=(345, 1232, 8, 1.3)),
    # 15: önce Canva'dan 09c köpekbalığıyla alt yarı üretildi, orijinal üst yarıyla birleştirildi (15comp); sonra Canva'nın küçük kancası silinip 01b kancası konur
    '15': dict(cor=[(585, 1605, 650, 1700)], orijinal=(598, 1624, 0, 0.9)),
    '01b': dict(cor=[(670, 1090, 920, 1470)], sil=[([(738, 1078), (736, 1122)], 30), ([(745, 1182), (748, 1202)], 56), ([(708, 1160), (716, 1170)], 36), ([(826, 1392), (838, 1400)], 34), ([(880, 1436), (896, 1446)], 36), ([(826, 1330), (840, 1345)], 30)], orijinal=(774, 1092, 0, 0.5)),
}


def sprite(scale):
    """Paslı J kanca: siyah mürekkep konturu, yuvarlak (silindirik) gölgeleme, pas dokusu, parlak vurgu. RGBA."""
    S = 4 * scale; W = int(120 * S); H = int(150 * S); ox, oy = int(30 * S), int(10 * S)
    def P(x, y): return (int(ox + x * S), int(oy + y * S))
    pts = [(0, 0), (0, 62)]
    for a in np.linspace(180, 360, 28):  # alt yay, merkez (24, 62), r=24
        pts.append((24 - 24 * math.cos(math.radians(a - 180)), 62 + 24 * math.sin(math.radians(a - 180))))
    pts += [(48, 62), (48, 30)]
    poly = np.array([P(*p) for p in pts], np.int32)
    barb = np.array([P(48, 27), P(36, 43), P(48, 40)], np.int32)
    def mask(th):
        m = np.zeros((H, W), np.uint8)
        cv2.polylines(m, [poly], False, 255, max(1, int(th * S)), cv2.LINE_AA)
        cv2.fillPoly(m, [barb], 255)
        return m
    outline, base = mask(14.5), mask(10.5)
    bf = base.astype(np.float32) / 255
    sm = cv2.GaussianBlur(bf, (0, 0), 3.2 * S / 4)
    gy, gx = np.gradient(sm)
    nx, ny = -gx, -gy
    nl = np.sqrt(nx ** 2 + ny ** 2) + 1e-6
    light = np.clip(0.5 + 0.9 * ((-nx / nl) * 0.6 + (-ny / nl) * 0.8) * np.clip(nl * 28, 0, 1), 0.08, 1.15)
    rng = np.random.default_rng(5)
    tex = cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 1.0 * S / 4) - .5
    tex2 = cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 3.0 * S / 4) - .5
    rust = np.array([30, 70, 125], np.float32) * (1 + 1.3 * tex[..., None] + 0.9 * tex2[..., None])
    col = rust * light[..., None] * 1.15
    spec = np.clip((light - .95) * 6, 0, 1)[..., None]
    col = col * (1 - spec) + np.array([120, 175, 225], np.float32) * spec
    pits = (cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 1.6 * S / 4) > .62)[..., None]
    col = np.where(pits, col * .45, col)
    rgb = np.where(base[..., None] > 127, col, np.array([16, 18, 26], np.float32))
    alpha = cv2.GaussianBlur(outline.astype(np.float32) / 255, (0, 0), 0.7 * S / 4)
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255])
    # kısa yeşil misina ucu (yanağa doğru kaybolur)
    ln = np.zeros((H, W), np.uint8); lk = np.zeros((H, W), np.uint8)
    path = np.array([P(0, 0), P(-4, -6), P(-1, -12)], np.int32)
    cv2.polylines(lk, [path], False, 255, int(5.6 * S), cv2.LINE_AA); cv2.polylines(ln, [path], False, 255, int(3 * S), cv2.LINE_AA)
    a2 = cv2.GaussianBlur(lk.astype(np.float32) / 255, (0, 0), .7 * S / 4)
    out[..., :3] = np.where(lk[..., None] > 127, (16, 18, 26), out[..., :3]); out[..., 3] = np.maximum(out[..., 3], a2 * 255)
    out[..., :3] = np.where(ln[..., None] > 127, (70, 150, 90), out[..., :3])
    return out, (ox, oy), S


HOOK_YOL = [(322, 1282), (330, 1250), (352, 1226), (400, 1214), (432, 1232), (444, 1262), (432, 1292), (396, 1306), (360, 1322), (346, 1346)]  # 14b'deki orijinal kancanın yolu


def sprite_01b(kaynak):
    """01b'deki (kullanıcının beğendiği) kanca + misina: renk maskesi + kontur. RGBA, çapa = sapın ağızdaki ucu."""
    im = cv2.imread(os.path.join(kaynak, '01b.jpg'))
    X0, Y0, X1, Y1 = 672, 1050, 920, 1470
    roi = im[Y0:Y1, X0:X1]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    h, sa, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    rust = (((h <= 24) | (h >= 168)) & (sa >= 70) & (v >= 40) & (v <= 240))
    tan = ((h >= 18) & (h <= 64) & (sa >= 55) & (v >= 70))
    m = (rust | tan).astype(np.uint8) * 255
    m[:25, :] = 0  # üstteki dişleri/dudağı alma
    koridor = np.zeros(m.shape, np.uint8)  # yalnızca kanca + misina yolu
    for yol, th in (([(742, 1070), (740, 1110), (730, 1150), (708, 1168), (694, 1140)], 56), ([(745, 1185), (762, 1250), (790, 1322), (832, 1384), (884, 1442)], 36), ([(832, 1384), (897, 1452)], 40)):
        cv2.polylines(koridor, [np.array([(x - X0, y - Y0) for x, y in yol], np.int32)], False, 255, th, cv2.LINE_AA)
    m &= koridor
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i][4] >= 25: keep[lab == i] = 255
    keep = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    a = cv2.GaussianBlur(keep, (0, 0), 1.2).astype(np.float32)
    yy = np.arange(a.shape[0], dtype=np.float32)[:, None]
    a *= np.clip((1335 - Y0 - yy) / 45, 0, 1)  # misinanın alt ucu (püsküllü kısım) yumuşakça kaybolur
    return np.dstack([roi.astype(np.float32), a.astype(np.float32)]), (742 - X0, 1078 - Y0)


def orijinal_sprite(kaynak):
    """14b'deki orijinal (güzel çizilmiş, paslı) kancayı keser: RGBA + sap ucu (çapa) konumu."""
    im = cv2.imread(os.path.join(kaynak, '14b.jpg'))
    X0, Y0, X1, Y1 = 290, 1190, 470, 1360
    m = np.zeros(im.shape[:2], np.uint8)
    cv2.polylines(m, [np.array(HOOK_YOL, np.int32)], False, 255, 30, cv2.LINE_AA)
    m = cv2.GaussianBlur(m, (0, 0), 1.6)
    crop = im[Y0:Y1, X0:X1].astype(np.float32); a = m[Y0:Y1, X0:X1].astype(np.float32)
    return np.dstack([crop, a]), (HOOK_YOL[-1][0] - X0, HOOK_YOL[-1][1] - Y0)


def yerlestir_orijinal(im, sp, anc, x, y, aci, olcek):
    h, w = sp.shape[:2]
    M = cv2.getRotationMatrix2D(anc, -aci, olcek)
    M[0, 2] += x - anc[0]; M[1, 2] += y - anc[1]
    layer = cv2.warpAffine(sp, M, (im.shape[1], im.shape[0]), flags=cv2.INTER_AREA if olcek < 1 else cv2.INTER_CUBIC, borderValue=(0, 0, 0, 0))
    a = layer[..., 3:4] / 255
    im[:] = np.clip(im.astype(np.float32) * (1 - a) + layer[..., :3] * a, 0, 255).astype(np.uint8)


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
    kaynak = sys.argv[sys.argv.index('--kaynak') + 1] if '--kaynak' in sys.argv else G  # orijinal (kancası dışarıda) görseller
    args = [a for a in args if a not in (cikti, kaynak)]
    for n in args:
        cfg = SAHNE[n]; im = cv2.imread(os.path.join(kaynak, n + '.jpg'))
        orig = cv2.imread(os.path.join(kaynak, '14b.jpg')) if 'orijinal' in cfg else None
        im = temizle(im, cfg)
        if 'orijinal' in cfg:
            sp, anc = sprite_01b(kaynak); yerlestir_orijinal(im, sp, anc, *cfg['orijinal'])
        elif 'kanca' in cfg: yerlestir(im, *cfg['kanca'])
        cv2.imwrite(os.path.join(cikti or G, n + '.jpg'), im, [cv2.IMWRITE_JPEG_QUALITY, 95]); print('tamam', n)


if __name__ == '__main__':
    main()
