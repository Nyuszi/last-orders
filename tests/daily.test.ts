import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneFor, withScene } from '../src/daily';

const day = (i: number) => new Date(Date.parse('2026-12-01T00:00:00Z') + i * 864e5).toISOString().slice(0, 10);

test('no scene line repeats within 24 days', () => {
  for (let start = 0; start < 400; start++) {
    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) seen.add(sceneFor(day(start + i)));
    assert.equal(seen.size, 24, `repeat in the 24 days from ${day(start)}`);
  }
});

test('only the scene line of a generated intro changes', () => {
  const lvl = { blurb: '3 orders tonight. The roof is leaking over the far end.', title: 'Bank Night' };
  const out = withScene(lvl, '2026-12-09');
  assert.match(out.blurb, /^3 orders tonight\. /);
  assert.equal(out.blurb, `3 orders tonight. ${sceneFor('2026-12-09')}`);
  assert.equal(out.title, 'Bank Night');
  // Handmade nights have their own written intro and are left alone.
  const hand = { blurb: 'Dutch and Two-Fist want drinks. The sheriff is watching.' };
  assert.equal(withScene(hand, '2026-12-09').blurb, hand.blurb);
});
