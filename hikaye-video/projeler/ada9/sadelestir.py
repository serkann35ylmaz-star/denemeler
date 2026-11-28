#!/usr/bin/env python3
"""ESRGAN çıktısını (hd-temizle.py) düz boyalı çizgi roman görünümüne getirir: mean-shift düzleştirme + koyu çizgileri geri ver.
Kullanım: python3 sadelestir.py <hd.jpg> <cikti.jpg>"""
import sys, cv2, numpy as np
b = cv2.imread(sys.argv[1])
ms = cv2.pyrMeanShiftFiltering(b, sp=9, sr=20, maxLevel=2)
g = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
dark = cv2.GaussianBlur((g < 45).astype(np.float32), (0, 0), 0.8)[..., None]
out = ms.astype(np.float32) * (1 - dark * 0.6) + b.astype(np.float32) * dark * 0.6
cv2.imwrite(sys.argv[2], np.clip(out, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95]); print('tamam')
