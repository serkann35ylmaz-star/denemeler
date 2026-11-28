#!/usr/bin/env python3
"""Yerel ses efekti üreticisi (ücretsiz, internetsiz, telifsiz): numpy/scipy ile sentez.

  python3 sfx.py <ad> <cikti.wav> [sure=6] [bpm=140] [seviye=1] [tohum=1]
Adlar: kalp, gok, sualti, kabarcik, okyanus, darbe, ruzgar, sicrama
build.js olaylardaki "ses" alanından ve "ambiyans" listesinden bunu çağırır, sonucu önbelleğe alır.
"""
import sys
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000


def lp(x, f, o=2):
    return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, o=2):
    return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)


def bp(x, a, b, o=2):
    return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)


def brown(n, rng):
    x = np.cumsum(rng.standard_normal(n)); x = hp(x, 15)
    return x / (np.abs(x).max() + 1e-9)


def env(n, a, d):  # atak + üstel sönüm (sn)
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def kalp(sure, bpm, rng):
    n = int(sure * SR); y = np.zeros(n); per = 60 / bpm
    def thump(f0, dur, amp):
        m = int(dur * SR); t = np.arange(m) / SR
        f = f0 * (1 + .6 * np.exp(-t / .02))  # perde düşüşü: "tok" vuruş
        return amp * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(m, .004, dur / 4)
    lub, dub = thump(55, .22, 1), thump(68, .16, .65)
    gap = min(.3, per * .38)
    for k in range(int(sure / per) + 1):
        s = int(k * per * SR)
        for w, off in ((lub, 0), (dub, int(gap * SR))):
            a, b = s + off, min(n, s + off + len(w))
            if a < n: y[a:b] += w[:b - a]
    return lp(y, 160)


def gok(sure, rng):
    n = int(sure * SR); t = np.arange(n) / SR
    crack = hp(rng.standard_normal(n), 900) * np.exp(-t / .12) * .6
    roll = lp(brown(n, rng), 220) * (np.minimum(1, t / .25) * np.exp(-t / (sure * .35)))
    rumble = lp(rng.standard_normal(n), 90, 4) * np.exp(-t / (sure * .45)) * 1.8
    return crack + roll + rumble / (np.abs(rumble).max() + 1e-9) * .8


def sualti(sure, rng):
    n = int(sure * SR); t = np.arange(n) / SR
    b = lp(brown(n, rng), 180, 4); lfo = .7 + .3 * np.sin(2 * np.pi * .13 * t + rng.uniform(0, 6))
    return b * lfo + kabarcik(sure, rng) * .12


def kabarcik(sure, rng, yogun=7):
    n = int(sure * SR); y = np.zeros(n)
    for _ in range(int(sure * yogun)):
        d = rng.uniform(.03, .09); m = int(d * SR); tt = np.arange(m) / SR
        f = rng.uniform(350, 1100) * (1 + 2.5 * tt / d)  # yükselen "blup"
        w = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / (d / 3)) * rng.uniform(.3, 1)
        s = int(rng.uniform(0, max(.01, sure - d)) * SR); y[s:s + m] += w[:n - s]
    return lp(y, 2500)


def okyanus(sure, rng):
    n = int(sure * SR); t = np.arange(n) / SR; y = np.zeros(n)
    noise = rng.standard_normal(n); body = lp(noise, 700) + .35 * bp(noise, 1500, 5000)
    tt, amp = 0.0, np.zeros(n)
    while tt < sure:  # dalgalar: 5-9 sn'de bir kabarıp çekilir
        p = rng.uniform(5, 9); a, b = int(tt * SR), min(n, int((tt + p) * SR)); x = np.linspace(0, 1, b - a)
        amp[a:b] += np.sin(np.pi * x) ** 1.6 * rng.uniform(.6, 1); tt += p * rng.uniform(.55, .8)
    y = body * (.25 + amp) + lp(brown(n, rng), 120) * .5
    return y


def darbe(sure, rng):
    n = int(sure * SR); t = np.arange(n) / SR
    f = 30 + 70 * np.exp(-t / .08)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .002, .45)
    hit = lp(rng.standard_normal(n), 2500) * env(n, .001, .05) * .7
    return sub + hit


def ruzgar(sure, rng):
    n = int(sure * SR); t = np.arange(n) / SR; noise = rng.standard_normal(n)
    lfo = .55 + .45 * np.sin(2 * np.pi * .09 * t + rng.uniform(0, 6)) * np.sin(2 * np.pi * .023 * t + 1)
    return bp(noise, 250, 1400) * lfo + lp(noise, 120) * .3


def sicrama(sure, rng):
    n = int(sure * SR); t = np.arange(n) / SR; noise = rng.standard_normal(n)
    s = hp(noise, 700) * env(n, .005, .18) + bp(noise, 200, 900) * env(n, .01, .35) * .6
    b = kabarcik(min(sure, 1.2), rng, 25)
    return s + np.pad(b, (0, max(0, n - len(b))))[:n] * .4


GEN = {'kalp': kalp, 'gok': gok, 'sualti': sualti, 'kabarcik': kabarcik, 'okyanus': okyanus,
       'darbe': darbe, 'ruzgar': ruzgar, 'sicrama': sicrama}
VARS = {'kalp': 6, 'gok': 5, 'sualti': 8, 'kabarcik': 2, 'okyanus': 12, 'darbe': 1.5, 'ruzgar': 10, 'sicrama': 1.5}


def main():
    ad, out = sys.argv[1], sys.argv[2]
    kw = dict(a.split('=', 1) for a in sys.argv[3:])
    sure = float(kw.get('sure', VARS.get(ad, 4))); rng = np.random.default_rng(int(kw.get('tohum', 1)))
    if ad not in GEN: sys.exit(f'bilinmeyen efekt: {ad} (var: {", ".join(GEN)})')
    y = kalp(sure, float(kw.get('bpm', 90)), rng) if ad == 'kalp' else GEN[ad](sure, rng)
    y = np.asarray(y, dtype=np.float64)
    f = int(.02 * SR); y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)  # tık sesi olmasın
    y = y / (np.abs(y).max() + 1e-9) * .89 * float(kw.get('seviye', 1))
    pcm = (np.clip(y, -1, 1) * 32767).astype('<i2')
    with wave.open(out, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print(f'sfx: {ad} {sure:.1f} sn -> {out}')


if __name__ == '__main__':
    main()
