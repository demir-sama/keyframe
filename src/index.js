import { loadEnv } from './env.js';
import fs from 'node:fs';
import { createApp } from './server.js';
import { EventSubClient } from './twitch/eventsub.js';
import { loadTokens, ensureValid } from './twitch/auth.js';
import { startAmbient, runScript, DEMO_SCRIPT } from './mock/simulator.js';

loadEnv();
const PORT = Number(process.env.PORT || 8787);
const mock = process.env.MOCK === '1';
const log = (k, m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${k}${m ? ` — ${m}` : ''}`);

const app = createApp({ roundSeconds: Number(process.env.ROUND_SECONDS || 20), mock });
app.server.listen(PORT, () => {
  log('overlay', `http://localhost:${PORT}/  (OBS Browser Source 1920×1080)`);
  log('dashboard', `http://localhost:${PORT}/dashboard.html`);
});

if (mock) {
  log('mode', 'MOCK — simulated Twitch events');
  if (process.env.DEMO === '1') { log('demo', 'scripted showcase starts in 3s'); setTimeout(() => runScript(DEMO_SCRIPT, app.emit), 3000); }
  else startAmbient(app.emit);
} else {
  const clientId = process.env.TWITCH_CLIENT_ID;
  let tokens = loadTokens();
  if (!clientId || !tokens) { console.error('No Twitch credentials. Run `npm run auth` (see README), or use `npm run mock`.'); process.exit(1); }
  let v = await ensureValid(tokens); tokens = v.tokens;
  log('twitch', `authorized as ${v.login} (${v.user_id})`);
  const client = new EventSubClient({
    clientId, broadcasterId: v.user_id,
    getToken: async () => { const x = await ensureValid(tokens); tokens = x.tokens; return tokens.access_token; },
    onEvent: app.emit, onStatus: (k, m) => log(`eventsub:${k}`, m),
  });
  client.start();
}

process.on('SIGINT', () => {
  fs.mkdirSync('reels', { recursive: true });
  const f = `reels/reel-${Date.now()}.json`;
  fs.writeFileSync(f, JSON.stringify({ events: app.director.reel }, null, 2));
  log('reel', `saved ${f}`); process.exit(0);
});
