#!/usr/bin/env python3
"""Hikayedeki her replik ve anlatıcı satırını seslendirir. İki ücretsiz motor:

  chatterbox (varsayılan): Bu makinede çalışan açık kaynak yapay zekâ sesi (Resemble AI, MIT lisansı).
      Doğal tonlama, duyguya göre canlılık. Her karakterin sesi bir örnek kayıttan kopyalanır:
      karakterde "ornekSes": "sesler/ela.wav" (5-15 sn temiz kayıt) verilirse o ses kullanılır,
      verilmezse karakterin Edge sesiyle kısa bir örnek üretilip o kopyalanır.
      Her satır Whisper ile dinlenip kontrol edilir; yanlış okunursa yeniden üretilir.
  edge: Microsoft Edge sesleri. Çok hızlı ama daha mekanik.

Çıktı: vo/<id>.wav dosyaları + vo/sesler.json (süre ve dudak senkronu için ses zarfı).
Aynı metin/ses ikinci kez üretilmez (önbellek).

Kullanım:
  python3 ses.py            # hikaye.json'daki "sesMotoru" (yoksa chatterbox)
  python3 ses.py --edge     # hızlı, mekanik
  python3 ses.py --sessiz   # internet yoksa: süreleri tahmin eder, ses üretmez
  python3 ses.py hikayeler/baska.json
"""
import asyncio, difflib, hashlib, json, os, re, subprocess, sys

import numpy as np

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
SESSIZ = '--sessiz' in sys.argv
STORY = ARGS[0] if ARGS else 'hikaye.json'
FPS_ENV = 30          # dudak senkronu çözünürlüğü (kare/sn)
SR = 48000
REF_TEXT = 'Merhaba, bugün sana kısa bir hikâye anlatacağım. Dinlemeye hazır mısın? Haydi başlayalım.'
# duygu -> (canlılık/exaggeration, cfg): yüksek canlılık = daha coşkulu okuma
# (ölçüm: canlılık 1.0 / cfg .25 ile tonlama çeşitliliği Edge örneğine göre ~1,7 kat, doğruluk %100)
EMO = {'notr': (.9, .28), 'mutlu': (1.0, .25), 'uzgun': (.75, .32), 'kizgin': (1.15, .22),
       'saskin': (1.05, .24), 'korkmus': (1.0, .26), 'dusunceli': (.7, .32)}
# Kendi kaydı verilmeyen karakterler için insan referans sesleri (sesler/KAYNAK.md)
VARSAYILAN_REF = {'_anlatici': 'sesler/erkek-anlatici.wav', 'erkek': 'sesler/erkek-2.wav', 'kadin': 'sesler/ince-1.wav'}

# Bu ortamdaki HTTPS vekil sunucusu kendi sertifikasını kullanır; edge-tts certifi'ye sabitlenmiş.
CA = '/root/.ccr/ca-bundle.crt'
if os.path.exists(CA):
    import certifi
    certifi.where = lambda: CA
    for k in ('SSL_CERT_FILE', 'REQUESTS_CA_BUNDLE'):  # model indirmeleri (Hugging Face) için
        os.environ.setdefault(k, CA)


def lines_of(story):
    """Hikayedeki tüm konuşma satırlarını (replik + anlatıcı) ses ayarlarıyla döndürür."""
    chars = story.get('karakterler', {})
    narr = story.get('anlatici', {'ses': 'tr-TR-AhmetNeural', 'hiz': '-8%', 'perde': '-4Hz'})
    out = []
    for sc in story['sahneler']:
        for ev in sc.get('olaylar', []):
            if ev.get('tip') == 'replik':
                key, c = ev['kim'], chars[ev['kim']]
            elif ev.get('tip') == 'anlatici':
                key, c = '_anlatici', narr
            else:
                continue
            v = (c.get('ses', 'tr-TR-AhmetNeural'), ev.get('hiz', c.get('hiz', '+0%')), ev.get('perde', c.get('perde', '+0Hz')))
            out.append({'id': line_id(v, ev['metin']), 'v': v, 'text': ev['metin'], 'speak': ev['metin'].replace('*', ''), 'kim': key, 'c': c, 'duygu': ev.get('duygu', 'notr')})
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


# ---------- chatterbox ----------
_tts = _asr = None


def norm(s):
    s = s.replace('İ', 'i').replace('I', 'ı').lower()
    s = re.sub(r'[^a-zçğıöşüâîû0-9 ]', ' ', s)
    return ' '.join(s.split())


def reference(item):
    """Karakterin ses örneği: kendi kaydı ya da Edge sesiyle üretilmiş kısa örnek."""
    c = item['c']
    if c.get('ornekSes'):
        if not os.path.exists(c['ornekSes']):
            sys.exit(f"Ses örneği bulunamadı: {c['ornekSes']}")
        return c['ornekSes']
    if c.get('sesTipi') in ('edge',) or not os.path.exists(VARSAYILAN_REF['_anlatici']):
        pass  # açıkça Edge örneği istenmiş ya da referans sesler yok
    elif item['kim'] == '_anlatici':
        return VARSAYILAN_REF['_anlatici']
    else:
        kadin = 'Emel' in item['v'][0] or c.get('sesTipi') == 'kadin'
        return VARSAYILAN_REF['kadin' if kadin else 'erkek']
    ref = f"vo/ornek_{item['kim']}_{hashlib.sha1('|'.join(item['v']).encode()).hexdigest()[:6]}.wav"
    if not os.path.exists(ref):
        asyncio.run(tts(REF_TEXT, item['v'], ref + '.mp3'))
        to_wav(ref + '.mp3', ref)
        os.remove(ref + '.mp3')
    return ref


