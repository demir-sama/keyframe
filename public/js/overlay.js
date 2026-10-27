// KEYFRAME overlay — a canvas motion-graphics scene directed by Twitch chat.
import { ease, EASES } from '/shared/easing.js';
import { PALETTES, TEMPOS, DEFAULT_STATE } from '/shared/params.js';
import { Tweens } from '/js/tween.js';
import { hexToRgb, mixRgb, rgba, fillShape } from '/js/draw.js';

const W = 1920, H = 1080;
const q = new URLSearchParams(location.search);
const AX = Number(q.get('x') ?? 0.74) * W, AY = Number(q.get('y') ?? 0.5) * H, SCALE = Number(q.get('scale') ?? 1);
const SHOW_HUD = q.get('hud') !== '0';
if (q.get('preview') === '1') document.body.classList.add('preview');

const cv = document.getElementById('c'); const ctx = cv.getContext('2d');
const tw = new Tweens();
const state = { ...DEFAULT_STATE };
let heat = 0, heatShown = 0, round = { id: 1, endsAt: Date.now() + 20000, ms: 20000 }, tallies = {}, serverSkew = 0;

const tempoK = () => TEMPOS[state.tempo];
const pal = (name = state.palette) => PALETTES[name].map(hexToRgb);

// ---------- actor: three concentric rings of shapes ----------
const RINGS = [{ n: 6, r: 120, s: 26 }, { n: 12, r: 230, s: 20 }, { n: 18, r: 340, s: 15 }];
const actor = [];
RINGS.forEach((ring, ri) => { for (let i = 0; i < ring.n; i++) actor.push({
  ri, i, n: ring.n, a0: (i / ring.n) * Math.PI * 2 + ri * 0.4, r: 0, size: ring.s, shape: state.shape, shapeScale: 0, kick: 0,
  from: pal(), to: pal(), mix: 1, ci: (ri + i) % 4,
}); });
actor.forEach((p, k) => tw.to(p, 'shapeScale', 1, 0.9, { delay: 0.2 + k * 0.025, ease: 'back' })); // intro
actor.forEach((p, k) => tw.to(p, 'r', RINGS[p.ri].r, 1.1, { delay: 0.1 + k * 0.02, ease: 'elastic' }));

function applyChanges(ch) {
  if (ch.palette) {
    actor.forEach((p, k) => { p.from = [0, 1, 2, 3].map((i) => colorOf(p, i)); p.to = pal(ch.palette); p.mix = 0; tw.to(p, 'mix', 1, 0.9 * tempoK(), { delay: k * 0.02 * tempoK(), ease: 'smooth' }); });
  }
  if (ch.shape) {
    actor.forEach((p, k) => tw.to(p, 'shapeScale', 0, 0.22 * tempoK(), { delay: k * 0.015 * tempoK(), ease: 'snap', done: () => { p.shape = ch.shape; tw.to(p, 'shapeScale', 1, 0.7 * tempoK(), { ease: state.ease === 'smooth' ? 'back' : state.ease }); } }));
  }
  Object.assign(state, ch); // ease/tempo take effect continuously in the idle breathing
  if (ch.ease || ch.tempo) breathBoost = 1; // exaggerate the next breaths so viewers see the new personality
}
const colorOf = (p, i = p.ci) => { const a = p.from[i % p.from.length], b = p.to[i % p.to.length]; return mixRgb(a, b, p.mix); };
let breathBoost = 0;

// ---------- particles (bursts, confetti) ----------
const bits = [];
function burst(x, y, n, { speed = 700, size = 14, life = 1.4, gravity = 900, shapeName } = {}) {
  const colors = pal();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
    bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.2, g: gravity, size: size * (0.5 + Math.random()), life, age: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, c: colors[i % 4], shape: shapeName || state.shape });
  }
}
function rain(n, dur = 2.2) {
  const colors = pal();
  for (let i = 0; i < n; i++) bits.push({ x: Math.random() * W, y: -40 - Math.random() * 400, vx: (Math.random() - 0.5) * 120, vy: 250 + Math.random() * 350, g: 200, size: 10 + Math.random() * 16, life: dur + Math.random(), age: -Math.random() * 0.8, rot: 0, vr: (Math.random() - 0.5) * 8, c: colors[i % 4], shape: state.shape });
}

