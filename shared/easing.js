// Easing library shared by server (validation) and overlay (animation).
const c1 = 1.70158, c3 = c1 + 1, c4 = (2 * Math.PI) / 3;
const bounceOut = (x) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};
export const EASES = {
  smooth: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  bounce: bounceOut,
  elastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1),
  snap: (x) => 1 - Math.pow(1 - x, 6),
  back: (x) => 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2),
};
export const EASE_NAMES = Object.keys(EASES);
export const ease = (name, x) => (EASES[name] || EASES.smooth)(Math.min(1, Math.max(0, x)));
export const lerp = (a, b, t) => a + (b - a) * t;
