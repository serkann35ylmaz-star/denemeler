#!/usr/bin/env python3
"""15: kayalar arasından 190 satırlık bir bant çıkarır (Kemal ve çanta ölçeği bozulmaz), alt kısmı (köpük+su) uzatır;
böylece yüzgece daha çok su yeri açılır. Kullanım: python3 15-genislet.py <15kemal.jpg> <cikti.jpg>"""
import sys, cv2, numpy as np
src = cv2.imread(sys.argv[1]); H, W = src.shape[:2]
Y0, Y1, X = 1215, 1405, 36            # çıkarılan bant, geçiş yüksekliği
top = src[:Y0 + X].astype(np.float32); bot = src[Y1 - X:].astype(np.float32)
# kesişim: top'un son X satırı ile bot'un ilk X satırını karıştır
seam = np.stack([top[Y0 + i] * (1 - i / X) + bot[i] * (i / X) for i in range(X)])
joined = np.vstack([top[:Y0], seam, bot[X:]])
need = H - joined.shape[0]
lower = joined[Y0 + X:]
lower = cv2.resize(lower, (W, lower.shape[0] + need), interpolation=cv2.INTER_CUBIC)
out = np.vstack([joined[:Y0 + X], lower])
cv2.imwrite(sys.argv[2], np.clip(out, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95]); print('tamam', out.shape)
