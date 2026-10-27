import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { normalize, SUBSCRIPTIONS } from '../src/twitch/normalize.js';
import { EventSubClient } from '../src/twitch/eventsub.js';

test('normalize chat message with badges', () => {
  const ev = normalize('channel.chat.message', { chatter_user_name: 'v', message: { text: '!ease snap' }, color: '#fff', badges: [{ set_id: 'subscriber' }] });
  assert.deepEqual(ev, { type: 'chat', user: 'v', text: '!ease snap', color: '#fff', isSub: true, isMod: false });
});

test('normalize other event types', () => {
  assert.equal(normalize('channel.follow', { user_name: 'f' }).type, 'follow');
  assert.equal(normalize('channel.subscribe', { user_name: 's', tier: '2000', is_gift: false }).tier, 2);
  assert.equal(normalize('channel.subscribe', { user_name: 's', is_gift: true }), null);
  assert.equal(normalize('channel.raid', { from_broadcaster_user_name: 'r', viewers: 9 }).viewers, 9);
  assert.equal(normalize('channel.cheer', { is_anonymous: true, bits: 5 }).user, 'Anonymous');
  assert.deepEqual(normalize('channel.channel_points_custom_reward_redemption.add', { user_name: 'u', user_input: 'x', reward: { title: 'T' } }), { type: 'redeem', user: 'u', reward: 'T', input: 'x' });
  assert.equal(normalize('nope', {}), null);
});

test('subscription conditions use the right ids', () => {
  const raid = SUBSCRIPTIONS.find((s) => s.type === 'channel.raid');
  assert.deepEqual(raid.cond('42'), { to_broadcaster_user_id: '42' });
  const follow = SUBSCRIPTIONS.find((s) => s.type === 'channel.follow');
  assert.equal(follow.version, '2'); assert.equal(follow.cond('42').moderator_user_id, '42');
});

test('EventSubClient: welcome → subscribes all → delivers notification', async () => {
  const srv = http.createServer(); const wss = new WebSocketServer({ server: srv });
  await new Promise((r) => srv.listen(0, r));
  const msg = (type, payload) => JSON.stringify({ metadata: { message_id: Math.random().toString(36), message_type: type, message_timestamp: new Date().toISOString() }, payload });
  wss.on('connection', (ws) => {
    ws.send(msg('session_welcome', { session: { id: 'SESS', keepalive_timeout_seconds: 10 } }));
    setTimeout(() => ws.send(msg('notification', { subscription: { type: 'channel.follow' }, event: { user_name: 'neo' } })), 150);
  });
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true, status: 202 }; };
  const got = await new Promise((resolve) => {
    const c = new EventSubClient({ clientId: 'cid', getToken: async () => 'tok', broadcasterId: '1', url: `ws://localhost:${srv.address().port}`, fetchImpl, onEvent: (e) => { c.stop(); resolve(e); } });
    c.start();
  });
  assert.deepEqual(got, { type: 'follow', user: 'neo' });
  assert.equal(calls.length, SUBSCRIPTIONS.length);
  assert.ok(calls.every((b) => b.transport.session_id === 'SESS' && b.transport.method === 'websocket'));
  wss.close(); srv.close();
});
