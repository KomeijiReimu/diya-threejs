// Reproduce the full browser presentation frame-by-frame; encoding is not
// tied to the machine's real-time rendering speed. Run: bun run render:showcase
import { mkdir, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

// Capture the same production bundle served by `bun start`.
const server = await preview({ preview: { host: '127.0.0.1', port: Number(process.env.RENDER_PORT || 4179), strictPort: true }, logLevel: 'error' });
let browser, encoder;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined,
    args: process.env.DIYA_SOFTWARE_GL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error(e));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?capture=1`);
  await page.waitForFunction(() => window.diyaCapture?.duration > 0);
  const seconds = await page.evaluate(() => window.diyaCapture.duration);
  const fps = 24, count = Math.round(seconds * fps);
  const dir = '预览', output = `${dir}/笛亚-动作展演.mp4`, partial = `${dir}/笛亚-动作展演.partial.mp4`;
  await mkdir(dir, { recursive: true });
  encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps),
    '-vcodec', 'mjpeg', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '17',
    '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', partial], { stdio: ['pipe', 'ignore', 'inherit'] });
  async function* frames() {
    for (let i = 0; i < count; ++i) {
      const jpeg = await page.evaluate(t => {
        window.diyaCapture.seek(t);
        return document.querySelector('canvas').toDataURL('image/jpeg', .96).split(',')[1];
      }, i/fps);
      yield Buffer.from(jpeg, 'base64');
      if ((i+1) % (fps*3) === 0) console.log(`${i+1}/${count} frames`);
    }
  }
  const [[status]] = await Promise.all([once(encoder, 'close'), pipeline(Readable.from(frames()), encoder.stdin)]);
  if (status !== 0) throw new Error(`ffmpeg exited with ${status}: ${partial}`);
  await rename(partial, output);
  console.log(`${output} · ${count} frames · ${seconds}s @ ${fps} fps`);
} finally {
  if (encoder && encoder.exitCode === null) encoder.kill();
  await browser?.close();
  await server.close();
}
