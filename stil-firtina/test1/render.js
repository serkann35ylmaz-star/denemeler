// Usage: node render.js            -> full render to out/final.mp4
//        node render.js preview 0.5 2.4 ...  -> PNGs of given times into frames/
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ROOT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction('window.ready === true', null, { timeout: 60000 });
  const cfg = await page.evaluate('window.CONFIG');
  const shot = async (t, file) => {
    await page.evaluate(t => window.seek(t), t);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: cfg.W, height: cfg.H } });
  };
  const mode = process.argv[2];
  if (mode === 'preview') {
    fs.mkdirSync(path.join(ROOT, 'frames'), { recursive: true });
    for (const a of process.argv.slice(3)) {
      const t0 = Date.now(); await shot(parseFloat(a), path.join(ROOT, 'frames', `t${parseFloat(a).toFixed(2)}.png`));
      console.log('frame', a, Date.now() - t0, 'ms');
    }
  } else if (mode === 'determinism') {
    const a = path.join(ROOT, 'out', 'det_a.png'), b = path.join(ROOT, 'out', 'det_b.png');
    fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
    await shot(3.2, a); await page.evaluate(() => window.seek(7.0)); await shot(3.2, b);
    console.log('identical:', Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) === 0);
  } else {
    const dir = path.join(ROOT, 'out', 'frames_tmp'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const N = Math.round(cfg.duration * cfg.fps); const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      await shot(i / cfg.fps, path.join(dir, `f${String(i).padStart(5, '0')}.png`));
      if (i % 20 === 0) console.log(`frame ${i}/${N}  ${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/frame`);
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(cfg.fps), '-i', path.join(dir, 'f%05d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(ROOT, 'out', 'final.mp4')], { stdio: 'inherit' });
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('done out/final.mp4');
  }
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
