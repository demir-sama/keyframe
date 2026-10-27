import test from 'node:test';
import assert from 'node:assert/strict';
import { Director, parseCommand } from '../src/director.js';

const mk = () => { let t = 0; const d = new Director({ roundSeconds: 10, now: () => t, rng: () => 0 }); return { d, adv: (ms) => { t += ms; return d.tick(ms); } }; };

test('parseCommand: votes, aliases, invalid', () => {
  assert.deepEqual(parseCommand('!ease Bounce'), { kind: 'vote', category: 'ease', value: 'bounce' });
  assert.deepEqual(parseCommand('!vote shape triangle'), { kind: 'vote', category: 'shape', value: 'tri' });
  assert.deepEqual(parseCommand('!speed fast'), { kind: 'vote', category: 'tempo', value: 'fast' });
  assert.equal(parseCommand('!ease banana'), null);
  assert.equal(parseCommand('hello'), null);
  assert.deepEqual(parseCommand('!pulse'), { kind: 'pulse' });
  assert.equal(parseCommand('!say hi there').text, 'hi there');
});

test('round: majority wins and applies at round end', () => {
  const { d, adv } = mk();
  d.onChat({ user: 'a', text: '!ease bounce' });
  d.onChat({ user: 'b', text: '!ease bounce' });
  d.onChat({ user: 'c', text: '!ease snap' });
  assert.equal(d.state.ease, 'smooth');
  const cues = adv(10_000);
  const apply = cues.find((c) => c.t === 'apply');
  assert.deepEqual(apply.changes, { ease: 'bounce' });
  assert.equal(d.state.ease, 'bounce');
  assert.equal(d.round.id, 2);
});

test('re-voting replaces previous vote; subs/mods count double', () => {
  const { d } = mk();
  d.onChat({ user: 'a', text: '!shape star' });
  d.onChat({ user: 'a', text: '!shape ring' });
  assert.deepEqual(d.tallies().shape, { ring: 1 });
  d.onChat({ user: 's', text: '!shape star', isSub: true });
  assert.deepEqual(d.tallies().shape, { ring: 1, star: 2 });
});

test('tie → earliest first vote wins', () => {
  const { d, adv } = mk();
  d.onChat({ user: 'a', text: '!palette candy' });
  d.onChat({ user: 'b', text: '!palette mono' });
  adv(10_000);
  assert.equal(d.state.palette, 'candy');
});

test('no votes → no change; winner equal to current is not a change', () => {
  const { d, adv } = mk();
  assert.deepEqual(adv(10_000)[0].changes, {});
  d.onChat({ user: 'a', text: '!ease smooth' });
  assert.deepEqual(adv(10_000)[0].changes, {});
});

test('heat rises with chat and decays', () => {
  const { d, adv } = mk();
  for (let i = 0; i < 10; i++) d.onChat({ user: 'u' + i, text: 'hi' });
  const h = d.heat; assert.ok(h > 0.3);
  adv(8_000); assert.ok(Math.abs(d.heat - h / 2) < 0.02);
});

test('force() validates and logs to reel', () => {
  const { d } = mk();
  assert.equal(d.force({ shape: 'nope' }), null);
  d.force({ shape: 'star' }, 'reward', 'x');
  assert.equal(d.state.shape, 'star');
  assert.equal(d.reel.at(-1).via, 'reward');
});
