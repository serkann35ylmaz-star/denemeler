#!/usr/bin/env python3
"""GTA 6 (ya da herhangi bir oyun) yayın kesitlerinden Türkçe altyazılı 9:16 Shorts/TikTok videoları.

  python3 kesit.py analiz            yayıncıların son kesitlerini tara, oyuna göre süz, viral puanla sırala
                                     -> out/rapor.md, out/adaylar.json
  python3 kesit.py uret [adet]       sıradaki işlenmemiş en iyi kesitleri videoya çevir -> out/videolar/
  python3 kesit.py hepsi [adet]      ikisi birden
  python3 kesit.py url <URL> [ad]    belirli bir kesiti (Twitch/Kick kesit ya da video bağlantısı) işle
                                     uzun videodan bölüm için:  --bas 1:02:10 --son 1:02:55
Seçenekler: --oyun "regex"  (ayarlar.json'daki oyun süzgecini geçici değiştirir, ör. "grand theft auto v\\b")
            --aralik 24hr|7d|30d|all

Viral puan = izlenme / (saat cinsinden yaş + 2)^0.6  -> hem çok izlenen hem taze kesitler öne çıkar.
Her video üzerinde yayıncı kredisi bulunur; açıklama metninde kaynak bağlantısı verilir.
"""
import json, math, os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
CA = '/root/.ccr/ca-bundle.crt'
if os.path.exists(CA):
    for k in ('SSL_CERT_FILE', 'REQUESTS_CA_BUNDLE'):
        os.environ.setdefault(k, CA)

os.environ.setdefault('TRANSFORMERS_VERBOSITY', 'error'); os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS', '1')
import yt_dlp

AY = json.load(open('ayarlar.json', encoding='utf-8'))
OUT = 'out'
os.makedirs(f'{OUT}/videolar', exist_ok=True); os.makedirs(f'{OUT}/indirilen', exist_ok=True)
STATE = f'{OUT}/islenenler.json'


def opt(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name); v = sys.argv[i + 1]; del sys.argv[i:i + 2]; return v
    return default


SOZLUK = AY.get('sozluk', {})
OYUN_ADI = AY.get('oyunAdi', 'GTA 6')
# Küfür: başlıkta bu cümleler seçilmez; "sansur": true ise altyazıda ilk harf dışı yıldızlanır
KUFUR = re.compile(r'\b(sik(ik\w*|tir\w*|im|in|eyim|ini|iş\w*|er)?|amk|amına\w*|orospu\w*|piç(ler\w*)?|yarra\w*|göt(ü|ün|ünü|veren\w*|lek\w*)?|kahpe\w*|ibne\w*|pezevenk\w*|fuck\w*|shit\w*)(?=\W|$)', re.I)
SANSUR = AY.get('sansur', True)
OYUN = re.compile(opt('--oyun', AY['oyun']), re.I)
ARALIK = opt('--aralik', AY.get('aralik', '7d'))
BAS, SON = opt('--bas'), opt('--son')
log = lambda *a: print(*a, flush=True)


def ydl(extra=None):
    o = {'quiet': True, 'no_warnings': True, 'skip_download': True}
    o.update(extra or {})
    return yt_dlp.YoutubeDL(o)


# ---------------- 1) analiz ----------------
def list_clips(y):
    url = (f"https://www.twitch.tv/{y['kanal']}/clips?filter=clips&range={ARALIK}" if y['platform'] == 'twitch'
           else f"https://kick.com/{y['kanal']}/clips")
    try:
        info = ydl({'extract_flat': True, 'playlistend': AY.get('kanalBasinaKesit', 15)}).extract_info(url, download=False)
    except Exception as e:
        return None, str(e).splitlines()[0][:120]
    out = []
    for e in info.get('entries') or []:
        if not e or not e.get('url'):
            continue
        cats = e.get('categories')
        if y['platform'] == 'twitch' and not cats:  # Twitch listesinde oyun yok: kesitin kendisinden al
            try:
                cats = ydl().extract_info(e['url'], download=False).get('categories')
            except Exception:
                continue
        out.append({'id': f"{y['platform']}-{e['id']}", 'url': e['url'], 'baslik': e.get('title') or '',
                    'izlenme': int(e.get('view_count') or 0), 'sure': float(e.get('duration') or 0),
                    'zaman': int(float(e.get('timestamp') or time.time())), 'oyun': ', '.join(cats or []),
                    'platform': y['platform'], 'kanal': y['kanal'], 'ad': y.get('ad', y['kanal']), 'izin': y.get('izin', False),
                    'facecam': y.get('facecam')})
    return out, None


