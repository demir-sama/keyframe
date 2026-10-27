import { ease as easeByName } from '/shared/easing.js';

/** Minimal tween manager: tween any numeric property with delay + named/custom easing. */
export class Tweens {
  constructor() { this.list = []; }
  to(obj, prop, to, dur, { delay = 0, ease = 'smooth', done } = {}) {
    this.list = this.list.filter((t) => !(t.obj === obj && t.prop === prop)); // newest wins
    this.list.push({ obj, prop, to, dur: Math.max(0.001, dur), delay, ease, t: 0, from: undefined, done });
  }
  update(dt) {
    for (const tw of this.list) {
      tw.t += dt;
      if (tw.t < tw.delay) continue;
      if (tw.from === undefined) tw.from = tw.obj[tw.prop];
      const k = Math.min(1, (tw.t - tw.delay) / tw.dur);
      const e = typeof tw.ease === 'function' ? tw.ease(k) : easeByName(tw.ease, k);
      tw.obj[tw.prop] = tw.from + (tw.to - tw.from) * e;
      if (k >= 1) { tw.finished = true; tw.done?.(); }
    }
    this.list = this.list.filter((t) => !t.finished);
  }
}