// ---------- shockwaves ----------
const waves = [];
const shock = (x = AX, y = AY, strength = 1) => waves.push({ x, y, r: 40, age: 0, life: 1.1 / Math.sqrt(strength), maxR: 520 + 300 * strength, c: pal()[1] });

// ---------- banners (follow / sub / raid / apply …) ----------
const banners = []; const bannerQueue = [];
function banner({ kicker, title, sub, count, accent = 0 }) {
  bannerQueue.push({ kicker, title, sub, count, accent });
}
function pumpBanners(dt) {
  if (bannerQueue.length && banners.length < 2) {
    const b = bannerQueue.shift();
    const o = { ...b, x: -700, wipe: 0, text: 0, out: 0, age: 0, shown: 0 };
    banners.push(o);
    tw.to(o, 'x', 64, 0.7 * tempoK(), { ease: state.ease }); tw.to(o, 'wipe', 1, 0.5 * tempoK(), { ease: 'snap' }); tw.to(o, 'text', 1, 0.9 * tempoK(), { delay: 0.2, ease: 'back' });
    if (b.count) tw.to(o, 'shown', b.count, 1.2, { delay: 0.3, ease: 'snap' });
  }
  for (const b of banners) {
    b.age += dt;
    if (b.age > 3.4 && !b.leaving) { b.leaving = true; tw.to(b, 'out', 1, 0.5, { ease: 'smooth', done: () => { b.dead = true; } }); }
  }
  for (let i = banners.length - 1; i >= 0; i--) if (banners[i].dead) banners.splice(i, 1);
}

// ---------- kinetic type: chat lines + !say titles ----------
const lines = []; const titles = [];
function chatLine(user, text, color) {
  const l = { user, text, color: color || rgba(pal()[0]), age: 0, a: 0, y: 0, ty: 0 };
  lines.forEach((o) => { o.ty -= 38; }); lines.push(l);
  if (lines.length > 5) lines.shift();
  tw.to(l, 'a', 1, 0.3, {});
  for (const o of lines) tw.to(o, 'y', o.ty, 0.45 * tempoK(), { ease: state.ease });
}
function sayTitle(user, text, color) {
  const t = { user, text, color, age: 0, chars: [...text].map(() => ({ p: 0 })), out: 0 };
  t.chars.forEach((c, i) => tw.to(c, 'p', 1, 0.7 * tempoK(), { delay: i * 0.035 * tempoK(), ease: state.ease === 'smooth' ? 'back' : state.ease }));
  titles.push(t); if (titles.length > 2) titles.shift();
}

// ---------- vote HUD ----------
const hud = { rows: {}, ringP: 0, flash: {} };
const CATS = ['ease', 'palette', 'shape', 'tempo'];
CATS.forEach((c) => { hud.rows[c] = { bars: {}, cur: 0, flash: 0 }; });
function updateHudTargets() {
  for (const c of CATS) {
    const row = hud.rows[c]; const t = tallies[c] || {}; const total = Math.max(1, Object.values(t).reduce((a, b) => a + b, 0));
    for (const [k, v] of Object.entries(t)) { row.bars[k] ??= { w: 0, v: 0, tw: 0 }; row.bars[k].tw = v / total; row.bars[k].v = v; }
    for (const k of Object.keys(row.bars)) if (!t[k]) row.bars[k].tw = 0;
  }
}

