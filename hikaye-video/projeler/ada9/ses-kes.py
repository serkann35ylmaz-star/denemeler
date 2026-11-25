#!/usr/bin/env python3
"""Kullanıcının tek parça kaydını (ElevenLabs) 36 anlatıcı satırına böler: vo/<id>.wav + vo/sesler.json.
Kullanım (hikaye-video/ içinden): python3 projeler/ada9/ses-kes.py <kayit.wav> <bolum1.json>
Satır sınırları Whisper zamanlarından, kesim noktaları sessizlik kenarlarından alınır."""
import hashlib, json, re, subprocess, sys, wave
import numpy as np

SR = 48000
# (başlangıç, bitiş) Whisper ile bulunan konuşma aralıkları, satır sırasıyla
SPANS = [(1.69, 2.60), (3.02, 5.90), (6.32, 9.66), (9.98, 13.94), (14.40, 16.32), (16.60, 20.48), (20.78, 23.46),
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


def main():
    wav, story_path = sys.argv[1], sys.argv[2]
    story = json.load(open(story_path, encoding='utf-8'))
    narr = story['anlatici']
    ev = [e for sc in story['sahneler'] for e in sc['olaylar'] if e.get('tip') == 'anlatici']
    assert len(ev) == len(SPANS), (len(ev), len(SPANS))
    w = wave.open(wav); a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2'); n = len(a) / SR
    st, en = silences(wav)
    db = json.load(open('vo/sesler.json', encoding='utf-8'))
    for i, (e, (s0, e0)) in enumerate(zip(ev, SPANS)):
        s = snap(s0, en) if i else s0
        t = snap(e0, st)
        if t <= s: t = e0
        a0, a1 = max(0, s - 0.05), min(n, t + 0.15)
        seg = a[int(a0 * SR):int(a1 * SR)].copy()
        f = int(0.01 * SR); seg[:f] = (seg[:f] * np.linspace(0, 1, f)).astype('<i2'); seg[-f:] = (seg[-f:] * np.linspace(1, 0, f)).astype('<i2')
        v = (narr.get('ses', 'tr-TR-AhmetNeural'), e.get('hiz', narr.get('hiz', '+0%')), e.get('perde', narr.get('perde', '+0Hz')))
        lid = hashlib.sha1(('|'.join(v) + '|' + e['metin']).encode()).hexdigest()[:12]
        with wave.open(f'vo/{lid}.wav', 'wb') as o:
            o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR); o.writeframes(seg.tobytes())
        # zarf: 30 kare/sn
        hop = SR // 30; m = len(seg) // hop
        x = seg[:m * hop].astype(np.float32).reshape(m, hop) / 32768
        rms = np.sqrt((x ** 2).mean(axis=1)); ref = np.percentile(rms, 95) or 1
        env = [round(float(q), 2) for q in np.clip(rms / ref, 0, 1)]
        # kelime zamanları: harf ağırlığı, noktalama +pay, konuşma aralığı [s,t]
        toks = e['metin'].replace('*', '').split()
        wt = [len(re.sub(r'\W', '', k)) + (2.5 if re.search(r'[.,:?!]$', k) else 0) + 1 for k in toks]
        tot = sum(wt); sp0, sp1 = s - a0, t - a0; c = sp0; words = []
        for k, q in zip(toks, wt):
            d = (sp1 - sp0) * q / tot; words.append([k, round(c, 3), round(c + d, 3)]); c += d
        db[lid] = {'dur': round(len(seg) / SR, 3), 'env': env, 'metin': e['metin'], 'motor': 'kullanici', 'kelimeler': words}
        print(i + 1, lid, round(len(seg) / SR, 2), e['metin'][:40])
    json.dump(db, open('vo/sesler.json', 'w', encoding='utf-8'), ensure_ascii=False)


main()
