# Lay out the verified lines with pauses, process the voice (deeper, warm, a little cavernous) and write timings.js.
import json, subprocess, wave, os
lines = json.load(open('script.json'))
lead, sr = 1.6, 24000
t, timings, parts = lead, [], []
os.makedirs('vo/tmp', exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'anullsrc=r={sr}:cl=mono', '-t', str(lead), 'vo/tmp/lead.wav'], check=True)
parts.append('vo/tmp/lead.wav')
for i, (text, pause) in enumerate(lines):
    p = f'vo/line_{i:02d}.wav'
    with wave.open(p) as w: d = w.getnframes() / w.getframerate()
    timings.append({'i': i, 'text': text, 'start': round(t, 3), 'end': round(t + d, 3)})
    sil = f'vo/tmp/sil_{i:02d}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'anullsrc=r={sr}:cl=mono', '-t', str(pause), sil], check=True)
    parts += [p, sil]; t += d + pause
open('vo/tmp/list.txt', 'w').write(''.join(f"file '{os.path.abspath(x)}'\n" for x in parts))
af = 'equalizer=f=110:t=q:w=1:g=2,loudnorm=I=-16:TP=-1.5'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'vo/tmp/list.txt', '-af', af, '-ar', '48000', 'vo/narration.wav'], check=True)
open('timings.js', 'w').write('window.TIMINGS = ' + json.dumps({'total': round(t, 3), 'lines': timings}, ensure_ascii=False) + ';\n')
print('total', round(t, 2))
