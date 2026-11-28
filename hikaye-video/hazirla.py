#!/usr/bin/env python3
"""Görselleri animasyona hazırlar (hepsi açık kaynak, CPU'da çalışır, ücretsiz):

  1. Karakter/özne kesimi  - rembg + IS-Net (MIT)            -> 01.fg.png  (saydam katman)
  2. Arka plan onarımı     - LaMa (Apache-2.0)                -> 01.bg.jpg  (özne silinmiş arka plan)
  3. Derinlik haritası     - Depth Anything V2 Small (Apache) -> 01.depth.png

Motor bu dosyaları görünce arka planı derinliğe göre 2.5D kaydırır, karakteri ayrı katman olarak
oynatır (nefes, yürüme, sürüş, titreme...). Sahnede "oynat": "yok" ya da hazirla atlanırsa düz görsel kullanılır.
Bir görselde özne kesilmesin istiyorsan olayda/sahnede "katman": false yaz.

Kullanım: python3 hazirla.py [hikaye.json]
"""
import json, os, sys

CA = '/root/.ccr/ca-bundle.crt'
if os.path.exists(CA):
    for k in ('SSL_CERT_FILE', 'REQUESTS_CA_BUNDLE'):
        os.environ.setdefault(k, CA)

import numpy as np
from PIL import Image, ImageFilter

story = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'hikaye.json', encoding='utf-8'))
shots = {}
for sc in story['sahneler']:
    for o in [sc] + sc.get('olaylar', []):
        if o.get('gorsel'):
            shots.setdefault(o['gorsel'], o.get('katman', sc.get('katman', True)))

_m = {}
def model(name):
    if name in _m:
        return _m[name]
    if name == 'kes':
        from rembg import new_session
        _m[name] = new_session('isnet-general-use')
    elif name == 'onar':
        import torch
        from simple_lama_inpainting.utils import download_model
        from simple_lama_inpainting.models.model import LAMA_MODEL_URL
        _m[name] = torch.jit.load(download_model(LAMA_MODEL_URL), map_location='cpu').eval()  # CPU'ya zorla
    elif name == 'derinlik':
        from transformers import pipeline
        _m[name] = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', device='cpu')
    return _m[name]


def inpaint(im, mask):
    import torch
    from simple_lama_inpainting.utils import prepare_img_and_mask
    W, H = im.size
    s = 960 / max(W, H)  # hız için küçült, sonra büyüt
    w, h = int(W * s) // 8 * 8, int(H * s) // 8 * 8
    x, m = prepare_img_and_mask(im.resize((w, h)), mask.resize((w, h)), torch.device('cpu'))
    with torch.inference_mode():
        r = model('onar')(x, m)[0].permute(1, 2, 0).numpy()
    small = Image.fromarray(np.clip(r * 255, 0, 255).astype('uint8'))
    # onarılmış küçük görseli yalnızca maske bölgesine koy, geri kalan orijinal çözünürlükte kalsın
    return Image.composite(small.resize((W, H), Image.LANCZOS), im, mask.filter(ImageFilter.GaussianBlur(6)))


for p, layer in shots.items():
    if not os.path.exists(p):
        print('eksik görsel:', p); continue
    base = os.path.splitext(p)[0]
    im = Image.open(p).convert('RGB')
    if layer and not os.path.exists(base + '.fg.png'):
        from rembg import remove
        cut = remove(im, session=model('kes'))
        a = np.array(cut)[:, :, 3]
        cover = (a > 128).mean()
        if 0.01 < cover < 0.6:
            cut.save(base + '.fg.png')
            mask = Image.fromarray(((a > 16) * 255).astype('uint8')).filter(ImageFilter.MaxFilter(31))
            inpaint(im, mask).save(base + '.bg.jpg', quality=92)
            print(f'katman: {p}  (özne %{cover * 100:.0f})')
        else:
            print(f'katman yok: {p}  (özne %{cover * 100:.0f}, uygun değil)')
    if not os.path.exists(base + '.depth.png'):
        src = Image.open(base + '.bg.jpg') if os.path.exists(base + '.bg.jpg') else im
        d = model('derinlik')(src)['depth'].resize(im.size).filter(ImageFilter.GaussianBlur(3))
        d.save(base + '.depth.png')
        print('derinlik:', p)
print('hazır')
