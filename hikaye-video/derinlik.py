#!/usr/bin/env python3
"""Hikayedeki her görsel için derinlik haritası çıkarır (Depth Anything V2 Small, Apache-2.0, CPU'da birkaç saniye).
gorseller/x/01.jpg -> gorseller/x/01.depth.png. Motor bunu görür ve görsele 2.5D hareket verir:
kamera ilerledikçe öndeki nesneler arkadakilerden daha çok kayar.
Kullanım: python3 derinlik.py [hikaye.json]
"""
import json, os, sys

CA = '/root/.ccr/ca-bundle.crt'
if os.path.exists(CA):
    for k in ('SSL_CERT_FILE', 'REQUESTS_CA_BUNDLE'):
        os.environ.setdefault(k, CA)

story = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'hikaye.json', encoding='utf-8'))
imgs = []
for sc in story['sahneler']:
    imgs += [sc.get('gorsel')] + [e.get('gorsel') for e in sc.get('olaylar', [])]
todo = [p for p in dict.fromkeys(filter(None, imgs)) if os.path.exists(p) and not os.path.exists(os.path.splitext(p)[0] + '.depth.png')]
if not todo:
    sys.exit(print('Derinlik haritaları hazır.'))
from PIL import Image, ImageFilter
from transformers import pipeline
pipe = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', device='cpu')
for p in todo:
    im = Image.open(p).convert('RGB')
    d = pipe(im)['depth'].resize(im.size).filter(ImageFilter.GaussianBlur(3))  # yumuşak kenar = daha az yırtılma
    d.save(os.path.splitext(p)[0] + '.depth.png')
    print('derinlik:', p)
