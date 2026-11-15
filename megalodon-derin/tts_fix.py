# Verify every narration line with Whisper; regenerate bad takes with new seeds; trim tails after the last word.
import json, re, difflib, torch, torchaudio as ta
from faster_whisper import WhisperModel
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

lines = json.load(open('script.json'))
asr = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=4)
tts = None

def norm(s):
    s = s.lower().replace('â', 'a').replace('î', 'i').replace('û', 'u')
    s = re.sub(r'[^a-zçğıöşü0-9 ]', ' ', s)
    for w, d in [('yirmi', '20'), ('on beş', '15'), ('on sekiz', '18'), ('üç virgül altı', '3,6'), ('on bir', '11'), ('sekiz bin', '8000'), ('yüz bin', '100000')]:
        s = s.replace(w, d)
    s = re.sub(r'[^a-zçğıöşü ]', ' ', s)  # drop digits entirely after mapping, compare words only
    return ' '.join(s.split())

def check(path, text):
    segs, _ = asr.transcribe(path, language='tr', beam_size=3, word_timestamps=True)
    words = [w for s in segs for w in s.words]
    heard = ' '.join(w.word for w in words)
    a, b = norm(text), norm(heard)
    score = difflib.SequenceMatcher(None, a, b).ratio()
    return score, heard, words

def trim(path, words, sr):
    w, s = ta.load(path)
    if words:
        # cut after the last word that still belongs to the script length (avoid repeated tail words)
        end = words[-1].end
        w = w[:, : int(min(w.shape[1], (end + 0.28) * s))]
        start = max(0.0, words[0].start - 0.12)
        w = w[:, int(start * s):]
    ta.save(path, w, s)

report = []
import os, sys
START = int(sys.argv[1]) if len(sys.argv) > 1 else 0
for i, (text, pause) in enumerate(lines):
    if i < START: continue
    path = f'vo/line_{i:02d}.wav'
    best = (-1, '', []); best_seed = None
    tries = 0
    while best[0] < 0.88 and tries < 3:
        if tts is None: tts = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
        seed = 5000 + i * 17 + tries; torch.manual_seed(seed)
        wav = tts.generate(text, language_id='tr', exaggeration=0.85, cfg_weight=0.3, temperature=0.75)
        cand = f'vo/cand_{i:02d}_{tries}.wav'; ta.save(cand, wav, tts.sr)
        res = check(cand, text)
        if res[0] > best[0]:
            best, best_seed = res, seed
            ta.save(path, *ta.load(cand))
        tries += 1
    # for the one-word title line keep only the first occurrence
    words = best[2]
    if i == 1 and words:
        words = [w for w in words if 'megal' in w.word.lower()][:1] or words[:1]
    trim(path, words, None)
    report.append({'i': i, 'score': round(best[0], 3), 'seed': best_seed, 'heard': best[1].strip()})
    print(i, round(best[0], 3), best_seed, '|', best[1].strip(), flush=True)
json.dump(report, open(f'vo/check_{START}.json', 'w'), ensure_ascii=False, indent=1)
