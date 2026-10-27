export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mixRgb = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Path for a shape centred on origin with radius s. */
export function shapePath(ctx, shape, s) {
  ctx.beginPath();
  switch (shape) {
    case 'tri': for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * s * 1.15, Math.sin(a) * s * 1.15); } ctx.closePath(); break;
    case 'square': ctx.roundRect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7, s * 0.18); break;
    case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? s * 0.48 : s * 1.2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); break;
    case 'ring': ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.moveTo(s * 0.55, 0); ctx.arc(0, 0, s * 0.55, 0, Math.PI * 2, true); break;
    default: ctx.arc(0, 0, s, 0, Math.PI * 2);
  }
}
export function fillShape(ctx, shape, s) {
  shapePath(ctx, shape, s);
  if (shape === 'ring') ctx.fill('evenodd'); else ctx.fill();
}
