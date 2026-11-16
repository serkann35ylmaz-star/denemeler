#!/usr/bin/env python3
"""Bir görseli kısa, gerçekten hareketli bir klibe çevirir (görselden videoya yapay zekâ).

Model: LTX-Video 2B 0.9.8 distilled (Lightricks, açık ağırlık), metin kodlayıcı: T5-XXL fp8.
Ekran kartı gerekmez; CPU'da çalışır ama yavaştır (kısa bir klip ~10-30 dk). Bu yüzden her bölümde
yalnızca önemli 2-3 çekim için kullan; diğerleri 2.5D katman animasyonuyla kalsın.

Kurulum (bir kez):  python3 -m venv --system-site-packages ~/.venvs/video
                    ~/.venvs/video/bin/pip install "diffusers==0.43.0" "safetensors>=0.6" sentencepiece imageio imageio-ffmpeg
Kullanım:           ~/.venvs/video/bin/python canlandir.py gorseller/x/01.jpg "ne hareket etsin" [kare=49] [genislik=448]
Çıktı:              gorseller/x/01.mp4  -> motor bu klibi görselin yerine kendiliğinden oynatır.
"""
import gc, os, sys, time

CA = '/root/.ccr/ca-bundle.crt'
if os.path.exists(CA):
    for k in ('SSL_CERT_FILE', 'REQUESTS_CA_BUNDLE'):
        os.environ.setdefault(k, CA)

import torch
from PIL import Image

img_path, motion = sys.argv[1], sys.argv[2]
frames = int(sys.argv[3]) if len(sys.argv) > 3 else 49          # 8n+1 olmalı: 25, 49, 73...
width = int(sys.argv[4]) if len(sys.argv) > 4 else 448           # 32'nin katı
torch.set_num_threads(os.cpu_count() or 4)
t0 = time.time()
log = lambda m: print(f'[{time.time() - t0:5.0f} sn] {m}', flush=True)

from huggingface_hub import hf_hub_download, snapshot_download
cfg = snapshot_download('Lightricks/LTX-Video-0.9.5', allow_patterns=['model_index.json', 'scheduler/*', 'tokenizer/*',
                        'text_encoder/config.json', 'transformer/config.json', 'vae/config.json'])
ckpt = hf_hub_download('Lightricks/LTX-Video', 'ltxv-2b-0.9.8-distilled.safetensors')
t5_file = hf_hub_download('comfyanonymous/flux_text_encoders', 't5xxl_fp8_e4m3fn.safetensors')

STYLE = ('Hand-drawn graphic-novel animation, bold ink outlines, consistent character design, '
         'smooth natural motion, cinematic lighting, stable camera.')
prompt = f'{motion}. {STYLE}'
negative = 'worst quality, inconsistent motion, blurry, jittery, distorted, morphing face, extra limbs, text, watermark'

# 1) metni kodla, sonra T5'i bellekten at (bf16 ~9.5 GB)
log('metin kodlanıyor')
from safetensors.torch import load_file
from transformers import T5EncoderModel, T5Config, AutoTokenizer
tok = AutoTokenizer.from_pretrained(cfg, subfolder='tokenizer')
with torch.device('meta'):
    t5 = T5EncoderModel(T5Config.from_pretrained(cfg, subfolder='text_encoder'))
sd = {k: v.to(torch.bfloat16) for k, v in load_file(t5_file).items()}
if 'encoder.embed_tokens.weight' not in sd and 'shared.weight' in sd:
    sd['encoder.embed_tokens.weight'] = sd['shared.weight']
t5.load_state_dict(sd, strict=False, assign=True)
del sd; t5.eval()

def encode(text):
    ids = tok(text, padding='max_length', max_length=128, truncation=True, return_tensors='pt')
    with torch.inference_mode():
        e = t5(ids.input_ids, attention_mask=ids.attention_mask)[0]
    return e.float(), ids.attention_mask

pe, pm = encode(prompt)
ne, nm = encode(negative)
del t5; gc.collect()

# 2) video modeli (float32: CPU'da bf16'dan daha hızlı ve kararlı)
log('video modeli yükleniyor')
from diffusers import AutoencoderKLLTXVideo, LTXVideoTransformer3DModel, FlowMatchEulerDiscreteScheduler
from diffusers.pipelines.ltx.pipeline_ltx_condition import LTXConditionPipeline, LTXVideoCondition
from diffusers.utils import export_to_video
tr = LTXVideoTransformer3DModel.from_single_file(ckpt, config=cfg, subfolder='transformer', torch_dtype=torch.float32)
vae = AutoencoderKLLTXVideo.from_single_file(ckpt, config=cfg, subfolder='vae', torch_dtype=torch.float32)
pipe = LTXConditionPipeline(scheduler=FlowMatchEulerDiscreteScheduler.from_pretrained(cfg, subfolder='scheduler'),
                            vae=vae, text_encoder=None, tokenizer=tok, transformer=tr)

vae.enable_tiling()  # kareleri parça parça aç: bellek yetsin

def step_end(p, i, t, kw):
    log(f'adım {i + 1}/8')
    if i == 7:  # gürültü giderme bitti: 8 GB'lık modeli bırak, kod çözme için yer aç
        for prm in p.transformer.parameters():
            prm.data = torch.empty(0)
        gc.collect()
    return kw

src = Image.open(img_path).convert('RGB')
height = round(width * src.height / src.width / 32) * 32
src = src.resize((width, height), Image.LANCZOS)
log(f'üretiliyor: {width}x{height}, {frames} kare')
video = pipe(conditions=[LTXVideoCondition(image=src, frame_index=0)],
             prompt_embeds=pe, prompt_attention_mask=pm, negative_prompt_embeds=ne, negative_prompt_attention_mask=nm,
             width=width, height=height, num_frames=frames,
             timesteps=[1000, 993, 987, 981, 975, 909, 725, 0.03],  # distilled modelin 8 adımlık takvimi
             guidance_scale=1.0, decode_timestep=0.05, decode_noise_scale=0.025, image_cond_noise_scale=0.0,
             generator=torch.Generator().manual_seed(42), output_type='pil',
             callback_on_step_end=step_end).frames[0]
out = os.path.splitext(img_path)[0] + '.mp4'
export_to_video(video, out, fps=24)
log(f'bitti -> {out}')
