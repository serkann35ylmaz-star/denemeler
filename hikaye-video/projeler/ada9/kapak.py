#!/usr/bin/env python3
"""1. Bölüm kapağı (1080x1920): 09b görseli + seri/bölüm adı. Yazılar platform arayüzünün (üst ~%12, alt ~%20) dışında, ortada.
Kullanım: python3 kapak.py <gorsel.jpg> <cikti.jpg>"""
import sys, cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont
W, H = 1080, 1920
im = cv2.resize(cv2.imread(sys.argv[1]), (W, H), interpolation=cv2.INTER_AREA).astype(np.float32)
# alttan ve üstten hafif karartma: yazılar okunsun
yy = np.arange(H, dtype=np.float32)[:, None, None] / H
dark = np.clip((yy - 0.52) / 0.30, 0, 1) * 0.62 + np.clip((0.22 - yy) / 0.22, 0, 1) * 0.35
im = im * (1 - dark)
img = Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)[..., ::-1]); d = ImageDraw.Draw(img)
A = lambda s: ImageFont.truetype('fonts/Anton-Regular.ttf', s)
P = lambda s: ImageFont.truetype('fonts/Poppins-ExtraBold.ttf', s)
OR = (255, 154, 46)
def ctext(txt, y, font, fill, stroke=0, sc=(0, 0, 0)):
    w = d.textlength(txt, font=font); d.text(((W - w) / 2, y), txt, font=font, fill=fill, stroke_width=stroke, stroke_fill=sc)
ctext('ADA 9', 1010, A(120), (255, 255, 255), 6)
ctext('DÖRT DAKİKA', 1140, A(190), OR, 8)
d.rectangle([W / 2 - 210, 1380, W / 2 + 210, 1388], fill=OR)
ctext('1. BÖLÜM', 1412, P(54), (235, 235, 240), 3)
ctext('SIÇRATMA.', 1500, A(76), (255, 255, 255), 4)
img.save(sys.argv[2], quality=95); print('tamam')
