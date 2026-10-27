// HTTP (static overlay + tiny API) and WebSocket hub that fans cues out to overlay clients.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { Director } from './director.js';
import { handleEvent } from './cues.js';

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const DIRS = { '/shared/': 'shared', '/': 'public' };

export function createApp({ roundSeconds = 20, mock = false, onStatus = () => {} } = {}) {
  const director = new Director({ roundSeconds });
  const clients = new Set();
  const broadcast = (cue) => { const s = JSON.stringify(cue); for (const c of clients) if (c.readyState === 1) c.send(s); };

  const emit = (ev) => { for (const cue of handleEvent(ev, director)) broadcast(cue); };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/state') return json(res, { ...director.hud(), mock });
    if (url.pathname === '/api/reel') return json(res, { exportedAt: new Date().toISOString(), events: director.reel });
    if (url.pathname === '/api/sim' && req.method === 'POST') {
      if (!mock) return json(res, { error: 'simulator disabled outside mock mode' }, 403);
      let body = ''; for await (const c of req) body += c;
      try { emit(JSON.parse(body)); return json(res, { ok: true }); } catch (e) { return json(res, { error: e.message }, 400); }
    }
    if (url.pathname === '/api/resolve' && req.method === 'POST') { broadcast(director.resolveRound()); return json(res, { ok: true }); }
    serveStatic(url.pathname, res);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ ...director.hud(), t: 'hello', mock }));
    ws.on('close', () => clients.delete(ws));
  });

  let last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now(); const dt = now - last; last = now;
    for (const cue of director.tick(dt)) broadcast(cue);
    broadcast(director.hud());
  }, 250);

  return { server, director, emit, broadcast, close: () => { clearInterval(timer); wss.close(); server.close(); } };
}

function json(res, obj, code = 200) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }

function serveStatic(pathname, res) {
  let dir = DIRS['/'], rel = pathname === '/' ? '/overlay.html' : pathname;
  if (pathname.startsWith('/shared/')) { dir = DIRS['/shared/']; rel = pathname.slice('/shared'.length); }
  const file = path.normalize(path.join(ROOT, dir, rel));
  if (!file.startsWith(path.join(ROOT, dir))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}
