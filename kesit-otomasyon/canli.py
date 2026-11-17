#!/usr/bin/env python3
"""Canlı yayından tek bir kaliteli kesit: üstte yayın, altta yayıncının yüzü (9:16), Türkçe altyazı, kapak görseli.

  python3 canli.py <kick.com/kanal | twitch.tv/kanal | kayıt.ts> --ad Westcol [--sure 180] [--kesit 35]
                   [--kanca "ÜST SATIR|SARI KELİME"]   (kapak metni; | sonrası sarı)

1. Kayıt: canlı yayından --sure saniye kaydeder (dosya verilirse onu kullanır).
2. An seçimi: ses enerjisi + enerji dalgalanması + konuşma yoğunluğu en yüksek pencere; cümle sınırına oturtulur.
3. Düzen: üst panel yayının tamamı (genişliğe sığdırılır, boşluk bulanık doldurulur); alt panel yayıncının yüzü.
   Yüz OpenCV ile bulunur. Yüz küçük ve köşedeyse (oyun yayınındaki kamera kutusu) o kutu büyütülür;
   büyükse (IRL) yüze yakın plan alınır.
4. Altyazı iki panelin birleştiği çizgide, kelime kelime sarı vurgu; görüntünün önemli yerini kapatmaz.
5. Kapak: kararmış arka plan, üstte platform/yayıncı etiketi, ortada büyük başlık (anahtar kelime sarı), altta yayıncının yüzü.
"""
import json, os, re, subprocess, sys, time

sys.argv_backup = list(sys.argv)
import kesit  # aynı klasördeki altyapı: indirme, yazıya dökme, çeviri, küfür süzgeci
from kesit import opt, log, OUT

AD = opt('--ad', 'Yayıncı')
SURE = int(opt('--sure', '180'))
KESIT = float(opt('--kesit', '35'))
KANCA = opt('--kanca')
BASLIK = opt('--baslik')  # YouTube başlığı; verilmezse kapak metninden
W, H, SEAM = 1080, 1920, 960
src = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
day = time.strftime('%Y-%m-%d')
work = f'{OUT}/canli/{day}'
os.makedirs(work, exist_ok=True)
platform = 'twitch' if 'twitch.tv' in src else 'kick'
kanal = (re.search(r'(?:twitch\.tv|kick\.com)/([^/?]+)', src) or [None, AD.lower()])[1]
slug = re.sub(r'[^a-z0-9]+', '-', AD.lower()).strip('-')
stamp = time.strftime('%H%M')


def run(*a, **k):
    return subprocess.run(list(a), check=True, **k)


# ---------- 1) kayıt ----------
if os.path.exists(src):
    rec = src
else:
    url = subprocess.run(['yt-dlp', '-q', '-g', '-f', 'best[height<=1080]/best', src], capture_output=True, text=True, check=True).stdout.split()[0]
    rec = f'{work}/{slug}-{stamp}-kayit.ts'
    log(f'kaydediliyor: {SURE} sn')
    run('ffmpeg', '-v', 'error', '-y', '-i', url, '-t', str(SURE), '-c', 'copy', rec)

