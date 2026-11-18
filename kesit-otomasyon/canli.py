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
KATEGORI = opt('--kategori', '')
TAMAMI = '--tamami' in sys.argv  # an zaten seçili (ör. sohbet.py): kaydın tamamını kullan
if TAMAMI:
    sys.argv.remove('--tamami')  # kayıt dosyası verilince yayın kategorisi (ör. "Just Chatting", "Knight Online")
KANCA = opt('--kanca')
BASLIK = opt('--baslik')  # YouTube başlığı; verilmezse kapak metninden
W, H, SEAM = 1080, 1920, 960
CAM_H = 640  # bölünmüş düzen: üstte kamera (~1/3), altta oyun/ekran (~2/3)
src = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
if src.startswith('en-cok-izlenen'):  # "en-cok-izlenen" ya da "en-cok-izlenen:gta" -> Kick'te şu an en çok izlenen yayın
    flt = src.split(':', 1)[1] if ':' in src else None
    top = kesit.kick_canli(r'grand theft auto vi\b|\bgta ?(6|vi)\b' if flt == 'gta' else flt, None, 1)
    if not top:
        sys.exit("Kick canlı listesi alınamadı (KICK_CLIENT_ID / KICK_CLIENT_SECRET tanımlı mı?)")
    src, AD = f"https://kick.com/{top[0]['kanal']}", top[0]['ad']
    log(f"en çok izlenen: {AD} ({top[0]['izleyici']:,} izleyici, {top[0]['kategori']})")
day = time.strftime('%Y-%m-%d')
work = f'{OUT}/canli/{day}'
os.makedirs(work, exist_ok=True)
platform = 'twitch' if 'twitch.tv' in src else 'kick'
kanal = (re.search(r'(?:twitch\.tv|kick\.com)/([^/?]+)', src) or [None, AD.lower()])[1]
slug = re.sub(r'[^a-z0-9]+', '-', AD.lower()).strip('-')
stamp = opt('--isim') or time.strftime('%H%M')  # aynı dakikada birden çok kesit için benzersiz ad


def run(*a, **k):
    return subprocess.run(list(a), check=True, **k)


# ---------- 1) kayıt ----------
if os.path.exists(src):
    rec = src
else:
    import yt_dlp
    info = yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True, 'format': 'best[height<=1080]/best'}).extract_info(src, download=False)
    url = info['url']
    KATEGORI = KATEGORI or ', '.join(info.get('categories') or [])
    log(f'kategori: {KATEGORI or "bilinmiyor"}')
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
if TAMAMI:
    start, end = 0.0, len(db) / 10
# cümle sınırına oturt: pencerenin içinde başlayan ilk cümle, içinde biten son cümle (en fazla 45 sn)
starts = [s.start for s in segs if s.start >= start - 3]
ends = [s.end for s in segs if s.end <= end + 4]
if starts and not TAMAMI:
    start = max(0, min(starts, key=lambda x: abs(x - start)) - .2)
if ends and not TAMAMI:
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
GTA = bool(re.search(r'grand theft auto vi\b|gta ?(6|vi)\b', KATEGORI, re.I))
IRL = bool(re.search(r'just chatting|irl|talk|sohbet|music|müzik|asmr|pools|travel|outdoor|special events|cooking', KATEGORI, re.I))
OYUN = bool(KATEGORI) and not IRL


