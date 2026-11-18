// Bake the exact viewer geometry with a browser canvas for texture encoding.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const server = await createServer({
  server: { host: '127.0.0.1', port: Number(process.env.EXPORT_PORT || 4178), strictPort: true },
  logLevel: 'error',
  plugins: [{
    name: 'model-export-page',
    configureServer(server) {
      server.middlewares.use('/__export__', (_, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Model export</title>');
      });
    }
  }]
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined });
  const page = await browser.newPage();
  page.on('console', msg => {
    if (['warning', 'error'].includes(msg.type())) console.warn(msg.text());
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__export__`);
  const result = await page.evaluate(async () => {
    const { buildCharacter } = await import('/src/model/index.js');
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const { makeExportScene } = await import('/scripts/gltf-scene.js');
    const model = await buildCharacter();
    const scene = makeExportScene(model);
    const bytes = await new GLTFExporter().parseAsync(scene, { binary: true, animations: model.animations });
    const dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(new Blob([bytes]));
    });
    return dataURL.slice(dataURL.indexOf(',') + 1);
  });
  const bytes = Buffer.from(result, 'base64');
  await mkdir('public', { recursive: true });
  const output = process.argv[2] || 'public/diya.glb';
  await writeFile(output, bytes);
  console.log(`Exported ${output} (${(bytes.length / 1048576).toFixed(2)} MiB)`);
} finally {
  await browser?.close();
  await server.close();
}
