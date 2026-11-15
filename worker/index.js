import { D1RoomStore, RoomService, handleRoomRequest } from './room-service.js';

export function createWorker(assets) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname === '/api/health') return Response.json({ ok: true, multiplayer: Boolean(env.DB) }, { headers: { 'Cache-Control': 'no-store' } });
      if (url.pathname.startsWith('/api/')) {
        if (!env.DB) return Response.json({ error: 'Online offices are temporarily unavailable. Solo play is still available.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        return handleRoomRequest(request, new RoomService(new D1RoomStore(env.DB)));
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Not found', { status: 404 }); }
      const asset = assets[pathname === '/' ? '/index.html' : pathname];
      if (!asset) return new Response('Not found', { status: 404 });
      return new Response(request.method === 'HEAD' ? null : asset.body, { headers: { 'Content-Type': asset.type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' } });
    }
  };
}
