import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels';
import { COMBO_TIP, Sim } from '../src/sim';
import { BONUS_BADGE, bonusKinds, findCombo, findSolution, replay } from '../src/solver';
import { SOLUTIONS } from '../src/solutions';

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

// Playtest suggestion: one pour should be able to earn the bonus and serve a drink.
test('every handmade bonus can be earned by a pour that also serves a drink (combo)', { timeout: 600000 }, () => {
  for (const level of LEVELS) {
    const kinds = bonusKinds(level);
    if (!kinds.length) continue;
    const sol = findSolution(level, { robustNeeded: 1, maxSimsPerOrder: 20000 })!;
    for (const kind of kinds) {
      const combo = findCombo(level, sol.shots, kind);
      assert.ok(combo, `${level.title}: no combo for the ${kind}`);
      const sim = replay(level, [...sol.shots.slice(0, combo.order), combo.shot]);
      assert.ok(sim.badges.has('Combo') && sim.badges.has(BONUS_BADGE[kind]));
      assert.ok(sim.orders.some((o) => o.served && o.tip >= COMBO_TIP + 10), 'the combo tip is paid on the served drink');
    }
  }
});

test('a perfect serve earns a spare glass', () => {
  const level = LEVELS[0];
  const sol = findSolution(level, { robustNeeded: 1, maxSimsPerOrder: 20000 })!;
  const base = sol.shots[0];
  // Nudge the first proven pour until it lands dead centre.
  for (let da = -1.5; da <= 1.5; da += 0.1) {
    for (let dp = -0.04; dp <= 0.04; dp += 0.004) {
      const sim = replay(level, [{ ...base, angle: base.angle + (da * Math.PI) / 180, power: base.power + dp }]);
      if (sim.orders[0].quality !== 3) continue;
      assert.equal(sim.extraPours, 1);
      assert.equal(sim.poursLeft, level.pours, 'one glass used, one earned back');
      assert.ok(sim.events.some((e) => e.t === 'extra'));
      return;
    }
  }
  assert.fail('no perfect pour found near the proven first pour');
});

// After the round-hitbox change the stored "Show me how" pours for nights 2 and 3 stopped
// after one order. They must always finish the night, and play every bonus as a combo.
test('"Show me how" finishes every practice night and plays its combos', () => {
  for (const level of LEVELS) {
    const sim = replay(level, SOLUTIONS[level.id]);
    assert.equal(sim.status, 'won', `${level.title}: the lesson doesn't finish the night (npm run solutions)`);
    assert.ok(!sim.hatWarned, `${level.title}: the lesson touches the sheriff's hat`);
    for (const kind of bonusKinds(level)) assert.ok(sim.badges.has(BONUS_BADGE[kind]) && sim.badges.has('Combo'), `${level.title}: the lesson skips the ${kind} combo`);
  }
});
