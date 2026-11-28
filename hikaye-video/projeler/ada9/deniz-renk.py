#!/usr/bin/env python3
"""09a: deniz rengini 07 ve 15 gibi koyu, karamsar turkuaza yaklaştırır (ton, doygunluk; parlaklık aynı).
Kullanım: python3 deniz-renk.py <giris.jpg> <cikti.jpg>"""
import sys, cv2, numpy as np
im = cv2.imread(sys.argv[1]); H, W = im.shape[:2]
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32)
h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
HOR = 545
yy = np.arange(H)[:, None].astype(np.float32)
m = np.clip((h - 88) / 4, 0, 1) * np.clip((108 - h) / 4, 0, 1)      # mavi-yeşil ton aralığı
m *= np.clip((s - 70) / 25, 0, 1) * np.clip((yy - HOR) / 20, 0, 1)   # doygun ve ufuk çizgisinin altında
m = cv2.GaussianBlur(m, (0, 0), 2.0)
h2 = h + (93 - h) * 0.7
s2 = np.clip(s * 1.3 + 12, 0, 255)
v2 = np.clip(v * 0.97 + 2, 0, 255)
hsv2 = np.dstack([h * (1 - m) + h2 * m, s * (1 - m) + s2 * m, v * (1 - m) + v2 * m])
out = cv2.cvtColor(np.clip(hsv2, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)
cv2.imwrite(sys.argv[2], out, [cv2.IMWRITE_JPEG_QUALITY, 95]); print('tamam')
