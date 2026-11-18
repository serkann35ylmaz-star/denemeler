#!/usr/bin/env python3
"""Toplu GTA 6 kesiti: Kick'te şu an GTA 6 oynayan en popüler yayıncıların bugünkü en çok izlenen kesitleri
-> canli.py ile 9:16 (kamera üstte / oyun altta ya da tek parça), Türkçe altyazı, kapak, başlık.

  python3 gta_toplu.py [toplam=15] [--yayinci-basina 2] [--yayinci 12] [--oyun regex]
Önce listeyi gösterir (out/gta-adaylar.md), sonra sırayla üretir. Daha önce işlenen kesitler atlanır (islenenler.json).
"""
import json, os, re, subprocess, sys, time
import kesit
from kesit import opt, log, OUT

PER = int(opt('--yayinci-basina', '2'))
NSTREAM = int(opt('--yayinci', '12'))
GTA_RE = opt('--oyun', r'grand theft auto vi\b|\bgta ?(6|vi)\b')
TOPLAM = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 15

live = kesit.kick_canli(GTA_RE, None, NSTREAM)
log(f'Kick\'te GTA 6 oynayan ilk {len(live)} yayıncı: ' + ', '.join(f"{s['ad']} ({s['izleyici']:,})" for s in live))
done = kesit.load_state()
cands = []
for s in live:
    clips, err = kesit.list_clips({'platform': 'kick', 'kanal': s['kanal'], 'ad': s['ad']})
    if clips is None:
        log(f"- {s['ad']}: kesit listesi alınamadı ({err})"); continue
    ok = [c for c in clips if re.search(GTA_RE, c['oyun'], re.I) and 8 <= c['sure'] <= 90 and c['id'] not in done]
    ok.sort(key=lambda c: -c['izlenme'])
    for c in ok[:PER]:
        c['canli_izleyici'] = s['izleyici']; cands.append(c)
    log(f"- {s['ad']}: {len(ok)} GTA 6 kesiti, en iyisi {ok[0]['izlenme']:,} izlenme" if ok else f"- {s['ad']}: uygun kesit yok")
cands.sort(key=lambda c: -c['izlenme'])
cands = cands[:TOPLAM]
md = ['# GTA 6 kesit adayları', '', '| # | yayıncı | izlenme | süre | başlık |', '|---|---|---|---|---|']
md += [f"| {i} | {c['ad']} | {c['izlenme']:,} | {c['sure']:.0f} sn | [{c['baslik'][:50]}]({c['url']}) |" for i, c in enumerate(cands, 1)]
open(f'{OUT}/gta-adaylar.md', 'w', encoding='utf-8').write('\n'.join(md) + '\n')
log(f'{len(cands)} kesit üretilecek -> {OUT}/gta-adaylar.md')

for i, c in enumerate(cands, 1):
    log(f"\n[{i}/{len(cands)}] {c['ad']} · {c['izlenme']:,} izlenme · {c['url']}")
    try:
        src = kesit.download(c)
        r = subprocess.run([sys.executable, 'canli.py', src, '--ad', c['ad'], '--kategori', c['oyun'] or 'Grand Theft Auto VI',
                            '--tamami', '--isim', c['id'][-8:].lower()], capture_output=True, text=True)
        out = [l for l in r.stdout.splitlines() if l.startswith(('düzen:', 'video:', 'kapak:'))]
        log('  ' + ' | '.join(out) if r.returncode == 0 else '  ✗ ' + (r.stderr.strip().splitlines() or ['hata'])[-1][:200])
        if r.returncode == 0:
            # kaynak bilgisi açıklamaya
            vid = next((l.split(': ', 1)[1] for l in out if l.startswith('video:')), None)
            if vid and os.path.exists(vid[:-4] + '.md'):
                t = open(vid[:-4] + '.md', encoding='utf-8').read()
                t = t.replace('Kaynak: Kick ·', f"Kaynak: Kick · {c['url']} ·", 1)
                open(vid[:-4] + '.md', 'w', encoding='utf-8').write(t)
            st = kesit.load_state(); st[c['id']] = {'zaman': time.strftime('%Y-%m-%d'), 'dosya': vid, 'url': c['url']}
            json.dump(st, open(kesit.STATE, 'w'), ensure_ascii=False, indent=1)
        if os.path.exists(src):
            os.remove(src)
    except Exception as e:
        log(f'  ✗ atlandı: {str(e).splitlines()[0][:150]}')
kesit.ozet(time.strftime('%Y-%m-%d'))
log('BITTI')
