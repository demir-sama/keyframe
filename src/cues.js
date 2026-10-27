// Maps normalized Twitch events → director side-effects + overlay cues.
import { CATEGORIES } from '../shared/params.js';

// channel-point reward title keywords → what they do. Streamer can rename rewards to match.
export function rewardAction(title = '', input = '', director) {
  const t = title.toLowerCase();
  const word = String(input).trim().toLowerCase();
  const pick = (cat) => (CATEGORIES[cat].includes(word) ? word : null);
  for (const cat of Object.keys(CATEGORIES)) {
    if (t.includes(cat)) return director.force({ [cat]: pick(cat) ?? director.randomFor(cat) }, 'reward');
  }
  if (t.includes('chaos')) { director.addHeat(1); return director.force(director.randomChange(), 'reward'); }
  return null;
}

/** @returns cues[] */
export function handleEvent(ev, director) {
  switch (ev.type) {
    case 'chat': return director.onChat(ev);
    case 'follow': director.addHeat(0.12); return [{ t: 'fx', kind: 'follow', user: ev.user }];
    case 'sub': director.addHeat(0.3); return [{ t: 'fx', kind: 'sub', user: ev.user, tier: ev.tier || 1, months: ev.months || 1 }];
    case 'gift': director.addHeat(Math.min(1, 0.2 + ev.total * 0.05)); return [{ t: 'fx', kind: 'gift', user: ev.user, total: ev.total || 1 }];
    case 'cheer': director.addHeat(Math.min(1, 0.1 + ev.bits / 1000)); return [{ t: 'fx', kind: 'cheer', user: ev.user, bits: ev.bits }];
    case 'raid': director.addHeat(Math.min(1, 0.3 + ev.viewers / 200)); return [{ t: 'fx', kind: 'raid', user: ev.user, viewers: ev.viewers }];
    case 'hype': director.addHeat(0.5); return [{ t: 'fx', kind: 'hype', level: ev.level || 1 }];
    case 'redeem': {
      const cue = rewardAction(ev.reward, ev.input, director);
      return [{ t: 'fx', kind: 'redeem', user: ev.user, reward: ev.reward }, ...(cue ? [cue] : [])];
    }
    default: return [];
  }
}
