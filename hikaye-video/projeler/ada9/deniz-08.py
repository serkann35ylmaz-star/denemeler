#!/usr/bin/env python3
"""Bir sahnenin denizini 08'deki renge (ton~98, doygunluk~112, parlaklık~71) çeker. Yalnızca mavi-yeşil, doygun pikseller etkilenir
(köpekbalığı, kaya, gökyüzü, kanca, Kemal aynı kalır). Kullanım: python3 deniz-08.py <giris.jpg> <cikti.jpg> [guc=0.9]"""
import sys, cv2, numpy as np
im = cv2.imread(sys.argv[1]); guc = float(sys.argv[3]) if len(sys.argv) > 3 else 0.9
HT, ST, VT = 98.0, 112.0, 71.0
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV).astype(np.float32)
h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
sel = (h > 76) & (h < 112) & (s > 70) & (v > 28)
if sel.sum() < 5000: print('az deniz, atlandi'); cv2.imwrite(sys.argv[2], im); sys.exit()
mh, ms, mv = (float(np.median(x[sel])) for x in (h, s, v))
ks = float(np.clip(ST / ms, 0.5, 1.2)); kv = float(np.clip(VT / mv, 0.6, 1.2))
m = np.clip((h - 74) / 5, 0, 1) * np.clip((114 - h) / 5, 0, 1) * np.clip((s - 55) / 25, 0, 1) * np.clip((v - 20) / 15, 0, 1)
m = cv2.GaussianBlur(m, (0, 0), 1.4) * guc
h2 = h + (HT - mh) * 1.0
out = np.dstack([h * (1 - m) + np.clip(h2, 0, 179) * m, s * (1 - m) + np.clip(s * ks, 0, 255) * m, v * (1 - m) + np.clip(v * kv, 0, 255) * m])
cv2.imwrite(sys.argv[2], cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])
print('tamam: ton %.0f->%.0f doygunluk %.0f->%.0f parlaklik %.0f->%.0f' % (mh, HT, ms, ms * ks, mv, mv * kv))
