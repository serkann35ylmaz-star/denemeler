#!/usr/bin/env python3
"""ADA 9 görsel üretim kuyruğu.
  python3 kuyruk.py               -> sıradaki işler + durum özeti
  python3 kuyruk.py set <dosya> <alan>=<değer> ...   (ör. durum=uretildi media=MAH...)
Durumlar: bekliyor -> uretildi (media) -> tasarim (design) -> tamam (gorseller/ada9/...jpg indirildi)
"""
import json, sys, os
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uretim-kuyrugu.json')
q = json.load(open(P))
if len(sys.argv) > 2 and sys.argv[1] == 'set':
    o = next(o for o in q if o['dosya'].endswith(sys.argv[2]))
    for kv in sys.argv[3:]:
        k, v = kv.split('=', 1); o[k] = v
    json.dump(q, open(P, 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(dict(Counter(o['durum'] for o in q)))
for o in q:
    if o['durum'] != 'tamam':
        print(o['dosya'].split('/')[-1], o['durum'], o.get('media', ''), o.get('design', ''), 'KEMAL' if o['kemal'] else '')
if len(sys.argv) > 1 and sys.argv[1] == 'prompt':
    print(next(o for o in q if o['dosya'].endswith(sys.argv[2]))['prompt'])