def analiz():
    allc, rows = [], []
    for y in AY['yayincilar']:
        clips, err = list_clips(y)
        if clips is None:
            rows.append((y, 0, 0, 0, f'erişilemedi: {err}')); log(f"- {y['platform']}/{y['kanal']}: erişilemedi"); continue
        game = [c for c in clips if OYUN.search(c['oyun']) and AY['minSure'] <= c['sure'] <= AY['maxSure']
                and c['izlenme'] >= AY['minIzlenme']]
        for c in game:
            age = max(0, (time.time() - c['zaman']) / 3600)
            c['puan'] = round(c['izlenme'] / (age + 2) ** 0.6, 1)
        allc += game
        rows.append((y, len(clips), len(game), sum(c['izlenme'] for c in game), ''))
        log(f"- {y['platform']}/{y['kanal']}: {len(clips)} kesit, {len(game)} tanesi oyunla eşleşti")
    allc.sort(key=lambda c: -c['puan'])
    json.dump(allc, open(f'{OUT}/adaylar.json', 'w'), ensure_ascii=False, indent=1)
    done = load_state()
    md = [f'# Yayıncı analizi ({time.strftime("%Y-%m-%d %H:%M")}, aralık {ARALIK}, oyun süzgeci `{OYUN.pattern}`)', '',
          '| yayıncı | platform | taranan kesit | oyun kesiti | toplam izlenme | izin | not |', '|---|---|---|---|---|---|---|']
    for y, n, g, v, note in sorted(rows, key=lambda r: -r[3]):
        md.append(f"| {y.get('ad')} | {y['platform']} | {n} | {g} | {v:,} | {'var' if y.get('izin') else 'yok'} | {note} |")
    md += ['', '## En viral kesitler', '', '| # | puan | izlenme | yayıncı | başlık | süre | durum |', '|---|---|---|---|---|---|---|']
    for i, c in enumerate(allc[:30], 1):
        md.append(f"| {i} | {c['puan']} | {c['izlenme']:,} | {c['ad']} ({c['platform']}) | [{c['baslik'][:50]}]({c['url']}) | {c['sure']:.0f} sn | {'işlendi' if c['id'] in done else 'sırada'} |")
    open(f'{OUT}/rapor.md', 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    log(f'{len(allc)} aday -> {OUT}/rapor.md')
    return allc


def load_state():
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


# ---------------- 2) indir + yazıya dök + çevir ----------------
_asr = _mt = None


def download(c):
    o = {'quiet': True, 'no_warnings': True, 'noprogress': True, 'format': 'best[height<=1080]/best',
         'outtmpl': f"{OUT}/indirilen/{c['id']}.%(ext)s", 'merge_output_format': 'mp4'}
    if BAS and SON:
        from yt_dlp.utils import download_range_func, parse_duration
        o['download_ranges'] = download_range_func(None, [(parse_duration(BAS), parse_duration(SON))])
        o['force_keyframes_at_cuts'] = True
    with yt_dlp.YoutubeDL(o) as d:
        info = d.extract_info(c['url'], download=True)
        return d.prepare_filename(info)


def pcm16(path):
    import numpy as np
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def transcribe_tr(path):
    """Türkçe altyazı kelimeleri: [(kelime, başlangıç, bitiş)]. Türkçe değilse cümle cümle çevirir."""
    global _asr, _mt
    from faster_whisper import WhisperModel
    if _asr is None:
        _asr = WhisperModel('small', device='cpu', compute_type='int8')
    audio = pcm16(path)
    segs, info = _asr.transcribe(audio, word_timestamps=True, vad_filter=True)
    segs = list(segs)
    lang = info.language
    if lang == 'tr':
        return lang, [(w.word.strip(), w.start, w.end) for s in segs for w in s.words if w.word.strip()]
    if lang != 'en':  # önce İngilizceye (Whisper), sonra Türkçeye
        segs = list(_asr.transcribe(audio, task='translate', vad_filter=True)[0])
    texts = [s.text.strip() for s in segs if s.text.strip()]
    if not texts:
        return lang, []
    if _mt is None:
        from transformers import MarianMTModel, MarianTokenizer
        name = 'Helsinki-NLP/opus-mt-tc-big-en-tr'
        from transformers.utils import logging as tl
        tl.disable_progress_bar()
        _mt = (MarianTokenizer.from_pretrained(name), MarianMTModel.from_pretrained(name).eval())
    tok, model = _mt
    import torch
    with torch.inference_mode():
        b = tok(texts, return_tensors='pt', padding=True, truncation=True)
        tr = tok.batch_decode(model.generate(**b, num_beams=4, max_new_tokens=128), skip_special_tokens=True)
    words, i = [], 0
    for s in segs:
        if not s.text.strip():
            continue
        t = [SOZLUK.get(w.strip('.,!?…'), w.strip('.,!?…')) + w[len(w.strip('.,!?…')):] if w.strip('.,!?…') in SOZLUK else w
             for w in tr[i].split()]; i += 1  # yayın argosu: düz çeviriyi düzelt (ayarlar.json > sozluk)
        tot = sum(len(w) + 1 for w in t) or 1; acc = 0
        for w in t:  # çeviride kelime zamanı yok: segment süresini harf sayısına göre dağıt
            a = s.start + (s.end - s.start) * acc / tot; acc += len(w) + 1
            words.append((w, a, s.start + (s.end - s.start) * acc / tot))
    return lang, words


# ---------------- 3) 9:16 kurgu + altyazı ----------------
def ass_time(t):
    return f'{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}'


def esc(s):
    return s.replace('\\', '').replace('{', '(').replace('}', ')')


def chunks(words):
    out, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= 3 or len(' '.join(x[0] for x in cur)) >= 16 or re.search(r'[.!?,…]$', w[0]):
            out.append(cur); cur = []
    if cur:
        out.append(cur)
    return out


def make_ass(words, c, sub_y, credit_y, path):
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Alt,Poppins Black,76,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,7,3,5,60,60,0,1
Style: Kredi,Poppins ExtraBold,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&H9E000000,0,0,0,0,100,100,0,0,3,14,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    cs = chunks(words)
    for ci, ch in enumerate(cs):
        end = cs[ci + 1][0][1] if ci + 1 < len(cs) else ch[-1][2] + .4
        end = min(end, ch[-1][2] + .8)
        for wi, (w, a, b) in enumerate(ch):  # o an söylenen kelime sarı, diğerleri beyaz
            s = ch[0][1] if wi == 0 else a
            e = ch[wi + 1][1] if wi + 1 < len(ch) else end
            if e <= s:
                continue
            txt = ' '.join(('{\\c&H00D7FF&}' + esc(x[0]) + '{\\c&HFFFFFF&}') if j == wi else esc(x[0]) for j, x in enumerate(ch))
            pop = '{\\fscx112\\fscy112\\t(0,90,\\fscx100\\fscy100)}' if wi == 0 else ''
            ev.append(f'Dialogue: 1,{ass_time(s)},{ass_time(e)},Alt,,0,0,0,,{{\\pos(540,{sub_y})}}{pop}{txt.upper() if False else txt}')
    plat = 'Twitch' if c['platform'] == 'twitch' else 'Kick'
    ev.append(f"Dialogue: 0,{ass_time(0)},{ass_time(9999)},Kredi,,0,0,0,,{{\\pos(540,{credit_y})}}{esc(c['ad'])} • {plat}: {c['platform']}.{'tv' if plat == 'Twitch' else 'com'}/{c['kanal']}")
    open(path, 'w', encoding='utf-8').write(head + '\n'.join(ev) + '\n')


def render(src, c, words, out):
    import shlex
    W, H = 1080, 1920
    probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                                       '-of', 'json', src], capture_output=True, check=True).stdout)['streams'][0]
    sw, sh = probe['width'], probe['height']
    fc = c.get('facecam')
    if fc and AY.get('duzen') != 'blur-zorla':  # üstte yüz kamerası, altta oyun
        fx, fy, fw, fh = [round(v * d) for v, d in zip(fc, (sw, sh, sw, sh))]
        top = min(720, round(W * fh / fw) // 2 * 2)
        bot = H - top
        gw = round(sh * W / bot) // 2 * 2  # oyun görüntüsünden ortalanmış dikey dilim
        vf = (f"[0:v]split[a][b];[a]crop={fw}:{fh}:{fx}:{fy},scale={W}:{top}[t];"
              f"[b]crop={min(gw, sw)}:{sh}:(iw-{min(gw, sw)})/2:0,scale={W}:{bot}[g];[t][g]vstack[v0]")
        sub_y, credit_y = top + 120, H - 90
    else:  # bulanık arka plan + yakınlaştırılmış oyun ortada
        z = AY.get('yakinlik', 1.3)
        fw2 = round(W * z) // 2 * 2
        vf = (f"[0:v]split[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=28:2,eq=brightness=-0.18[bg];"
              f"[b]scale={fw2}:-2,crop={W}:ih[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2-60[v0]")
        fg_h = round(fw2 * sh / sw)
        sub_y, credit_y = (H + fg_h) // 2 + 60, (H - fg_h) // 2 - 130
    ass = out[:-4] + '.ass'
    make_ass(words, c, sub_y, credit_y, ass)
    vf += f";[v0]ass={shlex.quote(ass)}:fontsdir=fonts[v]"
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', src, '-filter_complex', vf, '-map', '[v]', '-map', '0:a?',
           '-t', str(AY['maxSure']), '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    os.remove(ass)


def meta(c, words, out_md):
    text = ' '.join(w[0] for w in words)
    sents = [x for x in re.split(r'(?<=[.!?])\s', text.strip()) if len(x.split()) >= 4 and not KUFUR.search(x)] if text else []
    first = (sents[0] if sents else text or c['baslik'])[:70].rstrip(' ,')
    plat = 'Twitch' if c['platform'] == 'twitch' else 'Kick'
    tag = re.sub(r'\W', '', c['ad'])
    md = f"""# {c['ad']} · {c['baslik']}

**Başlık önerisi:** {c['ad']} {OYUN_ADI}'da: "{first}" 😳
**Açıklama:**
{c['ad']} yayınından bir an 🎮 Türkçe altyazılı.
Kaynak: {plat} · {c['platform']}.{'tv' if plat == 'Twitch' else 'com'}/{c['kanal']} · {c['url']}
#GTA6 #GTAVI #{tag} #shorts #gta #oyun #yayın #keşfet

İzlenme (kaynak): {c['izlenme']:,} · Süre: {c['sure']:.0f} sn · Yayıncı izni kayıtlı: {'evet' if c['izin'] else 'HAYIR'}

Altyazı metni: {text}
"""
    open(out_md, 'w', encoding='utf-8').write(md)


def process(c):
    log(f"\n▶ {c['ad']} ({c['platform']}) · {c['baslik'][:60]} · {c['url']}")
    src = download(c)
    log('  indirildi, yazıya dökülüyor...')
    lang, words = transcribe_tr(src)
    if SANSUR:
        words = [(KUFUR.sub(lambda m: m.group(0)[0] + '*' * (len(m.group(0)) - 1), w), a, b) for w, a, b in words]
    log(f'  dil: {lang}, {len(words)} Türkçe kelime')
    day = time.strftime('%Y-%m-%d')
    os.makedirs(f'{OUT}/videolar/{day}', exist_ok=True)
    base = f"{OUT}/videolar/{day}/{re.sub(r'[^a-z0-9]+', '-', c['ad'].lower())}-{c['id'][-10:]}"
    render(src, c, words, base + '.mp4')
    meta(c, words, base + '.md')
    os.remove(src)
    st = load_state(); st[c['id']] = {'zaman': day, 'dosya': base + '.mp4', 'url': c['url']}
    json.dump(st, open(STATE, 'w'), ensure_ascii=False, indent=1)
    log(f'  ✓ {base}.mp4')
    return base + '.mp4'


def uret(n):
    cands = json.load(open(f'{OUT}/adaylar.json')) if os.path.exists(f'{OUT}/adaylar.json') else analiz()
    done = load_state()
    todo = [c for c in cands if c['id'] not in done][:n]
    if not todo:
        log('İşlenecek yeni kesit yok. (Oyun henüz yayında değilse süzgeç boş döner; --oyun ile değiştirilebilir.)')
    made = []
    for c in todo:
        try:
            made.append(process(c))
        except Exception as e:
            log(f'  ✗ atlandı: {str(e).splitlines()[0][:150]}')
    return made


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'hepsi'
    n = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else AY.get('uretilecek', 5)
    if cmd == 'analiz':
        analiz()
    elif cmd == 'uret':
        uret(n)
    elif cmd == 'hepsi':
        analiz(); uret(n)
    elif cmd == 'url':
        url = sys.argv[2]; ad = sys.argv[3] if len(sys.argv) > 3 else 'Yayıncı'
        plat = 'kick' if 'kick.com' in url else 'twitch'
        kanal = (re.search(r'(?:twitch\.tv|kick\.com)/([^/?]+)', url) or [None, ad])[1]
        process({'id': f"{plat}-{abs(hash(url + str(BAS))) % 10**10}", 'url': url, 'baslik': '', 'izlenme': 0, 'sure': 0,
                 'platform': plat, 'kanal': kanal, 'ad': ad, 'izin': False, 'facecam': None})
    else:
        sys.exit(__doc__)
