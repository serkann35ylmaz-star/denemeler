# Voice every line with Chatterbox Multilingual (Turkish), deterministic seeds, then lay them out with pauses.
import json, sys, torch, torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
lines = json.load(open('script.json'))
m = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
lead = 1.5  # seconds of silence before the first line (video opens on the ocean)
out, cur, timings = [], lead, []
sr = m.sr
for i, (text, pause) in enumerate(lines):
    torch.manual_seed(1000 + i)
    w = m.generate(text, language_id='tr', exaggeration=0.5, cfg_weight=0.35, temperature=0.7)
    ta.save(f'vo/line_{i:02d}.wav', w, sr)
    d = w.shape[-1] / sr
    timings.append({'i': i, 'text': text, 'start': round(cur, 3), 'end': round(cur + d, 3)})
    cur += d + pause
    print(i, round(d, 2), flush=True)
json.dump({'sr': sr, 'lead': lead, 'total': round(cur, 3), 'lines': timings}, open('vo/timings.json', 'w'), ensure_ascii=False, indent=1)
print('total', round(cur, 2))
