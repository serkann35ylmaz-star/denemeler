import time, torch, torchaudio as ta, sys
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
torch.manual_seed(7)
t=time.time(); m=ChatterboxMultilingualTTS.from_pretrained(device='cpu'); print('load',round(time.time()-t,1),flush=True)
t=time.time()
w=m.generate("Okyanusun derinliklerinde, ışığın hiç ulaşamadığı yerlerde, insanlar hâlâ bir ismi fısıldıyor: Megalodon.", language_id='tr', exaggeration=0.45, cfg_weight=0.4)
ta.save(sys.argv[1], w, m.sr); print('gen',round(time.time()-t,1),'dur',round(w.shape[-1]/m.sr,1),flush=True)
