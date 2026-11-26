// Render the composition to frames with Playwright, then encode with ffmpeg.
// node tools/render.js --preview 1.2,4.5,...   -> build/preview/*.png
// node tools/render.js [--workers 4]           -> build/frames/*.jpg + build/video.mp4
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FPS = 30;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

const timings = fs.readFileSync(path.join(ROOT, 'build/timings.json'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'build/timings.js'), 'window.TIMINGS = ' + timings + ';\n');
const url = 'file://' + path.join(ROOT, 'comp/index.html');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  return page;
}

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const preview = opt('--preview');
  if (preview) {
    const dir = path.join(ROOT, 'build/preview');
    fs.mkdirSync(dir, { recursive: true });
    const page = await openPage(browser);
    for (const t of preview.split(',').map(Number)) {
      await page.evaluate(t => window.__seek(t), t);
      await page.screenshot({ path: path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`) });
    }
    await browser.close();
    return;
  }
  const page0 = await openPage(browser);
  const dur = await page0.evaluate(() => window.__duration);
  const cues = await page0.evaluate(() => window.__cues);
  fs.writeFileSync(path.join(ROOT, 'build/cues.json'), JSON.stringify(cues, null, 1));
  const total = Math.round(dur * FPS);
  const workers = +opt('--workers', 4);
  const dir = path.join(ROOT, 'build/frames');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const pages = [page0];
  for (let i = 1; i < workers; i++) pages.push(await openPage(browser));
  let done = 0;
  const t0 = Date.now();
  await Promise.all(pages.map(async (page, w) => {
    for (let f = w; f < total; f += workers) {
      await page.evaluate(t => window.__seek(t), f / FPS);
      await page.screenshot({ path: path.join(dir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
      if (++done % 100 === 0) console.log(`${done}/${total} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
  await browser.close();
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    path.join(ROOT, 'build/video.mp4')], { stdio: 'inherit' });
  console.log('video done', total, 'frames');
})();
