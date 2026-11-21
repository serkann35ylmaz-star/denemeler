#!/usr/bin/env python3
"""Yapay zekâ klibinin HAREKETİNİ orijinal HD görsele aktarır: net, pürüzsüz, HD karakter animasyonu.

LTX gibi modeller bu makinede düşük çözünürlükte (384 px) üretebiliyor; büyütünce bulanık oluyor.
Burada klipten yalnızca hareket (optik akış, OpenCV DIS) alınır ve 1080x1920 HD görsel bu akışla bükülür.
Sonuç: görselin kendi netliği + yapay zekânın hareketi. İnce, gerçekçi hareketlerde (el, kafa, kâğıt,
duman, su) en iyi sonucu verir; çok büyük hareketlerde (koşu, dönüş) kenarlarda çekme izi olabilir.

  python3 hd_hareket.py gorseller/x/01.jpg            # gorseller/x/01.mp4 klibini kullanır -> 01.hd.mp4
  python3 hd_hareket.py <hd görsel> <düşük çöz. klip> [çıktı.mp4] [--fps 30] [--genislik 1080]
Motor (build.js) .hd.mp4 varsa onu, yoksa .mp4'ü oynatır.
"""
import os, subprocess, sys

import cv2
import numpy as np


def opt(name, default):
    if name in sys.argv:
        i = sys.argv.index(name); v = sys.argv[i + 1]; del sys.argv[i:i + 2]; return v
    return default


FPS = float(opt('--fps', '30'))
OUTW = int(opt('--genislik', '1080'))
img_path = sys.argv[1]
base = os.path.splitext(img_path)[0]
clip = sys.argv[2] if len(sys.argv) > 2 else base + '.mp4'
out = sys.argv[3] if len(sys.argv) > 3 else base + '.hd.mp4'

# düşük çözünürlüklü klibin kareleri
cap = cv2.VideoCapture(clip)
src_fps = cap.get(cv2.CAP_PROP_FPS) or 24
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
cap.release()
if len(frames) < 2:
    sys.exit(f'klip okunamadı: {clip}')
lh, lw = frames[0].shape[:2]

# HD görselde klibin karşılığı olan bölge: klip, görselin ortasından aynı oranla kırpılarak üretildi
hd = cv2.imread(img_path)
H0, W0 = hd.shape[:2]
s = max(lw / W0, lh / H0)
cw, ch = lw / s, lh / s
x0, y0 = (W0 - cw) / 2, (H0 - ch) / 2
hd = hd[int(round(y0)):int(round(y0 + ch)), int(round(x0)):int(round(x0 + cw))]
outh = int(round(OUTW * lh / lw / 2) * 2)
hd = cv2.resize(hd, (OUTW, outh), interpolation=cv2.INTER_LANCZOS4)
k = OUTW / lw  # akışı HD ölçeğe taşıma katsayısı

# her kare için: o kareden ilk kareye akış (geri eşleme) -> HD görseli bük. Doğrudan ilk kareye göre
# hesaplandığı için hata birikmez (kayma olmaz).
dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
g0 = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
gx, gy = np.meshgrid(np.arange(OUTW, dtype=np.float32), np.arange(outh, dtype=np.float32))
flows = []
for f in frames:
    fl = dis.calc(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), g0, None)  # f'deki piksel -> ilk karedeki yeri
    flows.append(cv2.GaussianBlur(fl, (0, 0), 1.2))
# zamanda yumuşat: titremeyi al (3 karelik ortalama)
flows = [np.mean(flows[max(0, i - 1):i + 2], axis=0) for i in range(len(flows))]

# hedef fps'e ara kareler: akışı zamanda doğrusal karıştır (pürüzsüz hareket)
n_out = int(round(len(frames) / src_fps * FPS))
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{OUTW}x{outh}', '-r', str(FPS),
                       '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
for j in range(n_out):
    t = j / FPS * src_fps
    a = min(int(t), len(flows) - 1); b = min(a + 1, len(flows) - 1); w = t - a
    fl = flows[a] * (1 - w) + flows[b] * w
    fl = cv2.resize(fl, (OUTW, outh), interpolation=cv2.INTER_LINEAR) * k
    frame = cv2.remap(hd, gx + fl[..., 0], gy + fl[..., 1], cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    ff.stdin.write(frame.tobytes())
ff.stdin.close(); ff.wait()
print(f'HD hareket: {out} ({OUTW}x{outh}, {n_out} kare, {n_out / FPS:.1f} sn)')
