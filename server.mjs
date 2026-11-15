import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoomService, MemoryRoomStore, handleRoomRequest } from './worker/room-service.js';

const root = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
export function createPreviewServer(options = {}) {
  const store = options.store || new MemoryRoomStore(), service = new RoomService(store, options);
  const server = http.createServer(async (req, res) => {
    try {
      const origin = 'http://' + (req.headers.host || '127.0.0.1:4173'), url = new URL(req.url, origin);
      if (url.pathname === '/api/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true,"multiplayer":true,"storage":"local-preview"}'); }
      if (url.pathname.startsWith('/api/')) {
        const chunks = []; let length = 0;
        for await (const chunk of req) { length += chunk.length; if (length > 64000) { res.writeHead(413); return res.end('{"error":"Request too large"}'); } chunks.push(chunk); }
        const request = new Request(url, { method: req.method, headers: req.headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}) });
        const response = await handleRoomRequest(request, service);
        res.writeHead(response.status, Object.fromEntries(response.headers)); return res.end(Buffer.from(await response.arrayBuffer()));
      }
      let pathname = decodeURIComponent(url.pathname); if (pathname === '/') pathname = '/index.html';
      const file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  server.roomStore = store;
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createPreviewServer().listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port));
}
