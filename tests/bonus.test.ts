import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim';

// Playtest report: a pour that only pushed the peanuts into Pete's spot showed ❌ (miss).
test('a pour that only earns the peanut bonus is recorded as a bonus, not a miss', () => {
  // Night 1 with the peanuts it used to have (the tutorial has none now).
  const level = { ...LEVELS.find((l) => l.id === 'n1')!, bowl: { x: 220, y: 384 }, bonus: { x: 236, y: 262, r: 22 } };
  const sim = new Sim(level);
  sim.fire((-138 * Math.PI) / 180, 0.88, 0);
  for (let i = 0; i < 4000 && sim.status === 'rolling'; i++) sim.step();
  assert.ok(sim.badges.has('Peanuts for Pete'), 'the shot should still push the bowl into the spot');
  assert.equal(sim.servedCount, 0);
  assert.equal(sim.pourResults[0], 'peanuts');
});
