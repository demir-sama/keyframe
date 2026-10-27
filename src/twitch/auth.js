// Device Code Grant Flow (public client) — no redirect URI or client secret needed.
// https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#device-code-grant-flow
import fs from 'node:fs';

const TOKEN_FILE = new URL('../../.tokens.json', import.meta.url);
const ID = 'https://id.twitch.tv/oauth2';

export const loadTokens = () => (fs.existsSync(TOKEN_FILE) ? JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) : null);
const save = (t) => fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2), { mode: 0o600 });
const form = (o) => new URLSearchParams(o);

export async function deviceLogin(clientId, scopes, log = console.log) {
  const r = await fetch(`${ID}/device`, { method: 'POST', body: form({ client_id: clientId, scopes: scopes.join(' ') }) });
  if (!r.ok) throw new Error(`device code request failed: ${r.status} ${await r.text()}`);
  const d = await r.json();
  log(`\nOpen ${d.verification_uri} and enter/confirm code:  ${d.user_code}\n`);
  const until = Date.now() + d.expires_in * 1000;
  while (Date.now() < until) {
    await new Promise((res) => setTimeout(res, (d.interval || 5) * 1000));
    const t = await fetch(`${ID}/token`, {
      method: 'POST',
      body: form({ client_id: clientId, scopes: scopes.join(' '), device_code: d.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    });
    if (t.ok) { const tok = await t.json(); const out = { ...tok, client_id: clientId, obtained_at: Date.now() }; save(out); return out; }
    const err = await t.json().catch(() => ({}));
    if (!/authorization_pending|slow_down/.test(err.message || '')) throw new Error(`token error: ${JSON.stringify(err)}`);
  }
  throw new Error('device code expired');
}

export async function refresh(tokens) {
  const r = await fetch(`${ID}/token`, { method: 'POST', body: form({ client_id: tokens.client_id, grant_type: 'refresh_token', refresh_token: tokens.refresh_token }) });
  if (!r.ok) throw new Error(`refresh failed: ${r.status} ${await r.text()}`);
  const t = { ...(await r.json()), client_id: tokens.client_id, obtained_at: Date.now() };
  save(t); return t;
}

/** Validate a token; refresh on 401. Returns {tokens, user_id, login}. */
export async function ensureValid(tokens) {
  let r = await fetch(`${ID}/validate`, { headers: { Authorization: `OAuth ${tokens.access_token}` } });
  if (r.status === 401) { tokens = await refresh(tokens); r = await fetch(`${ID}/validate`, { headers: { Authorization: `OAuth ${tokens.access_token}` } }); }
  if (!r.ok) throw new Error(`token validation failed: ${r.status}`);
  const v = await r.json();
  return { tokens, user_id: v.user_id, login: v.login, scopes: v.scopes };
}