// ---------- cue handling ----------
function onCue(m) {
  switch (m.t) {
    case 'hello': case 'hud':
      Object.assign(state, m.state && m.t === 'hello' ? m.state : {});
      heat = m.heat; round = m.round; tallies = m.tallies; serverSkew = 0; updateHudTargets();
      if (m.t === 'hello') { actor.forEach((p) => { p.shape = state.shape; p.from = p.to = pal(); p.mix = 1; }); }
      break;
    case 'chat': chatLine(m.user, m.text, m.color); break;
    case 'say': sayTitle(m.user, m.text, m.color); break;
    case 'vote': { const row = hud.rows[m.category]; row.flash = 1; tw.to(row, 'flash', 0, 0.8, { ease: 'smooth' }); break; }
    case 'apply': {
      applyChanges(m.changes);
      const keys = Object.keys(m.changes);
      if (keys.length) {
        shock(AX, AY, 0.8);
        banner({ kicker: m.via === 'vote' ? 'CHAT DECIDED' : 'REDEEMED BY ' + (m.user || 'viewer').toUpperCase(), title: keys.map((k) => `${k} → ${m.changes[k]}`).join('   ·   '), accent: 1 });
      } else if (m.via === 'vote') { tw.to(hud, 'ringP', 0, 0.01); }
      break;
    }
    case 'fx': fx(m); break;
  }
}
function fx(m) {
  switch (m.kind) {
    case 'pulse': actor.forEach((p, k) => { p.kick = 0; tw.to(p, 'kick', 1, 0.28 * tempoK(), { delay: p.ri * 0.08 * tempoK() + k * 0.004, ease: 'snap', done: () => tw.to(p, 'kick', 0, 0.6 * tempoK(), { ease: state.ease }) }); }); shock(AX, AY, 0.5); break;
    case 'follow': banner({ kicker: 'NEW FOLLOW', title: m.user, sub: 'welcome to the stage' }); burst(220, H - 220, 16, { speed: 500 }); break;
    case 'sub': banner({ kicker: m.months > 1 ? `RESUB × ${m.months}` : 'NEW SUB', title: m.user, sub: 'chat votes now count double', accent: 2 }); shock(AX, AY, 1.4); burst(AX, AY, 46, { speed: 900 }); break;
    case 'gift': banner({ kicker: 'GIFT SUBS', title: m.user, sub: 'spread the love', count: m.total, accent: 2 }); rain(30 + m.total * 6); break;
    case 'cheer': banner({ kicker: 'CHEERED', title: m.user, count: m.bits, sub: 'bits', accent: 3 }); rain(Math.min(160, 20 + m.bits / 8), 3); break;
    case 'raid': banner({ kicker: 'INCOMING RAID', title: m.user, count: m.viewers, sub: 'viewers', accent: 3 }); window._sweep = 0; tw.to(window, '_sweep', 1, 1.4, { ease: 'snap' }); shock(AX, AY, 2); burst(AX, AY, 80, { speed: 1100 }); break;
    case 'hype': banner({ kicker: 'HYPE TRAIN', title: `LEVEL ${m.level}`, accent: 3 }); shock(AX, AY, 1.6); shock(AX, AY, 2.2); actor.forEach((p) => { p.kick = 0; tw.to(p, 'kick', 1, 0.4, { ease: 'elastic', done: () => tw.to(p, 'kick', 0, 1.2, { ease: 'smooth' }) }); }); break;
    case 'redeem': banner({ kicker: 'REWARD', title: m.reward, sub: `by ${m.user}` }); break;
  }
}
window._sweep = 0;

// ---------- websocket ----------
function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onmessage = (e) => onCue(JSON.parse(e.data));
  ws.onclose = () => setTimeout(connect, 1000);
}
connect();

