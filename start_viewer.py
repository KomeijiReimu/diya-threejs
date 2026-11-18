"""Serve the prebuilt character viewer locally and open it in the default browser."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser


if __name__ == '__main__':
    site = Path(__file__).resolve().parent / 'dist'
    if not (site / 'index.html').is_file():
        raise SystemExit('未找到 dist/index.html，请先运行 bun install 和 bun run build。')
    handler = partial(SimpleHTTPRequestHandler, directory=str(site))
    with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
        url = f'http://127.0.0.1:{server.server_port}/'
        print(f'笛亚 · 角色图录：{url}\n按 Ctrl+C 停止。', flush=True)
        webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print('查看器已关闭。')
