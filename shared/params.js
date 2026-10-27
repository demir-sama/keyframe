// The "director" parameters chat can vote on. Single source of truth for server + overlay.
export const PALETTES = {
  neon:   ['#00f5d4', '#9b5de5', '#f15bb5', '#fee440'],
  sunset: ['#ff5f6d', '#ffc371', '#ff8e53', '#6a1b9a'],
  mono:   ['#ffffff', '#c7c7d1', '#8d8da0', '#4b4b5e'],
  candy:  ['#ff9ff3', '#feca57', '#48dbfb', '#1dd1a1'],
  forest: ['#b8f2a0', '#4fd27a', '#1f9d6b', '#e9ffb8'],
};
export const SHAPES = ['circle', 'tri', 'square', 'star', 'ring'];
export const TEMPOS = { slow: 1.6, mid: 1.0, fast: 0.55 }; // duration multipliers
export const CATEGORIES = {
  ease: Object.keys({ smooth: 1, bounce: 1, elastic: 1, snap: 1, back: 1 }),
  palette: Object.keys(PALETTES),
  shape: SHAPES,
  tempo: Object.keys(TEMPOS),
};
export const DEFAULT_STATE = { ease: 'smooth', palette: 'neon', shape: 'circle', tempo: 'mid' };
