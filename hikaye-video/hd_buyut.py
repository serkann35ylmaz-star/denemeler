#!/usr/bin/env python3
"""Yapay zekâ klibini HD'ye çıkarır: Real-ESRGAN (anime/çizim modeli, BSD-3) ile her kare 4 kat büyütülür,
1080 genişliğe indirilir. Çizgiler, gözler ve dokular netleşir; bulanıklık gider.

  ~/.venvs/video/bin/python hd_buyut.py gorseller/x/01.mp4      -> gorseller/x/01.hd.mp4
build.js .hd.mp4 varsa onu kullanır. CPU'da kare başına ~15-20 sn (2 sn'lik klip ~15 dk).
Model ilk çalıştırmada indirilir: ~/.cache/esrgan/RealESRGAN_x4plus_anime_6B.pth
"""
import os, subprocess, sys, time, urllib.request

import cv2
import numpy as np
import torch
import spandrel

MODEL = os.path.expanduser('~/.cache/esrgan/RealESRGAN_x4plus_anime_6B.pth')
URL = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth'
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(src)[0] + '.hd.mp4'
OUTW = 1080
if not os.path.exists(MODEL):
    os.makedirs(os.path.dirname(MODEL), exist_ok=True)
    urllib.request.urlretrieve(URL, MODEL)
torch.set_num_threads(os.cpu_count() or 4)
model = spandrel.ModelLoader().load_from_file(MODEL).eval()

cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS) or 24
n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w, h = int(cap.get(3)), int(cap.get(4))
outh = int(round(OUTW * h / w / 2) * 2)
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{OUTW}x{outh}', '-r', str(fps),
                       '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
t0 = time.time()
for i in range(n):
    ok, f = cap.read()
    if not ok:
        break
    x = torch.from_numpy(f[:, :, ::-1].copy()).permute(2, 0, 1).float().div(255).unsqueeze(0)
    with torch.inference_mode():
        y = model(x)[0].permute(1, 2, 0).clamp(0, 1).numpy()
    big = (y * 255).astype(np.uint8)[:, :, ::-1]
    ff.stdin.write(cv2.resize(big, (OUTW, outh), interpolation=cv2.INTER_AREA).tobytes())
    if i % 10 == 0:
        print(f'  {i + 1}/{n} kare, {time.time() - t0:.0f} sn', flush=True)
ff.stdin.close(); ff.wait()
print(f'HD: {out} ({OUTW}x{outh}, {n} kare, {time.time() - t0:.0f} sn)')
