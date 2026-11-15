# Deterministic procedural sound effects (paper slides, flips, thumps, stamp, whoosh, sonar, rumble, tick).
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
SR = 44100
rng = np.random.default_rng(20261115)
def noise(d): return rng.standard_normal(int(SR * d))
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f): return sosfilt(butter(2, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'highpass', fs=SR, output='sos'), x)
def norm(x, peak=0.8): return x / (np.abs(x).max() + 1e-9) * peak
def save(name, x): wavfile.write(name + '.wav', SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
def grain(x, rate=180, depth=0.6):
    k = rng.random(int(len(x) / SR * rate) + 2); m = np.interp(np.arange(len(x)), np.linspace(0, len(x), len(k)), k)
    return x * (1 - depth + depth * m)
d = 0.55; x = grain(bp(noise(d), 1800, 7000)); t = np.arange(len(x)) / SR
save('paper_slide', norm(x * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5, 0.55))
n = int(SR * .16); t = np.arange(n) / SR
save('paper_flip', norm(grain(bp(noise(.16), 2500, 9000), 400, 0.8) * np.minimum(1, t / .004) * np.exp(-t / .035), 0.6))
n = int(SR * .3); t = np.arange(n) / SR
save('paper_thump', norm(0.8 * np.sin(2 * np.pi * 95 * t) * np.exp(-t / .05) + 0.5 * lp(noise(.3), 1800) * np.exp(-t / .03) + 0.25 * bp(noise(.3), 3000, 8000) * np.exp(-t / .012), 0.7))
n = int(SR * .45); t = np.arange(n) / SR
save('stamp', norm(np.sin(2 * np.pi * 70 * t) * np.exp(-t / .08) + 0.7 * lp(noise(.45), 1200) * np.exp(-t / .05) + 0.4 * bp(noise(.45), 1500, 5000) * np.exp(-t / .02), 0.85))
d = 0.8; n = int(SR * d); t = np.arange(n) / SR; x = noise(d); out = np.zeros(n); blk = 2048
for i in range(0, n, blk):
    f = 400 + 3500 * np.sin(np.pi * (i / n)) ** 2; seg = bp(x[max(0, i - 4096):i + blk], f * 0.6, f * 1.4); m = len(x[i:i + blk]); out[i:i + m] = seg[-m:]
save('whoosh', norm(grain(out * np.sin(np.pi * t / d) ** 2, 90, 0.35), 0.5))
n = int(SR * 2.2); t = np.arange(n) / SR
p = np.sin(2 * np.pi * 1150 * t) * np.exp(-t / .35) * np.minimum(1, t / .003); x = p.copy(); dl = int(SR * .42)
x[dl:] += 0.35 * p[:-dl]; x[2 * dl:] += 0.12 * p[:-2 * dl]; save('sonar', norm(x, 0.5))
d = 4.0; n = int(SR * d); t = np.arange(n) / SR
save('rumble', norm(lp(noise(d), 120) * np.sin(np.pi * t / d) ** 1.2 + 0.3 * np.sin(2 * np.pi * 42 * t) * np.sin(np.pi * t / d) ** 2, 0.6))
n = int(SR * .05); t = np.arange(n) / SR
save('tick', norm(hp(noise(.05), 2000) * np.exp(-t / .004) + 0.4 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t / .01), 0.45))
print('ok')
