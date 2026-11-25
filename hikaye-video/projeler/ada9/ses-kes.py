#!/usr/bin/env python3
"""Kullanıcının tek parça kaydını (ElevenLabs) 36 anlatıcı satırına böler: vo/<id>.wav + vo/sesler.json.
Kullanım (hikaye-video/ içinden): python3 projeler/ada9/ses-kes.py <kayit.wav> <bolum1.json>
Satır sınırları Whisper zamanlarından, kesim noktaları sessizlik kenarlarından alınır."""
import difflib, hashlib, json, os, re, subprocess, sys, unicodedata, wave
import numpy as np

SR = 48000
# (başlangıç, bitiş) Whisper ile bulunan konuşma aralıkları, satır sırasıyla
SPANS = [(0.00, 2.54), (3.02, 5.90), (6.32, 9.66), (9.98, 13.94), (14.40, 16.32), (16.60, 20.48), (20.78, 23.46),
         (24.12, 27.28), (27.28, 30.00), (30.38, 44.30), (44.56, 45.58), (46.02, 47.92), (48.30, 50.46),
         (50.82, 53.52), (53.90, 55.00), (55.38, 57.40), (57.72, 62.22), (62.50, 66.58), (66.96, 70.00),
         (70.26, 72.14), (72.48, 74.46), (74.76, 75.40), (75.78, 76.20), (76.62, 77.00), (77.48, 78.58),
         (78.92, 79.90), (80.08, 84.92), (84.92, 87.36), (87.56, 91.00), (91.36, 92.40), (92.54, 93.76),
         (93.94, 95.22), (95.50, 96.50), (96.88, 99.56), (99.88, 103.34), (103.96, 106.76)]


def silences(wav):
    r = subprocess.run(['ffmpeg', '-i', wav, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r)]
    return st, en


def snap(v, arr, tol=0.35):
    c = min(arr, key=lambda x: abs(x - v)) if arr else v
    return c if abs(c - v) <= tol else v


def norm(x):
    x = x.lower().replace('ı', 'i')
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', x).encode('ascii', 'ignore').decode())


WH = [w for sg in json.load(open(os.path.join(os.path.dirname(__file__), 'ses-whisper.json'), encoding='utf-8')) for w in sg['w']]


def align(toks, s0, e0):
    """Metin kelimelerini Whisper kelime zamanlarına sırayla eşler; eşleşmeyenleri aralarına dağıtır -> [(bas, bit)]"""
    ww = [(norm(w), a, b) for w, a, b in WH if s0 - 0.15 <= a <= e0 + 0.05]
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


def main():
    wav, story_path = sys.argv[1], sys.argv[2]
    story = json.load(open(story_path, encoding='utf-8'))
    narr = story['anlatici']
    ev = [e for sc in story['sahneler'] for e in sc['olaylar'] if e.get('tip') == 'anlatici']
    assert len(ev) == len(SPANS), (len(ev), len(SPANS))
    w = wave.open(wav); a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2'); n = len(a) / SR
    st, en = silences(wav)
    db = json.load(open('vo/sesler.json', encoding='utf-8'))
    # kesim noktaları: önce her satırın gerçek bitişi (Whisper bitişinden sonraki ilk sessizlik başı), sonra bir sonraki satırın
    # başlangıcı = o bitişten sonraki ilk sessizlik sonu. Böylece önceki kelimenin ucu bir sonraki satıra sızmaz.
    ends, starts = [], []
    for i, (s0, e0) in enumerate(SPANS):
        c = [x for x in st if e0 - 0.08 <= x <= e0 + 0.5]
        ends.append(min(c) if c else e0 + 0.1)
    for i, (s0, e0) in enumerate(SPANS):
        if i == 0:
            c = [x for x in en if s0 - 0.5 <= x <= s0 + 0.3]; starts.append(min(c, key=lambda x: abs(x - s0)) if c else s0)
        else:
            c = [x for x in en if ends[i - 1] + 0.02 <= x <= e0 - 0.05]
            starts.append(min(c) if c else s0)
    for i, (e, (s0, e0)) in enumerate(zip(ev, SPANS)):
        s, t = starts[i], ends[i]
        if t <= s: s, t = s0, e0
        a0, a1 = max(0, s - 0.14), min(n, t + 0.12)
        seg = a[int(a0 * SR):int(a1 * SR)].copy()
        f = int(0.01 * SR); seg[:f] = (seg[:f] * np.linspace(0, 1, f)).astype('<i2'); seg[-f:] = (seg[-f:] * np.linspace(1, 0, f)).astype('<i2')
        v = (narr.get('ses', 'tr-TR-AhmetNeural'), e.get('hiz', narr.get('hiz', '+0%')), e.get('perde', narr.get('perde', '+0Hz')))
        lid = hashlib.sha1(('|'.join(v) + '|' + e['metin']).encode()).hexdigest()[:12]
        with wave.open(f'vo/{lid}.wav', 'wb') as o:
            o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR); o.writeframes(seg.tobytes())
        hop = SR // 30; m = len(seg) // hop  # zarf: 30 kare/sn
        x = seg[:m * hop].astype(np.float32).reshape(m, hop) / 32768
        rms = np.sqrt((x ** 2).mean(axis=1)); ref = np.percentile(rms, 95) or 1
        env = [round(float(q), 2) for q in np.clip(rms / ref, 0, 1)]
        toks = e['metin'].replace('*', '').split()
        al = align(toks, s0, e0)
        words = [[k, round(max(0, x1 - a0), 3), round(max(0, y1 - a0), 3)] for k, (x1, y1) in zip(toks, al)]
        db[lid] = {'dur': round(len(seg) / SR, 3), 'env': env, 'metin': e['metin'], 'motor': 'kullanici', 'kelimeler': words}
        print(i + 1, lid, round(len(seg) / SR, 2), e['metin'][:40])
    json.dump(db, open('vo/sesler.json', 'w', encoding='utf-8'), ensure_ascii=False)


main()
