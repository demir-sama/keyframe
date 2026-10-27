// Mock Twitch event source: lets the whole pipeline run (and be filmed/tested) without a Twitch app.
const NAMES = ['pixelpilot', 'mochi_motion', 'lagos_lines', 'EaseInOut', 'nova_frames', 'keyframe_kid', 'loopmaster', 'afterfx_ade', 'vector_vik', 'bezierbae', 'tweenqueen', 'splineboy'];
const COLORS = ['#ff6bd6', '#6bf0ff', '#ffd36b', '#9bff6b', '#c79bff'];
const pick = (a, r) => a[Math.floor(r() * a.length)];

export const VOTE_LINES = ['!ease bounce', '!ease elastic', '!ease snap', '!ease back', '!palette sunset', '!palette candy', '!palette forest', '!palette mono', '!shape star', '!shape tri', '!shape ring', '!shape square', '!tempo fast', '!tempo slow'];
export const CHATTER = ['this is so smooth', 'LETS GOOO', 'motion design!!', 'more bounce', 'the easing is chef kiss', 'can we get stars', 'first time here, love it'];

export function randomEvent(rng = Math.random) {
  const user = pick(NAMES, rng);
  const roll = rng();
  if (roll < 0.55) return { type: 'chat', user, text: pick(VOTE_LINES, rng), color: pick(COLORS, rng), isSub: rng() < 0.2 };
  if (roll < 0.8) return { type: 'chat', user, text: pick(CHATTER, rng), color: pick(COLORS, rng) };
  if (roll < 0.86) return { type: 'chat', user, text: '!pulse', color: pick(COLORS, rng) };
  if (roll < 0.91) return { type: 'follow', user };
  if (roll < 0.94) return { type: 'sub', user, tier: 1, months: 1 + Math.floor(rng() * 12) };
  if (roll < 0.96) return { type: 'cheer', user, bits: pick([100, 500, 1000], rng) };
  if (roll < 0.98) return { type: 'gift', user, total: pick([1, 5, 10], rng) };
  return { type: 'raid', user, viewers: 20 + Math.floor(rng() * 200) };
}

/** Free-running ambient simulation. */
export function startAmbient(emit, { everyMs = 900, rng = Math.random } = {}) {
  const h = setInterval(() => emit(randomEvent(rng)), everyMs);
  return () => clearInterval(h);
}

/** A scripted ~50 s showcase for filming the demo video. Times in ms. */
export const DEMO_SCRIPT = [
  [500, { type: 'chat', user: 'nova_frames', text: 'hey! first time here', color: '#6bf0ff' }],
  [1500, { type: 'chat', user: 'tweenqueen', text: '!ease bounce', color: '#ff6bd6' }],
  [1800, { type: 'chat', user: 'loopmaster', text: '!ease bounce', color: '#ffd36b' }],
  [2200, { type: 'chat', user: 'vector_vik', text: '!ease elastic', color: '#9bff6b', isSub: true }],
  [2600, { type: 'chat', user: 'bezierbae', text: '!palette sunset', color: '#c79bff' }],
  [3000, { type: 'chat', user: 'splineboy', text: '!palette sunset', color: '#6bf0ff' }],
  [3400, { type: 'chat', user: 'mochi_motion', text: '!shape star', color: '#ff6bd6' }],
  [3800, { type: 'chat', user: 'lagos_lines', text: '!shape star', color: '#ffd36b' }],
  [4200, { type: 'chat', user: 'EaseInOut', text: '!say animate everything', color: '#9bff6b' }],
  [8000, { type: 'follow', user: 'afterfx_ade' }],
  [12000, { type: 'chat', user: 'keyframe_kid', text: '!pulse', color: '#ff6bd6' }],
  [12400, { type: 'chat', user: 'pixelpilot', text: '!pulse', color: '#6bf0ff' }],
  [14000, { type: 'sub', user: 'vector_vik', tier: 1, months: 6 }],
  [20500, { type: 'chat', user: 'tweenqueen', text: '!tempo fast', color: '#ff6bd6' }],
  [20800, { type: 'chat', user: 'nova_frames', text: '!tempo fast', color: '#6bf0ff' }],
  [21000, { type: 'chat', user: 'bezierbae', text: '!palette candy', color: '#c79bff' }],
  [21300, { type: 'chat', user: 'loopmaster', text: '!shape ring', color: '#ffd36b' }],
  [21500, { type: 'chat', user: 'mochi_motion', text: '!shape ring', color: '#ff6bd6' }],
  [26000, { type: 'cheer', user: 'lagos_lines', bits: 500 }],
  [30000, { type: 'redeem', user: 'splineboy', reward: 'Change Palette', input: 'forest' }],
  [34000, { type: 'raid', user: 'motionmonday', viewers: 84 }],
  [40500, { type: 'chat', user: 'EaseInOut', text: '!ease snap', color: '#9bff6b' }],
  [40800, { type: 'chat', user: 'pixelpilot', text: '!ease snap', color: '#6bf0ff' }],
  [41200, { type: 'chat', user: 'nova_frames', text: '!shape tri', color: '#6bf0ff' }],
  [44000, { type: 'gift', user: 'afterfx_ade', total: 5 }],
  [47000, { type: 'hype', level: 3 }],
];
export function runScript(script, emit) {
  const hs = script.map(([ms, ev]) => setTimeout(() => emit(ev), ms));
  return () => hs.forEach(clearTimeout);
}
