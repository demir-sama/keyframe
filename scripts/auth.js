// npm run auth — authorize KEYFRAME against your channel (device code flow).
import { loadEnv } from '../src/env.js';
import { deviceLogin, ensureValid } from '../src/twitch/auth.js';
import { ALL_SCOPES } from '../src/twitch/normalize.js';

loadEnv();
const id = process.env.TWITCH_CLIENT_ID;
if (!id) { console.error('Set TWITCH_CLIENT_ID in .env first (dev.twitch.tv/console → Register Your Application, Client Type: Public).'); process.exit(1); }
const tokens = await deviceLogin(id, ALL_SCOPES);
const v = await ensureValid(tokens);
console.log(`Authorized as ${v.login} (${v.user_id}). Scopes: ${v.scopes.join(', ')}`);
