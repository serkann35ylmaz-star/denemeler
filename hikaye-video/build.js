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
        else { dur = rec.dur; ev.env = rec.env; if (!rec.sessiz) ev.dosya = `vo/${id}.wav`; }
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
const fmt = story.format === '9:16' ? [1080, 1920] : [1920, 1080];
const data = {
  baslik: story.baslik || 'Hikaye', W: fmt[0], H: fmt[1], fps: story.fps || 30, total,
  sinemaBantlari: story.sinemaBantlari ?? (story.format !== '9:16'),
  altyazi: story.altyazi ?? true, karakterler: chars, sahneler: scenes,
};
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/zaman.js', 'window.DATA=' + JSON.stringify(data) + ';\n');
fs.writeFileSync('out/zaman.json', JSON.stringify({ total, scenes: scenes.map(s => ({ id: s.id, start: s.start, end: s.end })), lines }, null, 1));

// --- ses karışımı: her satır kendi başlangıç anına, isteğe bağlı müzik altta ---
const voiced = lines.filter(l => l.dosya && fs.existsSync(l.dosya));
const inputs = [], filters = [], labels = [];
voiced.forEach((l, i) => {
  inputs.push('-i', l.dosya);
  const ms = Math.round(l.start * 1000);
  filters.push(`[${i}:a]adelay=${ms}|${ms}[a${i}]`); labels.push(`[a${i}]`);
});
if (story.muzik && fs.existsSync(story.muzik)) {
  const k = voiced.length;
  inputs.push('-stream_loop', '-1', '-i', story.muzik);
  const vol = story.muzikSeviyesi ?? 0.18;
  filters.push(`[${k}:a]volume=${vol},afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, total - 2.5)}:d=2.5,atrim=0:${total}[m]`);
  labels.push('[m]');
}
if (labels.length) {
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,apad,atrim=0:${total}[out]`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '2', 'out/ses.wav'], { stdio: 'inherit' });
} else if (fs.existsSync('out/ses.wav')) fs.unlinkSync('out/ses.wav');

console.log(`${scenes.length} sahne, ${lines.length} satır, toplam ${total.toFixed(1)} sn` +
  (missing ? `  (UYARI: ${missing} satırın sesi yok, önce: python3 ses.py)` : '') +
  (voiced.length ? '  -> out/ses.wav' : '  (sessiz)'));