# ---------- 2) an seçimi ----------
import numpy as np
audio = kesit.pcm16(rec)
hop = 1600  # 0.1 sn
rms = np.sqrt(np.mean(audio[:len(audio) // hop * hop].reshape(-1, hop) ** 2, axis=1)) + 1e-6
db = 20 * np.log10(rms)
from faster_whisper import WhisperModel
asr = WhisperModel('small', device='cpu', compute_type='int8')
kesit._asr = asr  # aynı modeli altyazıda da kullan (iki kopya belleği taşırıyordu)
segs = list(asr.transcribe(audio, vad_filter=True)[0])
del audio  # uzun kaydın ham sesi artık gerekmiyor
speech = np.zeros(len(db))
for s in segs:
    speech[int(s.start * 10):int(s.end * 10)] = 1
win = int(KESIT * 10)
best, bi = -1e9, 0
for i in range(0, max(1, len(db) - win), 5):
    w = db[i:i + win]
    score = (w.mean() - db.mean()) + 0.8 * w.std() + 6 * speech[i:i + win].mean() + 2 * (np.percentile(w, 95) - np.percentile(db, 95))
    if score > best:
        best, bi = score, i
start, end = bi / 10, (bi + win) / 10
# cümle sınırına oturt: pencerenin içinde başlayan ilk cümle, içinde biten son cümle (en fazla 45 sn)
starts = [s.start for s in segs if s.start >= start - 3]
ends = [s.end for s in segs if s.end <= end + 4]
if starts:
    start = max(0, min(starts, key=lambda x: abs(x - start)) - .2)
if ends:
    end = min(max(ends, key=lambda x: -abs(x - end)) + .4, start + 45)
log(f'seçilen an: {start:.1f}-{end:.1f} sn (puan {best:.1f})')
clip = f'{work}/{slug}-{stamp}-ham.mp4'
run('ffmpeg', '-v', 'error', '-y', '-ss', f'{start:.2f}', '-i', rec, '-t', f'{end - start:.2f}', '-c:v', 'libx264', '-preset', 'veryfast',
    '-crf', '18', '-c:a', 'aac', clip)

# ---------- 3) yüz bul + takip ----------
import cv2
cap = cv2.VideoCapture(clip)
sw, sh = int(cap.get(3)), int(cap.get(4))
fps = cap.get(5) or 30
n = int(cap.get(7))
cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
track, best_frame, best_score = [], None, 0  # her yarım saniyede seçilen yüz: (zaman, x, y, w, h)
for fi in range(0, n, max(1, int(fps / 2))):
    cap.set(1, fi)
    ok, fr = cap.read()
    if not ok:
        break
    faces = cascade.detectMultiScale(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY), 1.1, 6, minSize=(sh // 20, sh // 20))
    # IRL'de kamera yayıncıyı ortada tutar: yalnız orta bölgedeki yüzler; köşedeki küçük yüz = oyun yayınının kamera kutusu
    sc = lambda f: f[2] * f[3] * np.exp(-(((f[0] + f[2] / 2) - sw / 2) / (.18 * sw)) ** 2)
    mid = [f for f in faces if sw * .25 < f[0] + f[2] / 2 < sw * .75]
    corner = [f for f in faces if f[3] < sh * .14 and not (sw * .3 < f[0] + f[2] / 2 < sw * .7)]
    if mid and track:
        px, py = track[-1][1], track[-1][2]
        near = [f for f in mid if abs(f[0] + f[2] / 2 - px) < f[2] * 1.5 and abs(f[1] + f[3] / 2 - py) < f[3] * 1.5]
        mid = near or mid
    pick = max(mid, key=sc) if mid else (max(corner, key=lambda f: f[2] * f[3]) if corner else None)
    if pick is not None:
        x, y, w, h = pick
        track.append((fi / fps, x + w / 2, y + h / 2, w, h))
        if sc(pick) > best_score:
            best_score, best_frame = sc(pick), fr.copy()
    else:  # yüz yok (yayıncı aşağı bakıyor vb.): son bilinen konumda kal, hiç yoksa kadrajın ortası
        last = track[-1][1:] if track else (sw / 2, sh * .45, sh * .18, sh * .18)
        track.append((fi / fps, *last))
cap.release()
if not track:
    track = [(0, sw / 2, sh * .4, sh * .25, sh * .25)]
T = np.array(track)
fh_med = float(np.median(T[:, 4]))
cam_mode = fh_med < sh * .14 and (np.median(T[:, 1]) < sw * .3 or np.median(T[:, 1]) > sw * .7)  # oyun yayınındaki kamera kutusu
ch = min(sh, fh_med * (2.6 if cam_mode else 3.4))
cw = ch * W / SEAM
if cw > sw:
    cw, ch = sw, sw * SEAM / W
# yumuşat: 3 sn'lik hareketli ortanca + ortalama, sonra kırpma sol-üst köşesi
k = 6
xs = np.array([np.median(T[max(0, i - k):i + k + 1, 1]) for i in range(len(T))])
ys = np.array([np.median(T[max(0, i - k):i + k + 1, 2]) for i in range(len(T))])
xs = np.convolve(np.pad(xs, k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), 'valid')
ys = np.convolve(np.pad(ys, k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), 'valid')
X = np.clip(xs - cw / 2, 0, sw - cw); Y = np.clip(ys - ch * .42, 0, sh - ch)
if cam_mode:  # kamera kutusu sabit durur
    X[:] = np.median(X); Y[:] = np.median(Y)
ts = T[:, 0]
keep = [0]
for i in range(1, len(ts)):  # saniyede ~1 düğüm
    if ts[i] - ts[keep[-1]] >= 1.0:
        keep.append(i)


def lerp_expr(vals):
    """ffmpeg ifadesi: zamana göre parça parça doğrusal kırpma konumu (kamera yumuşakça takip eder)."""
    pts = [(ts[i], vals[i]) for i in keep]
    e = f'{pts[-1][1]:.0f}'
    for (t0, v0), (t1, v1) in reversed(list(zip(pts, pts[1:]))):
        e = f'if(lt(t,{t1:.2f}),{v0:.1f}+({v1 - v0:.1f})*(t-{t0:.2f})/{max(t1 - t0, .01):.2f},{e})'
    return e


cx_expr, cy_expr = lerp_expr(X), lerp_expr(Y)
cx, cy = float(np.median(X)), float(np.median(Y))
log(f'yüz: {"kamera kutusu" if cam_mode else "takipli yakın plan"}, {len(T)} örnek, kırpma {cw:.0f}x{ch:.0f}')

# ---------- 4) altyazı ----------
lang, words = kesit.transcribe_tr(clip)
words = [(kesit.KUFUR.sub(lambda m: m.group(0)[0] + '*' * (len(m.group(0)) - 1), w), a, b) for w, a, b in words]
log(f'dil: {lang}, {len(words)} Türkçe kelime')


def t(x):
    return f'{int(x // 3600)}:{int(x % 3600 // 60):02d}:{x % 60:05.2f}'


ev = []
cs = kesit.chunks(words)
for ci, chk in enumerate(cs):
    stop = min(cs[ci + 1][0][1] if ci + 1 < len(cs) else chk[-1][2] + .4, chk[-1][2] + .8)
    for wi, (w, a, b) in enumerate(chk):
        s = chk[0][1] if wi == 0 else a
        e = chk[wi + 1][1] if wi + 1 < len(chk) else stop
        if e > s:
            txt = ' '.join(('{\\c&H00D7FF&}' + kesit.esc(x[0]) + '{\\c&HFFFFFF&}') if j == wi else kesit.esc(x[0]) for j, x in enumerate(chk))
            ev.append(f'Dialogue: 1,{t(s)},{t(e)},Alt,,0,0,0,,{{\\pos(540,{SEAM})}}{txt}')
plat_txt = f"{platform}.{'tv' if platform == 'twitch' else 'com'}/{kanal}"
ev.append(f'Dialogue: 0,{t(0)},{t(999)},Kredi,,0,0,0,,{{\\pos(540,52)}}{kesit.esc(AD)} • {plat_txt}')
ass = f'{work}/{slug}-{stamp}.ass'
open(ass, 'w', encoding='utf-8').write(f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Alt,Poppins Black,62,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,5,2,5,60,60,0,1
Style: Kredi,Poppins ExtraBold,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H8C000000,0,0,0,0,100,100,0,0,3,10,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + '\n'.join(ev) + '\n')

# ---------- 5) 9:16 kurgu ----------
out = f'{OUT}/videolar/{day}/{slug}-canli-{stamp}.mp4'
os.makedirs(os.path.dirname(out), exist_ok=True)
top_h = round(W * sh / sw) // 2 * 2
vf = (f"[0:v]split=3[a][b][c];"
      f"[a]scale={W}:{SEAM}:force_original_aspect_ratio=increase,crop={W}:{SEAM},boxblur=24:2,eq=brightness=-0.2[tb];"
      f"[b]scale={W}:{top_h}[tf];[tb][tf]overlay=0:({SEAM}-h)/2[top];"
      f"[c]crop={cw:.0f}:{ch:.0f}:'{cx_expr}':'{cy_expr}',scale={W}:{H - SEAM}[bot];"
      f"[top][bot]vstack,ass={ass}:fontsdir=fonts[v]")
run('ffmpeg', '-v', 'error', '-y', '-i', clip, '-filter_complex', vf, '-map', '[v]', '-map', '0:a?', '-r', '30', '-c:v', 'libx264',
    '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out)
log(f'video: {out}')

# ---------- 6) kapak ----------
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance
fr = best_frame if best_frame is not None else cv2.VideoCapture(clip).read()[1]
im = Image.fromarray(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB))
bg = im.resize((round(im.width * H / im.height), H)).filter(ImageFilter.GaussianBlur(6))
bg = ImageEnhance.Brightness(bg.crop(((bg.width - W) // 2, 0, (bg.width - W) // 2 + W, H))).enhance(.45)
bf = max(track, key=lambda r: r[3] * r[4] * np.exp(-((r[1] - sw / 2) / (.18 * sw)) ** 2))
fcx, fcy = min(max(bf[1] - cw / 2, 0), sw - cw), min(max(bf[2] - ch * .42, 0), sh - ch)
face = im.crop((round(fcx), round(fcy), round(fcx + cw), round(fcy + ch))).resize((W, round(W * ch / cw)))
mask = Image.linear_gradient('L').resize((W, face.height))  # yüz görselinin üst kenarı yumuşak geçsin
bg.paste(face, (0, H - face.height), mask)
d = ImageDraw.Draw(bg)
anton = lambda s: ImageFont.truetype('fonts/Anton-Regular.ttf', s)
label = f'{platform.upper()} • {AD.upper()}'
d.text((W / 2, 150), label, font=anton(64), fill='white', anchor='mm', stroke_width=3, stroke_fill='black')
top, key = (KANCA.split('|', 1) + [''])[:2] if KANCA else (AD.upper(), '')
lines = [(x, 'white') for x in top.split('\\n') if x] + [(x, '#FFD43B') for x in key.split('\\n') if x]
y = 330
for txt, col in lines:
    f = anton(118)
    while d.textlength(txt, font=f) > W - 90:
        f = anton(f.size - 6)
    d.text((W / 2, y), txt, font=f, fill=col, anchor='mt', stroke_width=7, stroke_fill='black')
    y += f.size + 18
cover = out[:-4] + '-kapak.jpg'
bg.convert('RGB').save(cover, quality=92)
log(f'kapak: {cover}')

# ---------- 7) başlık / açıklama ----------
text = ' '.join(w[0] for w in words)
open(out[:-4] + '.md', 'w', encoding='utf-8').write(f"""# {AD} · canlı yayın kesiti ({day} {stamp[:2]}:{stamp[2:]})

**Başlık önerisi:** {BASLIK or (AD + ': ' + (KANCA or '').replace('|', ' ').strip().capitalize())}
**Açıklama:**
{AD} canlı yayınından bir an. Türkçe altyazılı.
Kaynak: {platform.capitalize()} · {plat_txt}
#shorts #{re.sub(r'[^A-Za-z0-9]', '', AD)} #{platform} #yayın #keşfet

Kaynak dil: {lang} · Kesit: {start:.0f}-{end:.0f}. saniyeler · Kayıt: {os.path.basename(rec)}

Altyazı metni: {text}
""")
os.remove(clip); os.remove(ass)
print(json.dumps({'video': out, 'kapak': cover, 'metin': text, 'dil': lang}, ensure_ascii=False))
