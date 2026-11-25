#!/usr/bin/env python3
"""Kullanıcının beğendiği 08'deki yüzgeci (çentikli, kırmızı kenarlı) kesip diğer sahnelere koyar.
Kullanım: python3 yuzgec-08.py <sahne> <kaynak.jpg> <cikti.jpg>   (sahne: 07 | 09a | 09b | 15)"""
import sys, os, cv2, numpy as np
G = os.path.join(os.path.dirname(__file__), '..', '..', 'gorseller', 'ada9')
POLY = [(852, 944), (848, 1000), (840, 1040), (822, 1058), (842, 1072), (858, 1140), (864, 1186), (902, 1204), (840, 1228),
        (700, 1232), (640, 1236), (642, 1210), (668, 1170), (705, 1100), (752, 1030), (800, 982)]
CFG = {  # boy: yüzgeç yüksekliği (px), taban: yüzgecin suya girdiği nokta, sil: eski küçük yüzgecin kutusu (koyu piksel silinir)
    '07': dict(boy=330, taban=(770, 650), sil=(838, 402, 905, 458)),
    '09a': dict(boy=400, taban=(1243, 960), sil=(1205, 730, 1290, 808)),
    '09b': dict(boy=480, taban=(795, 1290), sil=(690, 1045, 960, 1300)),
    '15': dict(boy=470, taban=(640, 1870), sil=None)}


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
    h, w = roi.shape[:2]; tx = int(c['taban'][0] - w / 2); ty = int(c['taban'][1] - h)
    a = cv2.GaussianBlur(m, (0, 0), 0.9).astype(np.float32)[..., None] / 255
    # alt kenarı suya doğru yumuşakça sönsün
    fade = np.clip((h - np.arange(h)) / (0.07 * h), 0, 1)[:, None, None]; a = a * fade
    f = im.astype(np.float32)
    f[ty:ty + h, tx:tx + w] = f[ty:ty + h, tx:tx + w] * (1 - a) + roi.astype(np.float32) * a
    cv2.imwrite(out, np.clip(f, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95]); print('tamam', n, w, h)


main()