def corner_faces(fr):
    """Oyun/uygulama yayınında kamera kutusu köşededir ve içindeki yüz küçüktür: köşeleri 2 kat büyütüp ara."""
    out = []
    for x0, y0 in [(0, 0), (.6, 0), (0, .55), (.6, .55)]:
        X0, Y0, ww, hh = int(x0 * sw), int(y0 * sh), int(.4 * sw), int(.45 * sh)
        reg = cv2.resize(fr[Y0:Y0 + hh, X0:X0 + ww], None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
        for x, y, w, h in cascade.detectMultiScale(cv2.cvtColor(reg, cv2.COLOR_BGR2GRAY), 1.08, 5, minSize=(60, 60)):
            out.append((X0 + x / 2, Y0 + y / 2, w / 2, h / 2))
    return out


samples = []  # her yarım saniyede tüm yüzler: (zaman, [(x, y, w, h)...], kare)
for fi in range(0, n, max(1, int(fps / 2))):
    cap.set(1, fi)
    ok, fr = cap.read()
    if not ok:
        break
    faces = cascade.detectMultiScale(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY), 1.1, 6, minSize=(sh // 22, sh // 22))
    fs = [tuple(map(float, f)) for f in faces]
    if not IRL:
        fs += corner_faces(fr)
    samples.append((fi / fps, fs, fr if len(samples) % 4 == 0 else None))
cap.release()

# Düzen kararı: kesit boyunca kenarda küçük ve yerinden oynamayan bir yüz varsa = ekranda oyun/uygulama + kamera kutusu.
side = [(t, f) for t, fs, _ in samples for f in fs if f[3] < sh * .2 and not (sw * .3 < f[0] + f[2] / 2 < sw * .7)]
cam_mode, cam_box = False, None
# ortada büyük bir yüz sık görünüyorsa yayın kamera ağırlıklı (bekleme ekranı, sohbet): tek parça takipli
big_mid = sum(1 for _, fs, _ in samples if any(f[3] > sh * .14 and sw * .25 < f[0] + f[2] / 2 < sw * .75 for f in fs))
CAM_DOMINANT = big_mid >= .3 * len(samples)
if side and not IRL:  # sohbet/IRL kategorisinde kenardaki yüz başka bir kişidir, kamera kutusu değil
    groups = []
    for t_, f in side:
        for g in groups:
            if abs(g[0][0] - f[0]) < f[2] * .6 and abs(g[0][1] - f[1]) < f[3] * .6:
                g.append(f); break
        else:
            groups.append([f])
    g = max(groups, key=len)
    if len(g) >= .35 * len(samples) and np.std([f[0] for f in g]) < sw * .02:
        box = [float(np.median([f[k] for f in g])) for k in range(4)]
        # gerçek kamera kutusundaki yüz kıpırdar; poster/figür/oyuncak yüzü kıpırdamaz
        x, y, w, h = [int(v) for v in box]
        crops = [cv2.cvtColor(fr[y:y + h, x:x + w], cv2.COLOR_BGR2GRAY).astype(np.float32) for _, _, fr in samples if fr is not None]
        motion = np.mean([np.abs(a_ - b_).mean() for a_, b_ in zip(crops, crops[1:])]) if len(crops) > 1 else 0
        log(f'kamera kutusu adayı: hareket {motion:.1f}, ortada büyük yüz {big_mid}/{len(samples)} örnek')
        if motion > 2.5 and not CAM_DOMINANT:
            cam_mode, cam_box = True, box

track, best_frame, best_score = [], None, 0  # (zaman, merkez x, merkez y, w, h)
sc = lambda f: f[2] * f[3] * np.exp(-(((f[0] + f[2] / 2) - sw / 2) / (.18 * sw)) ** 2)
SCREEN_ONLY = OYUN and not cam_mode and not CAM_DOMINANT  # oyun/uygulama var ama kamera kutusu yok: ekran tek parça
for t_, fs, fr in samples:
    if cam_mode or SCREEN_ONLY:
        if best_frame is None and fr is not None:
            best_frame = fr
    if SCREEN_ONLY:
        track.append((t_, sw / 2, sh / 2, sh * .2, sh * .2)); continue
    if cam_mode:
        x, y, w, h = cam_box
        track.append((t_, x + w / 2, y + h / 2, w, h)); continue
    # yalnız kamera: yayıncı genelde kadrajın ortasında ve önde; önceki yüze yakın olanı tercih et (kişiler arası zıplamasın)
    mid = [f for f in fs if sw * .2 < f[0] + f[2] / 2 < sw * .8]
    if mid and track:
        px, py = track[-1][1], track[-1][2]
        mid = [f for f in mid if abs(f[0] + f[2] / 2 - px) < f[2] * 1.5 and abs(f[1] + f[3] / 2 - py) < f[3] * 1.5] or mid
    if mid:
        x, y, w, h = max(mid, key=sc)
        track.append((t_, x + w / 2, y + h / 2, w, h))
        if fr is not None and sc((x, y, w, h)) > best_score:
            best_score, best_frame = sc((x, y, w, h)), fr
    else:  # yüz görünmüyor: son bilinen konumda kal
        track.append((t_, *(track[-1][1:] if track else (sw / 2, sh * .45, sh * .18, sh * .18))))
if best_frame is None:
    best_frame = next((fr for _, _, fr in samples if fr is not None), None)
T = np.array(track)
fh_med = float(np.median(T[:, 4]))
if cam_mode:  # alt panel: kamera kutusu, sabit
    ch = min(sh, fh_med * 2.6); cw = ch * W / CAM_H
else:         # tek parça: tam yükseklikte 9:16 dilim, yayıncıyı yatayda takip eder
    ch = sh; cw = sh * W / H
if cw > sw:
    cw, ch = sw, sw * (CAM_H if cam_mode else H) / W
k = 6  # yumuşat: 3 sn'lik hareketli ortanca + ortalama
xs = np.array([np.median(T[max(0, i - k):i + k + 1, 1]) for i in range(len(T))])
ys = np.array([np.median(T[max(0, i - k):i + k + 1, 2]) for i in range(len(T))])
xs = np.convolve(np.pad(xs, k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), 'valid')
ys = np.convolve(np.pad(ys, k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), 'valid')
X = np.clip(xs - cw / 2, 0, sw - cw); Y = np.clip(ys - ch * .42, 0, sh - ch)
if cam_mode:
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
MODE = 'kamera üstte + ekran altta' if cam_mode else ('yalnız ekran (bulanık dolgu)' if SCREEN_ONLY else 'tek kamera, tam dikey (takipli)')
log(f'düzen: {MODE}, {len(T)} örnek, kırpma {cw:.0f}x{ch:.0f}')

# ---------- 4) altyazı ----------
SUB_Y = CAM_H if cam_mode else (1380 if SCREEN_ONLY else 1400)  # bölünmüşte birleşim çizgisi, tek parçada alt üçte bir (yüzün altı)
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
            ev.append(f'Dialogue: 1,{t(s)},{t(e)},Alt,,0,0,0,,{{\\pos(540,{SUB_Y})}}{txt}')
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
if cam_mode:  # üstte yayıncının kamerası, altta ekranın ortası (yanlardan kırpılmış, alanı doldurur)
    vf = (f"[0:v]split[a][b];"
          f"[a]crop={cw:.0f}:{ch:.0f}:{cx:.0f}:{cy:.0f},scale={W}:{CAM_H}[top];"
          f"[b]scale=-2:{H - CAM_H},crop={W}:{H - CAM_H}[bot];"
          f"[top][bot]vstack,ass={ass}:fontsdir=fonts[v]")
elif SCREEN_ONLY:
    fw2 = round(W * 1.3) // 2 * 2  # ekranı biraz yakınlaştır, kenarları bulanık doldur
    vf = (f"[0:v]split[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=28:2,eq=brightness=-0.18[bg];"
          f"[b]scale={fw2}:-2,crop={W}:ih[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2-60,ass={ass}:fontsdir=fonts[v]")
else:
    vf = f"[0:v]crop={cw:.0f}:{ch:.0f}:'{cx_expr}':{cy:.0f},scale={W}:{H},ass={ass}:fontsdir=fonts[v]"
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
pch = min(sh, bf[4] * (2.6 if cam_mode else 3.4)); pcw = min(sw, pch * W / SEAM)
fcx, fcy = min(max(bf[1] - pcw / 2, 0), sw - pcw), min(max(bf[2] - pch * .42, 0), sh - pch)
face = im.crop((round(fcx), round(fcy), round(fcx + pcw), round(fcy + pch))).resize((W, round(W * pch / pcw)))
mask = Image.linear_gradient('L').resize((W, face.height))  # yüz görselinin üst kenarı yumuşak geçsin
bg.paste(face, (0, H - face.height), mask)
d = ImageDraw.Draw(bg)
anton = lambda s: ImageFont.truetype('fonts/Anton-Regular.ttf', s)
label = f'GTA 6 • {AD.upper()}' if GTA else f'{platform.upper()} • {AD.upper()}'
d.text((W / 2, 150), label, font=anton(64), fill='white', anchor='mm', stroke_width=3, stroke_fill='black')
def auto_kanca(ws):
    """Kapak/başlık metni: altyazıdan kısa, vurucu bir cümle (ünlem/soru öncelikli, küfürsüz). Son 2 kelime sarı."""
    txt = ' '.join(w[0] for w in ws)
    sents = [x.strip(' ,') for x in re.split(r'(?<=[.!?…])\s+', txt) if 3 <= len(x.split()) <= 7
             and not kesit.KUFUR.search(x) and not kesit.BASLIK_YASAK.search(x) and '*' not in x]
    if not sents:
        return None, None
    best = max(sents, key=lambda x: (x.endswith(('!', '?')), -abs(len(x.split()) - 5)))
    w_ = best.rstrip('.…').split()
    up = lambda x: x.replace('i', 'İ').replace('ı', 'I').upper()
    return best.rstrip('.…'), f"{up(' '.join(w_[:-2]))}|{up(' '.join(w_[-2:]))}" if len(w_) > 3 else f"{up(best)}|"


if not KANCA:
    cumle, KANCA = auto_kanca(words)
    if cumle and not BASLIK:
        BASLIK = f'{AD} {"GTA 6" if GTA else ""}: "{cumle}" {"🔥" if cumle.endswith("!") else "😳"} #shorts'.replace('  ', ' ')
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
#shorts {'#GTA6 #GTAVI #gta6türkiye ' if GTA else ''}#{re.sub(r'[^A-Za-z0-9]', '', AD)} #{platform} #yayın #keşfet

Kategori: {KATEGORI or '-'} · Düzen: {MODE} · Kaynak dil: {lang} · Kesit: {start:.0f}-{end:.0f}. saniyeler · Kayıt: {os.path.basename(rec)}

Altyazı metni: {text}
""")
os.remove(clip); os.remove(ass)
print(json.dumps({'video': out, 'kapak': cover, 'metin': text, 'dil': lang}, ensure_ascii=False))
