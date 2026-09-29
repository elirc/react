import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const allowed = new Set([
  'index.html',
  'styles.css',
  'main.js',
  'board.js',
  'edit.js',
  'data.js',
  'store.js',
]);
const mime = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT.');
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['GET', 'HEAD'].includes(request.method) || !allowed.has(name)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  try {
    const body = await readFile(join(root, name));
    response.writeHead(200, {
      'Content-Type': `${mime[name.split('.').pop()]}; charset=utf-8`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500);
    response.end('Asset could not be read');
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Quiz board: http://127.0.0.1:${server.address().port}`),
);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
