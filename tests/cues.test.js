import test from 'node:test';
import assert from 'node:assert/strict';
import { Director } from '../src/director.js';
import { handleEvent } from '../src/cues.js';

const mk = () => new Director({ roundSeconds: 10, now: () => 0, rng: () => 0 });

test('follow/sub/raid yield fx cues and add heat', () => {
  const d = mk();
  assert.equal(handleEvent({ type: 'follow', user: 'x' }, d)[0].kind, 'follow');
  assert.equal(handleEvent({ type: 'raid', user: 'y', viewers: 100 }, d)[0].viewers, 100);
  assert.ok(d.heat > 0.5);
});

test('channel point reward with valid input applies directly', () => {
  const d = mk();
  const cues = handleEvent({ type: 'redeem', user: 'u', reward: 'Change Palette', input: 'forest' }, d);
  assert.equal(d.state.palette, 'forest');
  assert.ok(cues.some((c) => c.t === 'apply'));
});

test('reward with bad input picks a random value for that category', () => {
  const d = mk();
  handleEvent({ type: 'redeem', user: 'u', reward: 'Pick the Shape', input: 'zzz' }, d);
  assert.notEqual(d.state.shape, 'circle');
});

test('unknown reward only produces the fx cue', () => {
  const d = mk();
  const cues = handleEvent({ type: 'redeem', user: 'u', reward: 'Hydrate', input: '' }, d);
  assert.equal(cues.length, 1);
});
