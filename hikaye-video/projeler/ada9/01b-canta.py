#!/usr/bin/env python3
"""01b: sualtında asılı duran çantayı kaldırır (su temiz kalır). Köpekbalığı ve kanca değişmez.
Kullanım (repo kökünden): python3 hikaye-video/projeler/ada9/01b-canta.py <orijinal-01b.jpg> <cikti.jpg>
Adımlar: çantayı renk+GrabCut ile bul -> yerini sağdaki temiz sudan kopyayla doldur."""
import sys, cv2, numpy as np

src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src); H, W = im.shape[:2]
E = 270  # üstten eklenen yükseklik (su çizgisi aşağı iner, çanta için kuru yer açılır)

# 1) çantayı kes
rect = (205, 300, 280, 480)  # x, y, w, h
mask = np.zeros((H, W), np.uint8)
bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
cv2.grabCut(im, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
fg = ((mask == 1) | (mask == 3)).astype(np.uint8) * 255
n, lab, st, _ = cv2.connectedComponentsWithStats(fg)
big = 1 + int(np.argmax(st[1:, 4])); fg = (lab == big).astype(np.uint8) * 255
hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
water = ((hsv[..., 1] > 120) & (hsv[..., 2] > 125)).astype(np.uint8) * 255   # parlak doygun turkuaz su
fg &= cv2.bitwise_not(water)
fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (23, 23)))
n, lab, st, _ = cv2.connectedComponentsWithStats(fg)
big = 1 + int(np.argmax(st[1:, 4])); fg = (lab == big).astype(np.uint8) * 255
ff = fg.copy(); cv2.floodFill(ff, np.zeros((H + 2, W + 2), np.uint8), (0, 0), 255)   # delikleri doldur
fg = fg | cv2.bitwise_not(ff)
fg = cv2.dilate(fg, np.ones((3, 3), np.uint8))
ys, xs = np.where(fg > 0); bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max(), ys.max()
sprite = np.dstack([im, cv2.GaussianBlur(fg, (0, 0), 1.3)])[by0:by1 + 1, bx0:bx1 + 1].astype(np.float32)

# 2) eski yeri sudan doldur (sağdaki temiz sudan kopya)
m = cv2.dilate(fg, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
srcim = np.roll(im, -300, axis=1)
yy, xx = np.where(m > 0)
c = ((xx.min() + xx.max()) // 2, (yy.min() + yy.max()) // 2)
clean = cv2.seamlessClone(srcim, im, m, c, cv2.NORMAL_CLONE)

# 3) çanta tamamen kaldırıldı (01a zaten çantayı su üstünde, kayada gösteriyor); köpekbalığı ve kanca aynen kalır
cv2.imwrite(out, clean, [cv2.IMWRITE_JPEG_QUALITY, 95])
print('tamam', out)
