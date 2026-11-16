// Kareleri tarayıcıda çizer, ffmpeg ile sesle birleştirip MP4 yapar.
//   node render.js                 -> out/<başlık>.mp4
//   node render.js --onizle        -> her sahnenin ortasından bir kare (out/onizleme/)
//   node render.js 2.5 7 12        -> belirtilen saniyelerden kareler
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const args = process.argv.slice(2), times = args.filter(a => !a.startsWith('--')).map(Number);
const PREVIEW = args.includes('--onizle') || times.length;
const TMP = 'out/kareler', WORKERS = Math.max(1, Math.min(4, os.cpus().length));
if (!fs.existsSync('out/zaman.js')) { console.error('Önce: node build.js'); process.exit(1); }
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] }); // yerel görseller tuvali kirletmesin
  const D = await (async () => { const p = await b.newPage(); await p.goto('file://' + path.resolve('index.html') + '#render'); await p.waitForFunction('window.READY', null, { timeout: 120000 }); const d = await p.evaluate(() => ({ W: DATA.W, H: DATA.H, fps: DATA.fps, total: DATA.total, baslik: DATA.baslik, sc: DATA.sahneler.map(s => [s.id, s.start, s.end]) })); await p.close(); return d; })();
  const open = async () => { const p = await b.newPage({ viewport: { width: D.W, height: D.H } }); p.on('pageerror', e => console.error('HATA:', e.message)); p.on('console', m => m.type() === 'warning' && console.warn(m.text()));
    await p.goto('file://' + path.resolve('index.html') + '#render'); await p.waitForFunction('window.READY', null, { timeout: 120000 }); return p; };
  const grab = (p, t, q) => p.evaluate(([t, q]) => { seek(t); return document.getElementById('cv').toDataURL('image/jpeg', q); }, [t, q]);
  if (PREVIEW) {
    fs.mkdirSync('out/onizleme', { recursive: true });
    const ts = times.length ? times : D.sc.map(([, s, e]) => +(s + (e - s) * .55).toFixed(2));
    const p = await open();
    for (const t of ts) { const f = `out/onizleme/t${t.toFixed(2)}.jpg`; fs.writeFileSync(f, Buffer.from((await grab(p, t, .88)).split(',')[1], 'base64')); console.log(f); }
    await b.close(); return;
  }
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  const N = Math.round(D.total * D.fps); let done = 0; const t0 = Date.now();
  await Promise.all([...Array(WORKERS).keys()].map(async w => { const p = await open();
    for (let i = w; i < N; i += WORKERS) { fs.writeFileSync(`${TMP}/f${String(i).padStart(5, '0')}.jpg`, Buffer.from((await grab(p, i / D.fps, .93)).split(',')[1], 'base64'));
      if (++done % 150 === 0) console.log(`${done}/${N} kare  ${((Date.now() - t0) / 1000) | 0} sn`); } }));
  await b.close();
  const slug = D.baslik.toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hikaye';
  const outFile = `out/${slug}.mp4`, a = ['-y', '-v', 'error', '-framerate', String(D.fps), '-i', `${TMP}/f%05d.jpg`];
  if (fs.existsSync('out/ses.wav')) a.push('-i', 'out/ses.wav', '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k');
  a.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-t', String(D.total), '-movflags', '+faststart', outFile);
  execFileSync('ffmpeg', a, { stdio: 'inherit' }); fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`Bitti: ${outFile}  (${N} kare, ${((Date.now() - t0) / 1000) | 0} sn)`);
})();
