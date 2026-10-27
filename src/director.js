// The Director: owns the scene parameters, runs timed voting rounds, and tracks "heat".
import { CATEGORIES, DEFAULT_STATE } from '../shared/params.js';

const ALIASES = {
  ease: ['ease', 'easing', 'motion'],
  palette: ['palette', 'colors', 'colours', 'color', 'colour'],
  shape: ['shape', 'shapes'],
  tempo: ['tempo', 'speed'],
};
const ALIAS_TO_CAT = Object.fromEntries(
  Object.entries(ALIASES).flatMap(([cat, names]) => names.map((n) => [n, cat])),
);
const VALUE_ALIASES = { triangle: 'tri', squares: 'square', circles: 'circle', stars: 'star', rings: 'ring', normal: 'mid', medium: 'mid', springy: 'elastic', bouncy: 'bounce' };

/** Parse a chat line into a directive, or null. `!ease bounce` | `!vote ease bounce` | `!pulse` */
export function parseCommand(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t.startsWith('!')) return null;
  const [cmd, ...rest] = t.slice(1).split(/\s+/);
  if (cmd === 'pulse') return { kind: 'pulse' };
  if (cmd === 'say' && rest.length) return { kind: 'say', text: String(text).trim().slice(5).trim().slice(0, 60) };
  let cat = ALIAS_TO_CAT[cmd];
  let value = rest[0];
  if (cmd === 'vote') { cat = ALIAS_TO_CAT[rest[0]]; value = rest[1]; }
  if (!cat || !value) return null;
  value = VALUE_ALIASES[value] || value;
  if (!CATEGORIES[cat].includes(value)) return null;
  return { kind: 'vote', category: cat, value };
}

export class Director {
  constructor({ roundSeconds = 20, now = () => Date.now(), rng = Math.random } = {}) {
    this.roundMs = roundSeconds * 1000;
    this.now = now;
    this.rng = rng;
    this.state = { ...DEFAULT_STATE };
    this.heat = 0;
    this.reel = [];
    this.startedAt = now();
    this.#newRound();
  }

  #newRound() {
    this.round = { id: (this.round?.id ?? 0) + 1, endsAt: this.now() + this.roundMs, votes: {}, voters: {}, seq: 0 };
    for (const c of Object.keys(CATEGORIES)) { this.round.votes[c] = {}; this.round.voters[c] = {}; }
  }

  #log(type, payload) { this.reel.push({ at: this.now() - this.startedAt, type, ...payload }); }

  /** Handle a chat message. Returns an array of cues for the overlay. */
  onChat({ user, text, color, isSub = false, isMod = false }) {
    this.addHeat(0.035);
    const cmd = parseCommand(text);
    const cues = [];
    if (!cmd) { cues.push({ t: 'chat', user, text: String(text).slice(0, 80), color }); return cues; }
    if (cmd.kind === 'pulse') { this.addHeat(0.05); cues.push({ t: 'fx', kind: 'pulse', user }); return cues; }
    if (cmd.kind === 'say') { cues.push({ t: 'say', user, text: cmd.text, color }); return cues; }
    const weight = isSub || isMod ? 2 : 1;
    const r = this.round;
    const prev = r.voters[cmd.category][user];
    if (prev) r.votes[cmd.category][prev.value] -= prev.weight;
    r.votes[cmd.category][cmd.value] = (r.votes[cmd.category][cmd.value] || 0) + weight;
    r.voters[cmd.category][user] = { value: cmd.value, weight, seq: r.seq++ };
    cues.push({ t: 'vote', user, category: cmd.category, value: cmd.value, weight });
    return cues;
  }

  /** Tallies as {category: {value: weight}} with zero entries dropped. */
  tallies() {
    const out = {};
    for (const [c, vals] of Object.entries(this.round.votes)) {
      out[c] = Object.fromEntries(Object.entries(vals).filter(([, w]) => w > 0));
    }
    return out;
  }

  #winner(category) {
    const votes = this.round.votes[category];
    let best = null;
    for (const [value, w] of Object.entries(votes)) {
      if (w <= 0) continue;
      if (!best || w > best.w) best = { value, w };
      else if (w === best.w) { // tie → whichever got its first-in-round vote earlier wins
        const first = (v) => Math.min(...Object.values(this.round.voters[category]).filter((x) => x.value === v).map((x) => x.seq));
        if (first(value) < first(best.value)) best = { value, w };
      }
    }
    return best?.value ?? null;
  }

  /** Resolve the round now: apply winners, start next round. */
  resolveRound() {
    const changes = {};
    for (const c of Object.keys(CATEGORIES)) {
      const w = this.#winner(c);
      if (w && w !== this.state[c]) changes[c] = w;
    }
    const summary = this.tallies();
    const roundId = this.round.id;
    Object.assign(this.state, changes);
    this.#newRound();
    if (Object.keys(changes).length) this.#log('apply', { changes, via: 'vote', round: roundId });
    return { t: 'apply', changes, via: 'vote', round: roundId, summary };
  }

  /** Streamer / reward driven direct change. */
  force(changes, via = 'reward', user = '') {
    const ok = {};
    for (const [c, v] of Object.entries(changes)) if (CATEGORIES[c]?.includes(v)) ok[c] = v;
    if (!Object.keys(ok).length) return null;
    Object.assign(this.state, ok);
    this.#log('apply', { changes: ok, via, user });
    return { t: 'apply', changes: ok, via, user };
  }

  randomChange() {
    const cats = Object.keys(CATEGORIES);
    const c = cats[Math.floor(this.rng() * cats.length)];
    const opts = CATEGORIES[c].filter((v) => v !== this.state[c]);
    return { [c]: opts[Math.floor(this.rng() * opts.length)] };
  }

  randomFor(c) {
    const opts = CATEGORIES[c].filter((v) => v !== this.state[c]);
    return opts[Math.floor(this.rng() * opts.length)];
  }

  addHeat(x) { this.heat = Math.min(1, this.heat + x); }

  /** Advance time. Returns cues to broadcast (round resolution). */
  tick(dtMs) {
    this.heat *= Math.pow(0.5, dtMs / 8000); // half-life 8s
    const cues = [];
    if (this.now() >= this.round.endsAt) cues.push(this.resolveRound());
    return cues;
  }

  hud() {
    return { t: 'hud', state: this.state, heat: this.heat, round: { id: this.round.id, endsAt: this.round.endsAt, ms: this.roundMs }, tallies: this.tallies() };
  }
}
