// hikaye.json + vo/sesler.json -> out/zaman.js (motorun okuduğu zaman çizelgesi) + out/ses.wav (karışık ses).
// Kullanım: node build.js [hikaye.json]
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const STORY = process.argv[2] || 'hikaye.json';
const story = JSON.parse(fs.readFileSync(STORY, 'utf8'));
const db = fs.existsSync('vo/sesler.json') ? JSON.parse(fs.readFileSync('vo/sesler.json', 'utf8')) : {};
const chars = story.karakterler || {};
const narr = story.anlatici || { ses: 'tr-TR-AhmetNeural', hiz: '-8%', perde: '-4Hz' };
const r3 = x => Math.round(x * 1000) / 1000;

// ses.py ile aynı kimlik: sha1("ses|hız|perde|metin")[:12]
function lineId(ev) {
  const c = ev.tip === 'anlatici' ? narr : chars[ev.kim];
  if (!c) throw new Error(`Bilinmeyen karakter: "${ev.kim}"`);
  const v = [c.ses || 'tr-TR-AhmetNeural', ev.hiz || c.hiz || '+0%', ev.perde || c.perde || '+0Hz'];
  return crypto.createHash('sha1').update(v.join('|') + '|' + ev.metin).digest('hex').slice(0, 12);
}

const GAP = story.repliklerArasi ?? 0.35; // iki replik arasındaki nefes payı (sn)
const WALK_SPEED = 260;                    // px/sn, yürüyüşte süre verilmezse
let cursor = 0, missing = 0;
const scenes = [], lines = [];

story.sahneler.forEach((sc, si) => {
  const start = cursor;
  const lead = sc.basBekleme ?? (si === 0 ? 0.8 : 0.5);
  let t = start + lead;
  const pos = {}; // yürüyüş süresini hesaplamak için anlık x
  (sc.oyuncular || []).forEach(o => { pos[o.kim] = o.x ?? 0; });
  const events = [];
  for (const ev0 of sc.olaylar || []) {
    const ev = { ...ev0, start: r3(t) };
    let dur = 0;
    switch (ev.tip) {
      case 'replik': case 'anlatici': {
        const id = lineId(ev), rec = db[id];
        if (!rec) { missing++; dur = 0.5 + ev.metin.length * 0.062; ev.env = []; }
        else { dur = rec.dur; ev.env = rec.env; if (rec.kelimeler) ev.kelimeler = rec.kelimeler; if (!rec.sessiz) ev.dosya = `vo/${id}.wav`; }
        ev.konusma = r3(dur);
        lines.push({ start: ev.start, end: r3(t + dur), kim: ev.kim || null, metin: ev.metin, dosya: ev.dosya });
        dur += ev.ara ?? GAP;
        break;
      }
      case 'yuru': {
        const from = pos[ev.kim] ?? 0;
        ev.from = from;
        dur = ev.sure ?? Math.abs(ev.x - from) / (ev.hiz || WALK_SPEED);
        pos[ev.kim] = ev.x;
        break;
      }
      case 'bekle': case 'yazi': case 'kamera': case 'jest': dur = ev.sure ?? (ev.tip === 'yazi' ? 3 : ev.tip === 'kamera' ? 1.5 : 1); break;
      default: dur = 0; // duygu, bak, ... anlık
    }
    ev.end = r3(t + dur);
    if (!ev.paralel) t += dur;
    events.push(ev);
  }
  const lastEnd = Math.max(t, ...events.map(e => e.end));
  const end = Math.max(lastEnd + (sc.sonBekleme ?? 0.6), start + (sc.sure || 0));
  scenes.push({ ...sc, olaylar: events, start: r3(start), end: r3(end) });
  cursor = end;
});

const total = r3(cursor + 0.3);

