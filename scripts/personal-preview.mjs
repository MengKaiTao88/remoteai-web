import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export async function personalPreview() {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  const base = '/remoteai-web/';
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  let entryFailure = false;
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (!pathname.startsWith(base)) { response.writeHead(404).end(); return; }
      const relative = decodeURIComponent(pathname.slice(base.length)) || 'index.html';
      if (entryFailure && /^assets\/index-[^/]+\.js$/.test(relative)) {
        response.writeHead(503).end(); return;
      }
      const filename = path.resolve(root, relative);
      if (!filename.startsWith(root)) { response.writeHead(403).end(); return; }
      const bytes = await readFile(filename);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Content-Type', types[path.extname(filename)] ?? 'application/octet-stream');
      response.end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}${base}`,
    setEntryFailure: value => { entryFailure = value; },
    close: () => new Promise(resolve => server.close(resolve)) };
}
