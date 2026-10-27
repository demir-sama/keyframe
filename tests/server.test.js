import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createApp } from '../src/server.js';

test('server: ws hello, sim → vote cue, state/reel API, static overlay', async () => {
  const app = createApp({ roundSeconds: 60, mock: true });
  await new Promise((r) => app.server.listen(0, r));
  const base = `localhost:${app.server.address().port}`;
  const ws = new WebSocket(`ws://${base}/ws`);
  const msgs = [];
  ws.on('message', (m) => msgs.push(JSON.parse(m)));
  await new Promise((r) => ws.on('open', r));
  await fetch(`http://${base}/api/sim`, { method: 'POST', body: JSON.stringify({ type: 'chat', user: 'a', text: '!shape star' }) });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(msgs[0].t, 'hello');
  assert.ok(msgs.some((m) => m.t === 'vote' && m.value === 'star'));
  const st = await (await fetch(`http://${base}/api/state`)).json();
  assert.deepEqual(st.tallies.shape, { star: 1 });
  await fetch(`http://${base}/api/resolve`, { method: 'POST' });
  const reel = await (await fetch(`http://${base}/api/reel`)).json();
  assert.equal(reel.events[0].changes.shape, 'star');
  const html = await fetch(`http://${base}/`); assert.equal(html.status, 200);
  assert.equal((await fetch(`http://${base}/shared/../package.json`)).status, 404);
  ws.close(); app.close();
});

test('server: sim endpoint refused outside mock mode', async () => {
  const app = createApp({ mock: false });
  await new Promise((r) => app.server.listen(0, r));
  const r = await fetch(`http://localhost:${app.server.address().port}/api/sim`, { method: 'POST', body: '{}' });
  assert.equal(r.status, 403);
  app.close();
});