// --- olay tabanlı sayaç: "sayac": {mod:'ileri'|'geri', bas:'00:00', hiz, bitis, hedefOlay} | 'dur' | 'gizle'
// hedefOlay verilirse hız, sayaç tam o olayın başladığı anda "bitis" değerini gösterecek şekilde hesaplanır.
const clk = c => String(c).split(':').map(Number).reduce((a, b) => a * 60 + b, 0);
const allEv = scenes.flatMap(s => s.olaylar), byId = Object.fromEntries(allEv.filter(e => e.id).map(e => [e.id, e]));
for (const ev of allEv) {
  const sy = ev.sayac; if (!sy || typeof sy !== 'object' || !sy.hedefOlay) continue;
  const hd = byId[sy.hedefOlay]; if (!hd) throw new Error(`sayac.hedefOlay bulunamadı: ${sy.hedefOlay}`);
  const dt = hd.start - ev.start; if (dt <= 0) throw new Error(`hedefOlay (${sy.hedefOlay}) sayaçtan önce`);
  sy.hiz = r3(Math.abs(clk(sy.bitis) - clk(sy.bas)) / dt);
  console.log(`sayaç: ${sy.bas} -> ${sy.bitis} @ ${sy.hedefOlay} (${dt.toFixed(1)} sn, hız x${sy.hiz})`);
}
const fmt = story.format === '9:16' ? [1080, 1920] : [1920, 1080];
const data = {
  baslik: story.baslik || 'Hikaye', W: fmt[0], H: fmt[1], fps: story.fps || 30, total,
  sinemaBantlari: story.sinemaBantlari ?? (story.format !== '9:16'),
  altyazi: story.altyazi ?? true, altyaziStil: story.altyaziStil || (story.format === '9:16' ? 'vurgulu' : 'klasik'),
  baslikBant: story.baslikBant || null, dizi: story.dizi || null, karakterler: chars, sahneler: scenes,
};
fs.mkdirSync('out', { recursive: true });
// Görselin yanında aynı adlı .mp4 varsa (canlandir.py çıktısı) kareleri çıkar; motor görsel yerine klibi oynatır
data.klipler = {};
for (const src of new Set(scenes.flatMap(s => [s.gorsel, ...s.olaylar.map(e => e.gorsel)]).filter(Boolean))) {
  const hd = src.replace(/\.[a-z]+$/i, '.hd.mp4'), clip = fs.existsSync(hd) ? hd : src.replace(/\.[a-z]+$/i, '.mp4');  // HD sürüm öncelikli
  if (!fs.existsSync(clip)) continue;
  const dir = 'out/klip/' + crypto.createHash('sha1').update(clip + fs.statSync(clip).mtimeMs).digest('hex').slice(0, 10);
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); execFileSync('ffmpeg', ['-v', 'error', '-i', clip, '-vf', 'fps=24', '-q:v', '3', dir + '/%03d.jpg']); }
  data.klipler[src] = { dir, n: fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length, fps: 24 };
  console.log(`klip: ${clip} (${data.klipler[src].n} kare)`);
}
fs.writeFileSync('out/zaman.js', 'window.DATA=' + JSON.stringify(data) + ';\n');
fs.writeFileSync('out/zaman.json', JSON.stringify({ total, scenes: scenes.map(s => ({ id: s.id, start: s.start, end: s.end })), lines }, null, 1));

// --- görsel promptları: her çekim için İngilizce prompt (stil + karakter + mekan bloğu) ---
const shots = [];
scenes.forEach(sc => {
  if (sc.gorsel) shots.push({ dosya: sc.gorsel, prompt: sc.gorselPrompt, sahne: sc.id });
  sc.olaylar.forEach(ev => { if (ev.gorsel) shots.push({ dosya: ev.gorsel, prompt: ev.gorselPrompt, sahne: sc.id, metin: ev.metin }); });
});
if (shots.length) {
  const style = story.gorselStil || '';
  const blocks = Object.entries(chars).filter(([, c]) => c.gorselTarif).map(([k, c]) => [k.toUpperCase(), c.gorselTarif]);
  const fill = p => blocks.reduce((s, [k, d]) => s.split(`[${k}]`).join(d), p || '');
  const seen = new Set(), md = [`# ${story.baslik} · görsel promptları`, '', `Format: ${story.format === '9:16' ? 'dikey 9:16 (1080x1920)' : 'yatay 16:9 (1920x1080)'}. Her görseli belirtilen dosya adıyla kaydet.`, ''];
  for (const sh of shots) {
    if (seen.has(sh.dosya)) continue; seen.add(sh.dosya);
    const have = fs.existsSync(sh.dosya);
    md.push(`## ${sh.dosya} ${have ? '✓' : '(eksik)'}`, sh.metin ? `> ${sh.metin.replace(/\*/g, '')}` : '', '', '```', [fill(sh.prompt), style].filter(Boolean).join(' '), '```', '');
  }
  fs.writeFileSync('out/gorsel-promptlari.md', md.join('\n'));
  const missing = [...seen].filter(f => !fs.existsSync(f)).length;
  console.log(`${seen.size} görsel (${missing} eksik) -> out/gorsel-promptlari.md`);
}

