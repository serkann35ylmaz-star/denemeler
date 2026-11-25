#!/usr/bin/env python3
"""Kullanıcının beğendiği 08'deki yüzgeci (çentikli, kırmızı kenarlı) kesip diğer sahnelere koyar.
Kullanım: python3 yuzgec-08.py <sahne> <kaynak.jpg> <cikti.jpg>   (sahne: 07 | 09a | 09b | 15)"""
import sys, os, cv2, numpy as np
G = os.path.join(os.path.dirname(__file__), '..', '..', 'gorseller', 'ada9')
POLY = [(852, 944), (848, 1000), (840, 1040), (822, 1058), (842, 1072), (858, 1140), (864, 1186), (902, 1204), (840, 1228),
        (700, 1232), (640, 1236), (642, 1210), (668, 1170), (705, 1100), (752, 1030), (800, 982)]
CFG = {  # boy: yüzgeç yüksekliği, taban: suya girdiği nokta, sil: eski küçük yüzgecin kutusu, rim: kırmızı kenar şiddeti, ton: sahne rengi
    '07': dict(boy=290, taban=(790, 640), sil=(838, 402, 905, 458), rim=0.55, ton=(60, 75, 85), kopuk=0.55),
    '09a': dict(boy=580, taban=(1225, 1110), sil=(1205, 730, 1290, 808), rim=0.5, ton=(75, 80, 85), kopuk=0.7),
    '09b': dict(boy=520, taban=(795, 1290), sil=(690, 1045, 960, 1300), rim=0.0, ton=(70, 90, 20), kopuk=0.95),
    '15': dict(boy=600, taban=(640, 1840), sil=None, rim=0.7, ton=(70, 80, 40), kopuk=0.0)}


def sprite():
    im = cv2.imread(os.path.join(G, '08.jpg'))
    m = np.zeros(im.shape[:2], np.uint8); cv2.fillPoly(m, [np.array(POLY, np.int32)], 255)
    V = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)[..., 2]
    m &= ((V < 118) | (m > 0) & (np.arange(im.shape[0])[:, None] < 1200)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    ys, xs = np.where(m > 0); b = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    return im[b[1]:b[3], b[0]:b[2]], m[b[1]:b[3], b[0]:b[2]]


def main():
    n, src, out = sys.argv[1:4]; c = CFG[n]
    im = cv2.imread(src); roi, m = sprite()
    s = c['boy'] / roi.shape[0]
    roi = cv2.resize(roi, None, fx=s, fy=s, interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    m = cv2.resize(m, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    if c['sil']:
        x0, y0, x1, y1 = c['sil']
        Vb = cv2.cvtColor(im[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)[..., 2]
        d = np.zeros(im.shape[:2], np.uint8); d[y0:y1, x0:x1] = (Vb < 70).astype(np.uint8) * 255
        im = cv2.inpaint(im, cv2.dilate(d, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))), 5, cv2.INPAINT_TELEA)
    # renk uyumu: kırmızı kenar ışığını sahnenin tonuna çek (turkuaz sahnede söndür, günbatımında yumuşat)
    rf = roi.astype(np.float32); bch, gch, rch = rf[..., 0], rf[..., 1], rf[..., 2]
    rim = np.clip((rch - np.maximum(gch, bch) - 25) / 80, 0, 1)[..., None]
    gray = rf.mean(axis=2, keepdims=True) * np.array([1.0, 0.95, 0.9], np.float32)
    k = c.get('rim', 0.0); roi = (rf * (k * rim + (1 - rim)) + gray * ((1 - k) * rim)).astype(np.float32)
    if 'ton' in c:
        roi = roi * 0.82 + np.array(c['ton'], np.float32)[None, None, :] * 0.18
    h, w = roi.shape[:2]; tx = int(c['taban'][0] - w / 2); ty = int(c['taban'][1] - h)
    a = cv2.GaussianBlur(m, (0, 0), 0.9).astype(np.float32)[..., None] / 255
    # alt kenarı suya doğru yumuşakça sönsün
    fade = np.clip((h - np.arange(h)) / (0.02 * h), 0, 1)[:, None, None]; a = a * fade
    f = im.astype(np.float32)
    # suda iz: yüzgecin tabanında köpüklü V dalga + sönen halkalar (yüzgecin arkasında kalır)
    H, W = im.shape[:2]; rng = np.random.default_rng(4)
    nz = cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 2.5); nz = (nz - nz.min()) / (nz.max() - nz.min())
    foam = np.zeros((H, W), np.float32); bx, by = c['taban']; fw = int(w * 0.62)
    cv2.ellipse(foam, (bx, by + 2), (fw, max(6, int(h * 0.035))), 0, 0, 360, 1.0, -1)
    cv2.ellipse(foam, (bx + int(fw * .45), by + int(h * .05)), (int(fw * .8), max(4, int(h * .022))), 0, 0, 360, .75, -1)
    cv2.ellipse(foam, (bx - int(fw * .6), by + int(h * .035)), (int(fw * .55), max(3, int(h * .018))), 0, 0, 360, .6, -1)
    foam = cv2.GaussianBlur(foam, (0, 0), max(2.0, h * 0.006)); foam = np.clip(foam * 1.5 + nz * 0.9 - 0.95, 0, 1)
    foam[:by - 2, :] = 0; foam = cv2.GaussianBlur(foam, (0, 0), 1.0)[..., None] * c.get('kopuk', 0.85)
    f = f * (1 - foam) + np.array([238, 242, 242], np.float32) * foam
    f[ty:ty + h, tx:tx + w] = f[ty:ty + h, tx:tx + w] * (1 - a) + roi.astype(np.float32) * a
    cv2.imwrite(out, np.clip(f, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95]); print('tamam', n, w, h)


main()
