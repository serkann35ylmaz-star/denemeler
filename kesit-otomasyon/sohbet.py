#!/usr/bin/env python3
"""Sohbet patlamasından viral an bulucu: uzun bir yayının sohbetini analiz edip en çılgın anlardan kesit çıkarır.

  python3 sohbet.py <sohbet dosyası> <video: yayın kaydı dosyası ya da Twitch/Kick video bağlantısı> --ad Yayıncı
                    [--adet 5] [--once 20] [--sonra 15] [--kategori "Grand Theft Auto VI"] [--sadece-analiz]

Mantık: yayında çılgın bir olay olunca sohbet bir anda patlar (herkes güler, şaşırır, mesaj yağdırır).
1. Mesajlar 10 sn'lik dilimlere ayrılır; her dilim o anki olağan tempoya (çevresindeki 5 dakikanın ortancası) göre puanlanır.
2. Gülme/şaşkınlık/emote yağmuru (KEKW, LUL, OMEGALUL, hahaha, ???, W, L ...) ayrıca ağırlıklandırılır.
3. Sohbet olaya birkaç saniye geç tepki verdiği için kesit patlamadan --once (20) sn önce başlar, --sonra (15) sn sonra biter.
4. Her an canli.py ile dikey düzen + Türkçe altyazı + kapak olarak üretilir. Rapor: out/sohbet-rapor.md

Desteklenen sohbet dosyaları:
- TwitchDownloader JSON (comments[].content_offset_seconds, message.body)
- Satır başına JSON (time / timestamp / offset + message / text / content)
- CSV ya da TXT: "saniye veya ss:dd:ss, mesaj"
"""
import csv, json, os, re, subprocess, sys

sys.argv_save = list(sys.argv)
import kesit
from kesit import opt, log, OUT

AD = opt('--ad', 'Yayıncı')
ADET = int(opt('--adet', '5'))
ONCE, SONRA = float(opt('--once', '20')), float(opt('--sonra', '15'))
KATEGORI = opt('--kategori', '')
SADECE = '--sadece-analiz' in sys.argv
if SADECE:
    sys.argv.remove('--sadece-analiz')
if len(sys.argv) < 3:
    sys.exit(__doc__)
CHAT, VIDEO = sys.argv[1], sys.argv[2]
BIN = 10
TEPKI = re.compile(r'\b(kekw|lul|lmao+|lol+|omegalul|pog\w*|wtf|omg|no ?way|xd+|w+|l+|ahah\w*|haha\w*|sjsj\w*|asdf\w*|oha+|aq|amk)\b|\?{2,}|!{2,}|😂|🤣|💀|😱', re.I)


def secs(v):
    if isinstance(v, (int, float)):
        return float(v)
    v = str(v).strip()
    if re.fullmatch(r'\d+(\.\d+)?', v):
        return float(v)
    p = [float(x) for x in v.split(':')]
    return sum(x * 60 ** i for i, x in enumerate(reversed(p)))


def load_chat(path):
    """[(saniye, mesaj)] — biçimi kendisi tanır."""
    txt = open(path, encoding='utf-8', errors='ignore').read()
    out = []
    try:
        d = json.loads(txt)
        items = d.get('comments') if isinstance(d, dict) else d
        for c in items or []:
            t = c.get('content_offset_seconds', c.get('offset', c.get('time', c.get('timestamp'))))
            m = (c.get('message') or {}).get('body') if isinstance(c.get('message'), dict) else c.get('message', c.get('text', c.get('content', '')))
            if t is not None:
                out.append((secs(t), str(m or '')))
        if out:
            return out
    except json.JSONDecodeError:
        pass
    for line in txt.splitlines():  # satır başına JSON
        line = line.strip()
        if line.startswith('{'):
            try:
                c = json.loads(line)
                t = c.get('content_offset_seconds', c.get('offset', c.get('time', c.get('timestamp'))))
                if t is not None:
                    out.append((secs(t), str(c.get('message', c.get('text', c.get('content', ''))))))
            except json.JSONDecodeError:
                pass
    if out:
        return out
    for row in csv.reader(txt.splitlines()):  # "zaman, mesaj"
        if len(row) >= 2:
            try:
                out.append((secs(row[0]), ','.join(row[1:])))
            except ValueError:
                pass
    return out


import numpy as np
msgs = load_chat(CHAT)
if not msgs:
    sys.exit(f'Sohbet dosyası okunamadı ya da boş: {CHAT}')
end = max(t for t, _ in msgs)
nb = int(end // BIN) + 1
cnt, tep = np.zeros(nb), np.zeros(nb)
for t, m in msgs:
    b = int(t // BIN)
    cnt[b] += 1
    tep[b] += 1 if TEPKI.search(m) else 0
w = int(300 // BIN)  # olağan tempo: çevresindeki 5 dakikanın ortancası
base = np.array([np.median(cnt[max(0, i - w):i + w + 1]) for i in range(nb)])
score = (cnt - base) / np.sqrt(base + 1) + 1.5 * tep / np.sqrt(base + 1)
score = np.convolve(score, [.25, .5, .25], 'same')  # komşu dilimleri birlikte say (patlama 10-30 sn sürer)
picks = []
for i in np.argsort(-score):
    if score[i] <= 2 or len(picks) >= ADET:
        break
    if all(abs(i - j) * BIN >= 60 for j, _ in picks):  # anlar arasında en az 1 dakika
        picks.append((int(i), float(score[i])))
picks.sort()
rows = ['# Sohbet patlaması analizi', '', f'{len(msgs):,} mesaj, {end / 60:.0f} dakika, dilim {BIN} sn', '',
        '| # | an | mesaj/10sn | olağan | tepki | puan | kesit |', '|---|---|---|---|---|---|---|']
cuts = []
for k, (i, sc) in enumerate(picks, 1):
    t0 = max(0, i * BIN - ONCE); t1 = i * BIN + BIN + SONRA
    cuts.append((t0, t1))
    hm = lambda x: f'{int(x // 3600)}:{int(x % 3600 // 60):02d}:{int(x % 60):02d}'
    rows.append(f'| {k} | {hm(i * BIN)} | {int(cnt[i])} | {base[i]:.0f} | {int(tep[i])} | {sc:.1f} | {hm(t0)} - {hm(t1)} |')
open(f'{OUT}/sohbet-rapor.md', 'w', encoding='utf-8').write('\n'.join(rows) + '\n')
log('\n'.join(rows[2:]))
if SADECE or not cuts:
    sys.exit(0)

# kesitleri al ve üret
work = f'{OUT}/sohbet'
os.makedirs(work, exist_ok=True)
for k, (t0, t1) in enumerate(cuts, 1):
    part = f'{work}/an{k}.mp4'
    if os.path.exists(VIDEO):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t0:.2f}', '-i', VIDEO, '-t', f'{t1 - t0:.2f}', '-c:v', 'libx264',
                        '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', part], check=True)
    else:
        import yt_dlp
        from yt_dlp.utils import download_range_func
        yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True, 'noprogress': True, 'format': 'best[height<=1080]/best',
                          'outtmpl': part, 'download_ranges': download_range_func(None, [(t0, t1)]),
                          'force_keyframes_at_cuts': True}).download([VIDEO])
    log(f'\n▶ an {k}: {t0:.0f}-{t1:.0f} sn')
    cmd = [sys.executable, 'canli.py', part, '--ad', AD, '--tamami'] + (['--kategori', KATEGORI] if KATEGORI else [])
    subprocess.run(cmd, check=False)