// --- ses karışımı: her satır kendi başlangıç anına, isteğe bağlı müzik altta ---
const voiced = lines.filter(l => l.dosya && fs.existsSync(l.dosya));
const inputs = [], filters = [], labels = [], vlab = [];
voiced.forEach((l, i) => {
  inputs.push('-i', l.dosya);
  const ms = Math.round(l.start * 1000);
  filters.push(`[${i}:a]adelay=${ms}|${ms}[a${i}]`); vlab.push(`[a${i}]`);
});
// --- ses efektleri (sfx.py, yerel sentez): olayda "ses": "gok" | {ad, sure, bpm, seviye, gecikme}
//     hikâyede "ambiyans": [{ad, bas, bit, seviye, bpm}] (bas/bit sn ya da olay id'si)
const sfxList = [];
for (const ev of allEv) for (const s of [].concat(ev.ses || [])) {
  const o = typeof s === 'string' ? { ad: s } : s;
  sfxList.push({ ...o, t: ev.start + (o.gecikme || 0), seviye: o.seviye ?? 0.7 });
}
const at = v => typeof v === 'string' ? (byId[v] ? byId[v].start : (() => { throw new Error(`ambiyans: olay yok: ${v}`); })()) : v;
for (const a of story.ambiyans || []) {
  const b = at(a.bas ?? 0), e = at(a.bit ?? total);
  sfxList.push({ ...a, t: b, sure: r3(e - b), seviye: a.seviye ?? 0.25, fade: a.fade ?? 1.2 });
}
if (sfxList.length) fs.mkdirSync('out/sfx', { recursive: true });
for (const x of sfxList) {
  const args = [`sure=${x.sure ?? ''}`, `bpm=${x.bpm ?? ''}`, `tohum=${x.tohum ?? 1}`].filter(a => !a.endsWith('='));
  const f = `out/sfx/${x.ad}-` + crypto.createHash('sha1').update(args.join(' ')).digest('hex').slice(0, 8) + '.wav';
  if (!fs.existsSync(f)) execFileSync('python3', [path.join(__dirname, 'sfx.py'), x.ad, f, ...args], { stdio: 'inherit' });
  const i = inputs.filter(a => a === '-i').length, ms = Math.round(x.t * 1000), fd = x.fade || 0;
  inputs.push('-i', f);
  const fades = fd ? `,afade=t=in:d=${fd},areverse,afade=t=in:d=${fd},areverse` : '';
  filters.push(`[${i}:a]volume=${x.seviye}${fades},adelay=${ms}|${ms}[s${i}]`); labels.push(`[s${i}]`);
}
if (sfxList.length) console.log(`${sfxList.length} ses efekti/ambiyans karıştırıldı`);
if (story.muzik && fs.existsSync(story.muzik)) {
  const k = inputs.filter(a => a === '-i').length;
  inputs.push('-stream_loop', '-1', '-i', story.muzik);
  const vol = story.muzikSeviyesi ?? 0.18;
  filters.push(`[${k}:a]volume=${vol},afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, total - 2.5)}:d=2.5,atrim=0:${total}[m]`);
  labels.push('[m]');
}
if (labels.length || vlab.length) {
  // ses (anlatıcı) ayrı yol: efektler/ambiyans konuşma sırasında otomatik kısılır (sidechain), genel seviye düşük
  const fxGain = story.efektGenel ?? 0.4;
  if (vlab.length) filters.push(`${vlab.join('')}amix=inputs=${vlab.length}:normalize=0:duration=longest,apad,atrim=0:${total},volume=1.6,asplit=2[vo][vk]`);
  if (labels.length) {
    filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,apad,atrim=0:${total},volume=${fxGain}[fx0]`);
    filters.push(vlab.length ? `[fx0][vk]sidechaincompress=threshold=0.015:ratio=14:attack=8:release=450:makeup=1[fx]` : `[fx0]anull[fx]`);
  }
  const fin = [vlab.length ? '[vo]' : '', labels.length ? '[fx]' : ''].filter(Boolean);
  filters.push(`${fin.join('')}amix=inputs=${fin.length}:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=9[out]`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '2', 'out/ses.wav'], { stdio: 'inherit' });
} else if (fs.existsSync('out/ses.wav')) fs.unlinkSync('out/ses.wav');

console.log(`${scenes.length} sahne, ${lines.length} satır, toplam ${total.toFixed(1)} sn` +
  (missing ? `  (UYARI: ${missing} satırın sesi yok, önce: python3 ses.py)` : '') +
  ((labels.length || vlab.length) ? '  -> out/ses.wav' : '  (sessiz)'));
