#!/usr/bin/env python3
"""Hikayedeki her replik ve anlatıcı satırını seslendirir (Edge TTS, ücretsiz).

Çıktı: vo/<id>.wav dosyaları + vo/sesler.json (süre ve dudak senkronu için ses zarfı).
Aynı metin/ses ikinci kez üretilmez (önbellek).

Kullanım:
  python3 ses.py            # gerçek seslendirme
  python3 ses.py --sessiz   # internet yoksa: süreleri tahmin eder, ses üretmez
  python3 ses.py hikayeler/baska.json
"""
import asyncio, hashlib, json, os, subprocess, sys

import numpy as np

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
SESSIZ = '--sessiz' in sys.argv
STORY = ARGS[0] if ARGS else 'hikaye.json'
FPS_ENV = 30          # dudak senkronu çözünürlüğü (kare/sn)
SR = 48000

# Bu ortamdaki HTTPS vekil sunucusu kendi sertifikasını kullanır; edge-tts certifi'ye sabitlenmiş.
CA = '/root/.ccr/ca-bundle.crt'
if os.path.exists(CA):
    import certifi
    certifi.where = lambda: CA


def lines_of(story):
    """Hikayedeki tüm konuşma satırlarını (replik + anlatıcı) ses ayarlarıyla döndürür."""
    chars = story.get('karakterler', {})
    narr = story.get('anlatici', {'ses': 'tr-TR-AhmetNeural', 'hiz': '-8%', 'perde': '-4Hz'})
    out = []
    for sc in story['sahneler']:
        for ev in sc.get('olaylar', []):
            if ev.get('tip') == 'replik':
                c = chars[ev['kim']]
                v = (c.get('ses', 'tr-TR-AhmetNeural'), ev.get('hiz', c.get('hiz', '+0%')), ev.get('perde', c.get('perde', '+0Hz')))
            elif ev.get('tip') == 'anlatici':
                v = (narr.get('ses', 'tr-TR-AhmetNeural'), ev.get('hiz', narr.get('hiz', '+0%')), ev.get('perde', narr.get('perde', '+0Hz')))
            else:
                continue
            out.append((line_id(v, ev['metin']), v, ev['metin']))
    return out


def line_id(v, text):
    return hashlib.sha1(('|'.join(v) + '|' + text).encode()).hexdigest()[:12]


async def tts(text, v, path):
    import edge_tts
    voice, rate, pitch = v
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(path)
            return
        except Exception as e:  # ağ hatası: kısa bekleyip yeniden dene
            if attempt == 3:
                raise
            print('  yeniden deneniyor:', e)
            await asyncio.sleep(2 * (attempt + 1))


def to_wav(src, dst):
    """Baştaki/sondaki sessizliği kırp, 48 kHz mono WAV yap, ses seviyesini dengele."""
    trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05'
    af = f'{trim},areverse,{trim},areverse,loudnorm=I=-16:TP=-1.5:LRA=11'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', af, '-ar', str(SR), '-ac', '1', dst], check=True)


def envelope(wav):
    """Kare başına 0..1 ses yüksekliği: karakterin ağzı buna göre açılır."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    a = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    hop = SR // FPS_ENV
    n = max(1, len(a) // hop)
    rms = np.sqrt(np.mean(a[:n * hop].reshape(n, hop) ** 2, axis=1))
    ref = np.percentile(rms, 95) or 1
    env = np.clip(rms / ref, 0, 1)
    return len(a) / SR, [round(float(x), 2) for x in env]


def fake(text):
    """İnternetsiz önizleme için tahmini süre ve sentetik ağız hareketi."""
    dur = 0.5 + len(text) * 0.062
    n = int(dur * FPS_ENV)
    env = [round(abs(np.sin(i * 0.9)) * (0.4 + 0.6 * abs(np.sin(i * 0.23))), 2) for i in range(n)]
    return dur, env


def main():
    story = json.load(open(STORY, encoding='utf-8'))
    os.makedirs('vo', exist_ok=True)
    db_path = 'vo/sesler.json'
    db = json.load(open(db_path, encoding='utf-8')) if os.path.exists(db_path) else {}
    items = lines_of(story)
    for i, (lid, v, text) in enumerate(items):
        rec = db.get(lid)
        if rec and (SESSIZ or not rec.get('sessiz')) and (rec.get('sessiz') or os.path.exists(f'vo/{lid}.wav')):
            continue
        print(f'[{i + 1}/{len(items)}] {v[0]}: {text[:60]}', flush=True)
        if SESSIZ:
            dur, env = fake(text)
            db[lid] = {'dur': round(dur, 3), 'env': env, 'sessiz': True, 'metin': text}
        else:
            mp3 = f'vo/{lid}.mp3'
            asyncio.run(tts(text, v, mp3))
            to_wav(mp3, f'vo/{lid}.wav')
            os.remove(mp3)
            dur, env = envelope(f'vo/{lid}.wav')
            db[lid] = {'dur': round(dur, 3), 'env': env, 'metin': text}
        json.dump(db, open(db_path, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(items)} satır hazır -> {db_path}')


if __name__ == '__main__':
    main()
