// EventSub over WebSocket: wss://eventsub.wss.twitch.tv/ws
// Handles welcome → subscribe, keepalive watchdog, session_reconnect, and auto-reconnect.
import WebSocket from 'ws';
import { SUBSCRIPTIONS, normalize } from './normalize.js';

const HELIX = 'https://api.twitch.tv/helix/eventsub/subscriptions';

export class EventSubClient {
  constructor({ clientId, getToken, broadcasterId, onEvent, onStatus = () => {}, url = 'wss://eventsub.wss.twitch.tv/ws', fetchImpl = fetch }) {
    Object.assign(this, { clientId, getToken, broadcasterId, onEvent, onStatus, url, fetchImpl });
    this.seen = new Set();
    this.stopped = false;
  }

  start() { this.#connect(this.url); }
  stop() { this.stopped = true; clearTimeout(this.watchdog); this.ws?.close(); }

  #connect(url) {
    const ws = new WebSocket(url);
    const old = this.ws;
    this.ws = ws;
    ws.on('message', (raw) => this.#onMessage(ws, JSON.parse(raw)).catch((e) => this.onStatus('error', e.message)));
    ws.on('open', () => this.onStatus('socket-open', url));
    ws.on('close', () => {
      if (this.stopped || ws !== this.ws) return;
      this.onStatus('closed', 'reconnecting in 3s');
      setTimeout(() => !this.stopped && this.#connect(this.url), 3000);
    });
    ws.on('error', (e) => this.onStatus('error', e.message));
    if (old && old !== ws) setTimeout(() => old.close(), 1000);
  }

  #arm(seconds) {
    clearTimeout(this.watchdog);
    // Twitch sends a keepalive at least every `seconds`; allow slack before declaring the socket dead.
    this.watchdog = setTimeout(() => { this.onStatus('timeout', 'keepalive missed'); this.ws?.terminate(); }, (seconds + 5) * 1000);
  }

  async #onMessage(ws, msg) {
    const { message_type: kind, message_id: id } = msg.metadata;
    if (this.seen.has(id)) return; // dedupe
    this.seen.add(id); if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value);
    switch (kind) {
      case 'session_welcome': {
        const s = msg.payload.session;
        this.#arm(s.keepalive_timeout_seconds);
        // On a session_reconnect the subscriptions carry over; only subscribe on a fresh session.
        if (!this.reconnecting) await this.#subscribeAll(s.id);
        this.reconnecting = false;
        this.onStatus('ready', s.id);
        break;
      }
      case 'session_keepalive': this.#arm(10); break;
      case 'session_reconnect':
        this.reconnecting = true;
        this.onStatus('reconnect', 'Twitch asked us to move sockets');
        this.#connect(msg.payload.session.reconnect_url);
        break;
      case 'notification': {
        this.#arm(10);
        const ev = normalize(msg.payload.subscription.type, msg.payload.event);
        if (ev) this.onEvent(ev);
        break;
      }
      case 'revocation': this.onStatus('revoked', msg.payload.subscription.type); break;
      default: break;
    }
  }

  async #subscribeAll(sessionId) {
    const token = await this.getToken();
    const results = await Promise.all(SUBSCRIPTIONS.map(async (s) => {
      const r = await this.fetchImpl(HELIX, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Client-Id': this.clientId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: s.type, version: s.version, condition: s.cond(this.broadcasterId), transport: { method: 'websocket', session_id: sessionId } }),
      });
      return { type: s.type, ok: r.ok, status: r.status, body: r.ok ? null : await r.text() };
    }));
    for (const r of results) this.onStatus(r.ok ? 'subscribed' : 'subscribe-failed', r.ok ? r.type : `${r.type}: ${r.status} ${r.body}`);
    return results;
  }
}
