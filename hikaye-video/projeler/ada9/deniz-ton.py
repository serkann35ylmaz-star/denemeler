#!/usr/bin/env python3
"""Deniz tonunu (yeşil-turkuaz) belirli bir tona çeker; köpekbalığı/kanca/ışın gibi düşük doygunluklu ya da sarı alanlara dokunmaz.
Kullanım: python3 deniz-ton.py <giris.jpg> <cikti.jpg> <hedef_ton=92> [guc=1.0]"""
import sys, cv2, numpy as np
im = cv2.imread(sys.argv[1]); hedef = float(sys.argv[3]); guc = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32)
h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
sulu = h[(h > 70) & (h < 110) & (s > 90) & (v > 30)]
med = float(np.median(sulu)); d = (hedef - med) * guc
m = np.clip((h - 68) / 6, 0, 1) * np.clip((112 - h) / 6, 0, 1) * np.clip((s - 70) / 30, 0, 1)
m = cv2.GaussianBlur(m, (0, 0), 1.5)
hsv[..., 0] = np.clip(h + d * m, 0, 179)
cv2.imwrite(sys.argv[2], cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])
print('tamam: medyan ton %.1f -> %.1f' % (med, med + d))
