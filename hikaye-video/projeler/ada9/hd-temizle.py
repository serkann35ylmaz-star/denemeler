#!/usr/bin/env python3
"""Pikselli/bloklu tek bir görseli temizler: önce hafifçe küçültür (blokları eritir), Real-ESRGAN anime modeliyle 4 kat büyütür
(çizgiler netleşir, gürültü gider), 1080x1920'ye indirir. Karakter ve kompozisyon değişmez.
Kullanım: ~/.venvs/video/bin/python hd-temizle.py <giris.jpg> <cikti.jpg> [on_olcek=0.62]"""
import os, sys, cv2, numpy as np, torch, spandrel
torch.set_num_threads(os.cpu_count() or 4)
model = spandrel.ModelLoader().load_from_file(os.path.expanduser('~/.cache/esrgan/RealESRGAN_x4plus_anime_6B.pth')).eval()
im = cv2.imread(sys.argv[1]); H, W = im.shape[:2]; on = float(sys.argv[3]) if len(sys.argv) > 3 else 0.62
small = cv2.resize(im, None, fx=on, fy=on, interpolation=cv2.INTER_AREA)
small = cv2.bilateralFilter(small, 5, 28, 5)
h, w = small.shape[:2]; T, P = 192, 16
x = torch.from_numpy(cv2.cvtColor(small, cv2.COLOR_BGR2RGB)).permute(2, 0, 1).float().div(255)[None]
out = torch.zeros(1, 3, h * 4, w * 4)
with torch.no_grad():
    for y0 in range(0, h, T):
        for x0 in range(0, w, T):
            ya, xa = max(0, y0 - P), max(0, x0 - P); yb, xb = min(h, y0 + T + P), min(w, x0 + T + P)
            o = model(x[:, :, ya:yb, xa:xb])
            cy, cx = (y0 - ya) * 4, (x0 - xa) * 4; hh, ww = min(T, h - y0) * 4, min(T, w - x0) * 4
            out[:, :, y0 * 4:y0 * 4 + hh, x0 * 4:x0 * 4 + ww] = o[:, :, cy:cy + hh, cx:cx + ww]
res = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255).astype(np.uint8)
res = cv2.resize(cv2.cvtColor(res, cv2.COLOR_RGB2BGR), (W, H), interpolation=cv2.INTER_AREA)
cv2.imwrite(sys.argv[2], res, [cv2.IMWRITE_JPEG_QUALITY, 95]); print('tamam', sys.argv[2])
