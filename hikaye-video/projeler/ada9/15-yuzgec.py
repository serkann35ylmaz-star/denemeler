#!/usr/bin/env python3
"""15: Canva'dan gelen tam boy Kemal görseline, 09b'deki çentikli köpekbalığı yüzgecini (büyütülmüş) ve köpük izini ekler.
Kullanım: python3 15-yuzgec.py <15kemal.jpg> <09b.jpg> <cikti.jpg> [olcek=1.9]"""
import sys, cv2, numpy as np
k = cv2.imread(sys.argv[1]); b = cv2.imread(sys.argv[2]); out_path = sys.argv[3]
sc = float(sys.argv[4]) if len(sys.argv) > 4 else 1.9
roi = b[1045:1300, 690:960]
V = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)[..., 2]
fin = (V < 80).astype(np.uint8) * 255
n, lab, st, _ = cv2.connectedComponentsWithStats(fin)
fin = (lab == 1 + int(np.argmax(st[1:, 4]))).astype(np.uint8) * 255
fin = cv2.morphologyEx(fin, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
roi = cv2.resize(roi, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC)
fin = cv2.resize(fin, None, fx=sc, fy=sc, interpolation=cv2.INTER_CUBIC)
fin = (fin > 127).astype(np.uint8) * 255
m = cv2.GaussianBlur(fin, (0, 0), 1.0).astype(np.float32)[..., None] / 255
h, w = roi.shape[:2]
H, W = k.shape[:2]
base_y = 1800; cx_t = 620                       # yüzgecin taban çizgisi ve yatay konumu
ys = np.where(fin.sum(axis=1) > 0)[0]; xs = np.where(fin.sum(axis=0) > 0)[0]
tx = int(cx_t - (xs.min() + xs.max()) / 2); ty = int(base_y - ys.max())
out = k.astype(np.float32)
fcol = roi.astype(np.float32) * 0.85
# köpük: tabanda kırık, yumuşak iz
rng = np.random.default_rng(2)
nz = cv2.GaussianBlur(rng.random((H, W)).astype(np.float32), (0, 0), 3); nz = (nz - nz.min()) / (nz.max() - nz.min())
foam = np.zeros((H, W), np.float32)
cx = cx_t; fw = int((xs.max() - xs.min()) * 0.75)
cv2.ellipse(foam, (cx - 10, base_y + 4), (fw, 12), 0, 0, 360, 1, -1)
cv2.ellipse(foam, (cx + int(fw * .5), base_y + 14), (int(fw * .6), 7), 0, 0, 360, 0.8, -1)
foam = cv2.GaussianBlur(foam, (0, 0), 3)
foam = np.clip(foam * 1.4 + nz * 0.9 - 0.85, 0, 1); foam[:base_y - 3, :] = 0
foam = cv2.GaussianBlur(foam, (0, 0), 1.2)[..., None] * 0.35
out = out * (1 - foam) + np.array([238, 242, 242], np.float32) * foam
y0, x0 = max(0, ty), max(0, tx); y1, x1 = min(H, ty + h), min(W, tx + w)
a = m[y0 - ty:y1 - ty, x0 - tx:x1 - tx]
out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - a) + fcol[y0 - ty:y1 - ty, x0 - tx:x1 - tx] * a
cv2.imwrite(out_path, np.clip(out, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95])
print('tamam', out_path, 'fin kutusu', tx, ty, w, h)
