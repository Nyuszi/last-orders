import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkOrder, successRate, AVERAGE, DEFAULT_RULES } from '../src/fairness';
import { LEVELS } from '../src/levels';
import { SERVE_REACH } from '../src/sim';
import { SOLUTIONS } from '../src/solutions';

const DEG = Math.PI / 180;
const level = LEVELS[0];
const shot = SOLUTIONS[level.id][0];

test('the first handmade night is fair for an average player', () => {
  const p = successRate(level, [], shot, 0, AVERAGE, 100);
  assert.ok(p >= 0.5, `first pour served only ${(p * 100).toFixed(0)}% of the time`);
  assert.equal(checkOrder(level, [], shot, 0, DEFAULT_RULES).ok, true);
});

test('a pour found at the edge of what works is moved back to the middle', () => {
  const centre = checkOrder(level, [], shot, 0, DEFAULT_RULES);
  // Push the pour almost to the edge of its aim window, where a near-miss check can still pass.
  const edge = { ...centre.shot, angle: centre.shot.angle + (centre.angle[1] - 0.2) * DEG };
  const again = checkOrder(level, [], edge, 0, DEFAULT_RULES);
  assert.ok(Math.min(...again.angle) >= 1, `windows after centring: ${again.angle}`);
  assert.equal(again.ok, true);
});

test('a target too small for a human hand is rejected', () => {
  const tiny = { ...level, orders: level.orders.map((o, i) => (i === 0 ? { ...o, r: 5 - SERVE_REACH } : o)) };
  const c = checkOrder(tiny, [], shot, 0, DEFAULT_RULES);
  assert.equal(c.ok, false, `expected a rejection, got ${JSON.stringify({ angle: c.angle, power: c.power, success: c.success })}`);
});
