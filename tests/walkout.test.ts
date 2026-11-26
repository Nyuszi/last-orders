import { test } from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim';
import { SOLUTIONS } from '../src/solutions';

// Tester report: the sheriff walked out, but his target stayed and a glass had to be poured
// to it. His served whiskey got knocked out of its circle afterwards, and the "Hey! I had
// that!" rule reopened the order of a customer who had already left.
test('a customer who walked out never gets an order reopened', () => {
  const level = LEVELS[0]; // night 1: the sheriff's whiskey is the first order
  assert.equal(level.orders[0].owner, 'sheriff');
  const sim = new Sim(level);
  sim.playShot(SOLUTIONS[level.id][0]);
  assert.ok(sim.orders[0].served, 'the first pour serves the sheriff');
  // He walks out (second touch of his hat), then his whiskey is knocked out of its circle.
  (sim as unknown as { walkOut(n: string): void }).walkOut('sheriff');
  const g = sim.glasses.find((x) => x.role === 'served' && x.order === 0)!;
  Matter.Body.setPosition(g.body!, { x: g.body!.position.x + 60, y: g.body!.position.y });
  sim.fire(-Math.PI / 2 + 0.6, 0.05, 0); // a weak pour, so the bar settles again
  for (let i = 0; i < 4000 && sim.status === 'rolling'; i++) sim.step();
  assert.notEqual(sim.orders[sim.nextOrder]?.owner, 'sheriff', 'the next order must not be for the sheriff');
  assert.ok(sim.orders.filter((o) => o.owner === 'sheriff').every((o) => o.served || o.cancelled));
  assert.ok(!sim.events.some((e) => e.t === 'say' && e.text === 'Hey! I had that!'), 'he is gone, so he says nothing');
});
