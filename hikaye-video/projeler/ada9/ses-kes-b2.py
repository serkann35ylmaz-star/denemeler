#!/usr/bin/env python3
"""2. bölüm: kullanıcının tek parça kaydını bolum2.json'daki anlatıcı satırlarına böler (vo/<id>.wav + vo/sesler.json).
Kullanım (hikaye-video/ içinden): python3 projeler/ada9/ses-kes-b2.py <kayit.wav> <bolum2.json> <whisper-kelimeler.json> <satir-baslangiclari.json>
Kesim: iki satır arasındaki sessizliğin ortası (yoksa aradaki en sessiz 10 ms)."""
import difflib, hashlib, json, re, subprocess, sys, unicodedata, wave
import numpy as np
import scipy.signal as sg
SR = 48000


def norm(x):
    x = x.lower().replace('ı', 'i')
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', x).encode('ascii', 'ignore').decode())


def align(toks, s0, e0, ww):
    res = [None] * len(toks); j = 0
    for i, k in enumerate(toks):
        nk = norm(k)
        if not nk: continue
        best = None
        for q in range(j, min(len(ww), j + 4)):
            r = difflib.SequenceMatcher(None, nk, ww[q][0]).ratio()
            if r >= 0.72 and (best is None or r > best[0]): best = (r, q)
        if best: res[i] = (ww[best[1]][1], ww[best[1]][2]); j = best[1] + 1
    out = [None] * len(toks); i = 0
    while i < len(toks):
        if res[i]: out[i] = res[i]; i += 1; continue
        k = i
        while k < len(toks) and not res[k]: k += 1
        a = out[i - 1][1] if i else s0
        b = res[k][0] if k < len(toks) else e0
        b = max(b, a + 0.05 * (k - i))
        wt = [len(re.sub(r'\W', '', toks[m])) + 1 for m in range(i, k)]
        c = a
        for m, q in zip(range(i, k), wt):
            d = (b - a) * q / sum(wt); out[m] = (c, c + d); c += d
        i = k
    return out


_WM = None
def klip_kelimeleri(seg):
    global _WM
    from faster_whisper import WhisperModel
    if _WM is None: _WM = WhisperModel('small', device='cpu', compute_type='int8')
    b = sg.resample_poly(seg.astype(np.float32) / 32768, 1, 3)
    out, _ = _WM.transcribe(b, language='tr', word_timestamps=True, condition_on_previous_text=False, no_speech_threshold=0.95, temperature=0)
    return [(norm(w.word), w.start, w.end) for s in out for w in s.words]


def main():
    wav, story_path, wj, starts_p = sys.argv[1:5]
    story = json.load(open(story_path, encoding='utf-8')); narr = story['anlatici']
    ev = [e for sc in story['sahneler'] for e in sc['olaylar'] if e.get('tip') == 'anlatici']
    W = json.load(open(wj)); S0 = json.load(open(starts_p))  # her satırın ilk kelime başlangıcı
    assert len(ev) == len(S0), (len(ev), len(S0))
    w = wave.open(wav); a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2'); n = len(a) / SR
    r = subprocess.run(['ffmpeg', '-i', wav, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r)]
    sil = list(zip(st, en[:len(st)]))
    rms = np.sqrt(np.convolve((a.astype(np.float32) / 32768) ** 2, np.ones(480) / 480, 'same'))
    # her satırın son kelime bitişi
    ends = []
    for i in range(len(S0)):
        nxt = S0[i + 1] if i + 1 < len(S0) else 1e9
        ends.append(max([b for _, x, b in W if S0[i] - 0.01 <= x < nxt - 0.01]))
    cuts = [0.0]
    for i in range(len(S0) - 1):
        lo, hi = ends[i], S0[i + 1]
        c = [(s, e) for s, e in sil if e > lo - 0.35 and s < hi + 0.5 and e - s >= 0.12]
        if c:
            s, e = min(c, key=lambda x: abs((x[0] + x[1]) / 2 - (lo + hi) / 2)); cuts.append((s + e) / 2)
        else:
            i0, i1 = int(lo * SR), max(int(hi * SR), int(lo * SR) + 480)
            cuts.append((i0 + int(np.argmin(rms[i0:i1]))) / SR)
    cuts.append(n)
    db = json.load(open('vo/sesler.json', encoding='utf-8'))
    for i, e in enumerate(ev):
        seg = a[int(cuts[i] * SR):int(cuts[i + 1] * SR)].copy()
        f = int(0.01 * SR); seg[:f] = (seg[:f] * np.linspace(0, 1, f)).astype('<i2'); seg[-f:] = (seg[-f:] * np.linspace(1, 0, f)).astype('<i2')
        v = (narr.get('ses', 'tr-TR-AhmetNeural'), e.get('hiz', narr.get('hiz', '+0%')), e.get('perde', narr.get('perde', '+0Hz')))
        lid = hashlib.sha1(('|'.join(v) + '|' + e['metin']).encode()).hexdigest()[:12]
        with wave.open(f'vo/{lid}.wav', 'wb') as o:
            o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR); o.writeframes(seg.tobytes())
        hop = SR // 30; m = len(seg) // hop
        x = seg[:m * hop].astype(np.float32).reshape(m, hop) / 32768
        rr = np.sqrt((x ** 2).mean(axis=1)); ref = np.percentile(rr, 95) or 1
        env = [round(float(q), 2) for q in np.clip(rr / ref, 0, 1)]
        toks = e['metin'].replace('*', '').split()
        al = align(toks, 0.0, len(seg) / SR, klip_kelimeleri(seg))
        words = [[k, round(max(0, x1), 3), round(max(0, y1), 3)] for k, (x1, y1) in zip(toks, al)]
        db[lid] = {'dur': round(len(seg) / SR, 3), 'env': env, 'metin': e['metin'], 'motor': 'kullanici', 'kelimeler': words}
        print(i + 1, lid, round(cuts[i], 2), round(cuts[i + 1], 2), round(len(seg) / SR, 2), e['metin'][:40])
    json.dump(db, open('vo/sesler.json', 'w', encoding='utf-8'), ensure_ascii=False)


main()
