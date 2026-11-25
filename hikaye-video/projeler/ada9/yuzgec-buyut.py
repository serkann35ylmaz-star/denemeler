#!/usr/bin/env python3
"""Küçük kalan köpekbalığı yüzgeçlerini büyütür: eski küçük yüzgeç silinir (Telea), yerine 09b'deki çentikli yüzgeç
hedef boyda konur (taban köpüğü korunur). Kullanım: python3 yuzgec-buyut.py <sahne:07|09a> <cikti.jpg>"""
import sys, os, cv2, numpy as np
G = os.path.join(os.path.dirname(__file__), '..', '..', 'gorseller', 'ada9')
CFG = {'07': dict(box=(838, 402, 905, 458), taban=(868, 446), boy=135),
       '09a': dict(box=(1205, 730, 1290, 808), taban=(1243, 797), boy=185)}
n = sys.argv[1]; cfg = CFG[n]
im = cv2.imread(os.path.join(G, n + '.jpg'))
# yeni yüzgeç: 09b'den
b = cv2.imread(os.path.join(G, '09b.jpg')); roi = b[1045:1300, 690:960]
V = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)[..., 2]
fin = (V < 80).astype(np.uint8) * 255
k, lab, st, _ = cv2.connectedComponentsWithStats(fin)
fin = (lab == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8) * 255
fin = cv2.morphologyEx(fin, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
ys, xs = np.where(fin > 0); crop = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
roi = roi[crop[1]:crop[3], crop[0]:crop[2]]; fin = fin[crop[1]:crop[3], crop[0]:crop[2]]
s = cfg['boy'] / fin.shape[0]
roi = cv2.resize(roi, None, fx=s, fy=s, interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
fin = cv2.resize(fin, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
# eski küçük yüzgeci sil
x0, y0, x1, y1 = cfg['box']
Vb = cv2.cvtColor(im[y0:y1, x0:x1], cv2.COLOR_BGR2HSV)[..., 2]
dark = np.zeros(im.shape[:2], np.uint8); dark[y0:y1, x0:x1] = (Vb < 70).astype(np.uint8) * 255
dark = cv2.dilate(dark, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
im = cv2.inpaint(im, dark, 5, cv2.INPAINT_TELEA)
# yeni yüzgeci koy: tabanı eski tabana
m = cv2.GaussianBlur(fin, (0, 0), 0.8).astype(np.float32)[..., None] / 255
h, w = roi.shape[:2]
tx = int(cfg['taban'][0] - w / 2); ty = int(cfg['taban'][1] - h)
sc = im.astype(np.float32)
# suya uysun: yüzgeç rengini sahnenin su tonuna doğru hafif karıştır
tone = im[cfg['taban'][1] + 6: cfg['taban'][1] + 30, cfg['taban'][0] - 20: cfg['taban'][0] + 20].reshape(-1, 3).mean(axis=0)
col = roi.astype(np.float32) * 0.55 + tone[None, None, :] * 0.10
sc[ty:ty + h, tx:tx + w] = sc[ty:ty + h, tx:tx + w] * (1 - m) + col * m
cv2.imwrite(sys.argv[2], np.clip(sc, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95])
print('tamam', n, 'yüzgeç boyu', h, 'x', w)