// ---------- render loop ----------
let T = 0, last = performance.now(), spin = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  tw.update(dt); pumpBanners(dt);
  heatShown += (heat - heatShown) * Math.min(1, dt * 4);
  spin += dt * (0.25 + heatShown * 1.6) * (1 / tempoK());
  breathBoost = Math.max(0, breathBoost - dt * 0.35);
  ctx.clearRect(0, 0, W, H);
  drawActor(); drawWaves(dt); drawBits(dt); drawSweep();
  drawTitles(dt); drawChat(dt); drawBanners(); if (SHOW_HUD) drawHud(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function drawActor() {
  ctx.save(); ctx.translate(AX, AY); ctx.scale(SCALE, SCALE);
  // soft core glow that swells with heat
  const colors = pal(); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 260 + heatShown * 160);
  g.addColorStop(0, rgba(colors[0], 0.20 + heatShown * 0.25)); g.addColorStop(1, rgba(colors[0], 0));
  ctx.fillStyle = g; ctx.fillRect(-500, -500, 1000, 1000);
  ctx.globalCompositeOperation = 'lighter';
  const period = 3.2 * tempoK();
  for (const p of actor) {
    // idle "breathing": the ease personality is visible continuously, staggered around each ring
    const ph = (((T / period) - (p.i / p.n) * 0.5 - p.ri * 0.12) % 1 + 1) % 1;
    const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    const b = ease(state.ease, tri);
    const amp = 0.14 + breathBoost * 0.18 + heatShown * 0.12;
    const dir = p.ri % 2 ? -1 : 1;
    const ang = p.a0 + spin * dir * (1 - p.ri * 0.18);
    const rad = p.r * (1 + amp * b) + p.kick * 40;
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
    const s = p.size * p.shapeScale * (0.85 + 0.35 * b + p.kick * 0.9) * (1 + heatShown * 0.2);
    if (s < 0.2) continue;
    const c = colorOf(p);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang * (p.shape === 'ring' ? 0 : 1.5) + T * 0.4 * dir);
    ctx.fillStyle = rgba(c, 0.9); ctx.shadowColor = rgba(c, 0.8); ctx.shadowBlur = 12 + heatShown * 24;
    fillShape(ctx, p.shape, s); ctx.restore();
    // hairline tether to ring neighbour for a "constellation" look
    if (p.ri === 0) { ctx.strokeStyle = rgba(c, 0.10 + 0.1 * b); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke(); }
  }
  ctx.restore();
}
function drawWaves(dt) {
  for (const w of waves) {
    w.age += dt; const k = w.age / w.life; w.r = 40 + (w.maxR - 40) * ease('snap', k);
    ctx.strokeStyle = rgba(w.c, (1 - k) * 0.8); ctx.lineWidth = 10 * (1 - k) + 1; ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
  }
  for (let i = waves.length - 1; i >= 0; i--) if (waves[i].age >= waves[i].life) waves.splice(i, 1);
}
function drawBits(dt) {
  for (const b of bits) {
    b.age += dt; if (b.age < 0) continue;
    b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
    const k = b.age / b.life; if (k >= 1) continue;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = rgba(b.c, 1 - k * k); fillShape(ctx, b.shape, b.size * (1 - k * 0.4)); ctx.restore();
  }
  for (let i = bits.length - 1; i >= 0; i--) if (bits[i].age >= bits[i].life || bits[i].y > H + 80) bits.splice(i, 1);
}
function drawSweep() {
  const s = window._sweep; if (s <= 0 || s >= 1) return;
  const c = pal()[2];
  ctx.fillStyle = rgba(c, 0.85 * (1 - s)); ctx.fillRect(-200 + (W + 400) * s - 120, 0, 240, H);
  ctx.fillStyle = rgba(c, 0.25 * (1 - s)); ctx.fillRect(0, 0, (W + 200) * s, H);
}
function drawTitles(dt) {
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (const t of titles) {
    t.age += dt; const fade = t.age > 4 ? Math.max(0, 1 - (t.age - 4) * 2) : 1;
    ctx.font = '800 76px "Inter", "Segoe UI", system-ui, sans-serif';
    const total = ctx.measureText(t.text).width; let x = AX - total / 2; const y = AY - 460 * SCALE * 0.92 + titles.indexOf(t) * 0;
    [...t.text].forEach((ch, i) => {
      const w = ctx.measureText(ch).width; const p = t.chars[i].p;
      ctx.save(); ctx.globalAlpha = Math.min(1, p * 2) * fade; ctx.translate(x + w / 2, y + (1 - p) * 90); ctx.scale(1, 0.4 + 0.6 * Math.min(1.3, p)); ctx.rotate((1 - p) * 0.4);
      ctx.fillStyle = '#fff'; ctx.shadowColor = rgba(pal()[0], 0.9); ctx.shadowBlur = 24; ctx.textAlign = 'center'; ctx.fillText(ch, 0, 0); ctx.restore(); x += w;
    });
    ctx.save(); ctx.globalAlpha = 0.8 * fade * Math.min(1, t.age); ctx.font = '600 22px system-ui, sans-serif'; ctx.fillStyle = rgba(pal()[1]); ctx.textAlign = 'center'; ctx.fillText(`— ${t.user}`, AX, y + 60); ctx.restore();
  }
  for (let i = titles.length - 1; i >= 0; i--) if (titles[i].age > 4.6) titles.splice(i, 1);
}
function drawChat(dt) {
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  for (const l of lines) {
    l.age += dt; const fade = l.age > 6 ? Math.max(0, 1 - (l.age - 6) * 1.5) : 1;
    ctx.save(); ctx.globalAlpha = l.a * fade; ctx.translate(64 + (1 - l.a) * -40, H - 60 + l.y);
    ctx.font = '700 24px system-ui, sans-serif'; ctx.fillStyle = l.color; ctx.fillText(l.user, 0, 0);
    const w = ctx.measureText(l.user).width; ctx.font = '500 24px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText('  ' + l.text, w, 0); ctx.restore();
  }
  while (lines.length && lines[0].age > 7) lines.shift();
}
function drawBanners() {
  banners.forEach((b, idx) => {
    const y = 120 + idx * 150; const accent = pal()[b.accent % 4];
    const title = (b.count ? `${b.title}  ·  ${Math.round(b.shown).toLocaleString()}` : b.title).slice(0, 64);
    ctx.font = '800 38px system-ui, sans-serif';
    const bw = Math.max(560, Math.min(1100, ctx.measureText(title).width + 80));
    ctx.save(); ctx.translate(b.x - b.out * 1200, y);
    ctx.fillStyle = 'rgba(12,12,22,0.82)'; ctx.beginPath(); ctx.roundRect(0, 0, bw * b.wipe, 120, 14); ctx.fill();
    ctx.fillStyle = rgba(accent); ctx.fillRect(0, 0, 10, 120 * b.wipe);
    ctx.beginPath(); ctx.roundRect(0, 0, bw * b.wipe, 120, 14); ctx.clip();
    ctx.globalAlpha = Math.min(1, b.text * 1.5); ctx.translate(34, (1 - Math.min(1, b.text)) * 24);
    ctx.font = '700 18px system-ui, sans-serif'; ctx.fillStyle = rgba(accent); ctx.letterSpacing = '4px'; ctx.fillText(b.kicker, 0, 34); ctx.letterSpacing = '0px';
    ctx.font = '800 38px system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(title, 0, 78);
    if (b.sub) { ctx.font = '500 18px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillText(b.sub, 0, 104); }
    ctx.restore();
  });
}
function drawHud(dt) {
  const colors = pal();
  const remaining = Math.max(0, round.endsAt - Date.now()); const frac = Math.min(1, remaining / round.ms);
  // panel: top-left column under banners
  const px = 64, py = 560;
  ctx.save(); ctx.translate(px, py);
  ctx.fillStyle = 'rgba(12,12,22,0.72)'; ctx.beginPath(); ctx.roundRect(0, 0, 420, 232, 16); ctx.fill();
  ctx.strokeStyle = rgba(colors[1], 0.35); ctx.lineWidth = 2; ctx.stroke();
  ctx.font = '800 16px system-ui, sans-serif'; ctx.letterSpacing = '3px'; ctx.fillStyle = rgba(colors[0]); ctx.fillText('CHAT DIRECTS · ROUND ' + round.id, 20, 30); ctx.letterSpacing = '0px';
  // timer arc
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(386, 26, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = rgba(colors[0]); ctx.beginPath(); ctx.arc(386, 26, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
  CATS.forEach((c, i) => {
    const row = hud.rows[c]; const y = 68 + i * 38;
    ctx.font = '700 14px system-ui, sans-serif'; ctx.fillStyle = `rgba(255,255,255,${0.55 + row.flash * 0.45})`; ctx.fillText(c.toUpperCase(), 20, y + 6);
    ctx.font = '700 18px system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(state[c], 100, y + 6);
    // stacked vote bar: one segment per candidate, widths ease toward live tally share
    const entries = Object.entries(row.bars);
    entries.forEach(([, bar]) => { bar.w += (bar.tw - bar.w) * Math.min(1, dt * 8); });
    let bx = 200; const BW = 200;
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.roundRect(200, y - 12, BW, 24, 6); ctx.fill();
    entries.sort((a, b) => b[1].tw - a[1].tw).forEach(([k, bar], j) => {
      const w = bar.w * BW; if (w < 3) return;
      ctx.fillStyle = rgba(colors[j % 4], 0.9); ctx.beginPath(); ctx.roundRect(bx + 1, y - 11, Math.max(2, w - 2), 22, 5); ctx.fill();
      if (w > 44) { ctx.font = '700 12px system-ui, sans-serif'; ctx.fillStyle = '#0b0b14'; ctx.fillText(k, bx + 7, y + 4); }
      bx += w;
    });
  });
  ctx.font = '500 13px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillText('type !ease  !palette  !shape  !tempo  !pulse  !say', 20, 216);
  ctx.restore();
}
