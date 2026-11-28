#!/usr/bin/env python3
"""Ses stüdyosu: kendi ses kaydını karakter ya da anlatıcı sesine çevirir.

  python3 ses_studyo.py <kayit-dosyasi> <ses-adi> [--dene "deneme cümlesi"]

1. Kaydı 24 kHz mono yapar, baştaki/sondaki sessizliği kırpar, ses seviyesini dengeler.
   Gürültü azaltma uygulanmaz (sesi boğuklaştırıyor). Bunun yerine kayıt sessiz bir odada yapılmalı.
2. Whisper ile dinler. Kayıt uzunsa cümle sınırlarından 10-15 saniyelik en dolu bölümü seçer.
3. Arka plan gürültüsünü ve kaydın kısa olup olmadığını kontrol eder, sorun varsa söyler.
4. sesler/<ses-adi>.wav olarak kaydeder ve bu sesle bir deneme cümlesi üretir:
   out/ses-testi-<ses-adi>.wav
Kullanmak için hikayede karaktere ya da anlatıcıya ekle:  "ornekSes": "sesler/<ses-adi>.wav"
Yalnızca kendi sesini ya da izni alınmış sesleri kullan.
"""
import os, subprocess, sys

import numpy as np

CA = '/root/.ccr/ca-bundle.crt'
if os.path.exists(CA):
    for k in ('SSL_CERT_FILE', 'REQUESTS_CA_BUNDLE'):
        os.environ.setdefault(k, CA)

args = sys.argv[1:]
dene = 'Gece yarısı. Yağmur durmuyor... ve sen, son teslimatın peşindesin.'
if '--dene' in args:
    i = args.index('--dene'); dene = args[i + 1]; del args[i:i + 2]
if len(args) < 2:
    sys.exit(__doc__)
src, name = args[0], args[1]
SR = 24000
os.makedirs('sesler', exist_ok=True); os.makedirs('out', exist_ok=True)


def pcm(path, sr):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(sr), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


# 1) temizle
tmp = f'out/.studyo-{name}.wav'
trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af',
                f'highpass=f=70,{trim},areverse,{trim},areverse,loudnorm=I=-18:TP=-2', '-ar', str(SR), '-ac', '1', tmp], check=True)
a = pcm(tmp, SR)
dur = len(a) / SR

# 2) kalite: gürültü tabanı (en sessiz %10'luk dilimlerin seviyesi) ve konuşma seviyesi
hop = SR // 50
fr = np.sqrt(np.mean(a[:len(a) // hop * hop].reshape(-1, hop) ** 2, axis=1)) + 1e-9
db = 20 * np.log10(fr)
noise, speech = np.percentile(db, 10), np.percentile(db, 90)
print(f'kayıt: {dur:.1f} sn, konuşma {speech:.0f} dB, arka plan {noise:.0f} dB (fark {speech - noise:.0f} dB)')
if dur < 6:
    print('UYARI: kayıt çok kısa. En az 10 saniye konuş.')
if speech - noise < 30:
    print('UYARI: arka plan gürültülü. Klima, fan, sokak sesi olmayan sessiz bir odada yeniden kaydetmek sonucu belirgin iyileştirir.')

# 3) uzun kayıtta cümle sınırlarından 10-15 sn'lik bölümü seç
from faster_whisper import WhisperModel
asr = WhisperModel('small', device='cpu', compute_type='int8')
segs = list(asr.transcribe(pcm(tmp, 16000), language='tr')[0])
print('duyulan:', ' '.join(s.text.strip() for s in segs)[:300])
start, end = 0.0, dur
if dur > 16 and segs:
    best = None
    for i in range(len(segs)):  # her cümle başından ~10-15 sn ilerle, en çok konuşma içeren pencereyi al
        j, talk = i, 0.0
        while j < len(segs) and segs[j].end - segs[i].start <= 15:
            talk += segs[j].end - segs[j].start; j += 1
        if j > i and segs[j - 1].end - segs[i].start >= 8 and (best is None or talk > best[0]):
            best = (talk, segs[i].start, segs[j - 1].end)
    if best:
        start, end = max(0, best[1] - .1), min(dur, best[2] + .2)
out = f'sesler/{name}.wav'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-ss', f'{start:.2f}', '-to', f'{end:.2f}', out], check=True)
os.remove(tmp)
print(f'referans ses: {out}  ({end - start:.1f} sn, kaydın {start:.1f}-{end:.1f}. saniyeleri)')

# 4) deneme cümlesi
import torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
torch.set_num_threads(os.cpu_count() or 4)
m = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
torch.manual_seed(11)
w = m.generate(dene, language_id='tr', audio_prompt_path=out, exaggeration=.8, cfg_weight=.3, temperature=.8)
test = f'out/ses-testi-{name}.wav'
ta.save(test, w, m.sr)
print(f'deneme: {test}')
print(f'kullanım: karaktere ya da "anlatici" bölümüne  "ornekSes": "{out}"  ekle')
