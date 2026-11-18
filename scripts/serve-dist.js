import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../dist/', import.meta.url));
const files = new Map();
for (const name of new Bun.Glob('**/*').scanSync({ cwd: directory, onlyFiles: true })) {
  files.set(new URL(name, 'http://localhost/').pathname, Bun.file(directory + name));
}
if (!files.has('/index.html')) throw new Error('未找到 dist/index.html，请运行 bun install 和 bun run build。');
files.set('/', files.get('/index.html'));
const server = Bun.serve({
  hostname: '127.0.0.1', port: Number(process.env.PORT ?? 4173),
  fetch(request) {
    const file = files.get(new URL(request.url).pathname);
    return file ? new Response(file) : new Response('Not found', { status: 404 });
  },
});
console.log(`笛亚 · 角色图录：${server.url}`);