def cb_generate(item, out_wav, takes=3):
    """En fazla `takes` deneme üretir, Whisper ile dinler, metne en yakın olanı kırpıp kaydeder."""
    global _tts, _asr
    import torch, torchaudio as ta
    if _tts is None:
        print('  model yükleniyor (ilk seferde indirilir)...', flush=True)
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        from faster_whisper import WhisperModel
        torch.set_num_threads(os.cpu_count() or 4)
        _tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
        _asr = WhisperModel('small', device='cpu', compute_type='int8')
    ex, cfg = EMO.get(item['duygu'], EMO['notr'])
    ex = min(1.2, ex * item['c'].get('canlilik', 1.0))
    ref, best = reference(item), None
    for k in range(takes):
        torch.manual_seed(int(item['id'][:6], 16) + k * 101)
        w = _tts.generate(item['speak'], language_id='tr', audio_prompt_path=ref, exaggeration=ex, cfg_weight=cfg, temperature=.8)
        tmp = f'{out_wav}.take{k}.wav'
        ta.save(tmp, w, _tts.sr)
        pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', tmp, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], check=True, capture_output=True).stdout
        segs, _ = _asr.transcribe(np.frombuffer(pcm, np.int16).astype(np.float32) / 32768, language='tr', beam_size=3, word_timestamps=True)
        words = [x for sg in segs for x in sg.words]
        heard = ' '.join(x.word for x in words)
        score = difflib.SequenceMatcher(None, norm(item['speak']), norm(heard)).ratio()
        print(f'  deneme {k + 1}: uyum %{score * 100:.0f}', flush=True)
        if best is None or score > best[0]:
            best = (score, tmp, words, heard)
        if score >= .93:
            break
    score, tmp, words, heard = best
    if score < .8:
        print(f'  UYARI: en iyi deneme bile metinden sapıyor. Duyulan: "{heard.strip()}"')
    # ilk kelimeden hemen önce başla, son kelimeden sonra kes (model bazen sona fazladan ses ekler)
    start = max(0, words[0].start - .08) if words else 0
    end = words[-1].end + .3 if words else None
    trim = ['-ss', f'{start:.3f}'] + (['-to', f'{end:.3f}'] if end else [])
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', tmp, *trim, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
                    '-ar', str(SR), '-ac', '1', out_wav], check=True)
    for k in range(takes):
        if os.path.exists(f'{out_wav}.take{k}.wav'):
            os.remove(f'{out_wav}.take{k}.wav')
    rel = [[x.word.strip(), round(max(0, x.start - start), 2), round(x.end - start, 2)] for x in words]
    return round(score, 3), rel


def main():
    story = json.load(open(STORY, encoding='utf-8'))
    os.makedirs('vo', exist_ok=True)
    db_path = 'vo/sesler.json'
    db = json.load(open(db_path, encoding='utf-8')) if os.path.exists(db_path) else {}
    items = lines_of(story)
    motor = 'edge' if '--edge' in sys.argv else 'chatterbox' if '--chatterbox' in sys.argv else story.get('sesMotoru', 'chatterbox')
    if motor == 'chatterbox' and not SESSIZ:
        try:
            import chatterbox, faster_whisper  # noqa: F401
        except ImportError:
            print('chatterbox kurulu değil -> edge kullanılıyor.  Kurmak için: pip install chatterbox-tts faster-whisper')
            motor = 'edge'
    for i, it in enumerate(items):
        lid, v, text = it['id'], it['v'], it['text']
        rec = db.get(lid)
        sig = f"{reference(it)}|{EMO.get(it['duygu'])}" if motor == 'chatterbox' and not SESSIZ else ''
        ok = rec and (rec.get('sessiz') if SESSIZ else (not rec.get('sessiz') and rec.get('motor', 'edge') == motor
              and rec.get('imza', '') == sig and os.path.exists(f'vo/{lid}.wav')))
        if ok:
            continue
        print(f'[{i + 1}/{len(items)}] {motor} · {it["kim"]}: {text[:60]}', flush=True)
        if SESSIZ:
            dur, env = fake(it['speak'])
            db[lid] = {'dur': round(dur, 3), 'env': env, 'sessiz': True, 'metin': text}
        elif motor == 'chatterbox':
            score, words = cb_generate(it, f'vo/{lid}.wav')
            dur, env = envelope(f'vo/{lid}.wav')
            db[lid] = {'dur': round(dur, 3), 'env': env, 'metin': text, 'motor': motor, 'uyum': score, 'kelimeler': words, 'imza': sig}
        else:
            mp3 = f'vo/{lid}.mp3'
            asyncio.run(tts(it['speak'], v, mp3))
            to_wav(mp3, f'vo/{lid}.wav')
            os.remove(mp3)
            dur, env = envelope(f'vo/{lid}.wav')
            db[lid] = {'dur': round(dur, 3), 'env': env, 'metin': text, 'motor': motor}
        json.dump(db, open(db_path, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(items)} satır hazır -> {db_path}')


if __name__ == '__main__':
    main()
