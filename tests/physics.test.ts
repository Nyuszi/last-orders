import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels';
import { BOWL_R, DRINK_MASS, GLASS_BOUNCE, POUR_R, Sim } from '../src/sim';

// Playtest: the aim line showed a thin cut on the peanut bowl that missed, and its bounce stubs
// were up to 50 degrees off. Round things are now true circles to the physics (40-sided
// bodies, hits resolved along the line of centres, grazes between steps caught), so the
// aim line's straight-line prediction must match the physics exactly.
test('the aim line predicts bowl hits and bounces exactly', () => {
  const L = LEVELS.find((l) => l.id === 'n2')!;
  const bowl = L.bowl!, s0 = L.start, R = BOWL_R + POUR_R;
  const centre = Math.atan2(bowl.y - s0.y, bowl.x - s0.x);
  const dist = Math.hypot(bowl.x - s0.x, bowl.y - s0.y);
  const edge = Math.asin(R / dist);
  let checked = 0;
  // From a full hit to just past each edge, including the thinnest cuts.
  for (let k = -1.04; k <= 1.04; k += 0.02) {
    const angle = centre + k * edge;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const along = (bowl.x - s0.x) * dx + (bowl.y - s0.y) * dy;
    const across = (bowl.x - s0.x) * -dy + (bowl.y - s0.y) * dx;
    const predicted = Math.abs(across) < R - 0.05; // the aim line's GRAZE
    if (Math.abs(Math.abs(across) - R) < 0.05) continue; // rounding noise either way
    const sim = new Sim(L);
    const b = sim.bowl!, mass = b.mass / DRINK_MASS;
    sim.fire(angle, 1, 0);
    const pour = sim.pour!.body!;
    let moved = false;
    for (let i = 0; i < 200 && sim.status === 'rolling' && !moved; i++) {
      sim.step();
      moved = Math.hypot(b.position.x - bowl.x, b.position.y - bowl.y) > 1e-6;
    }
    assert.equal(moved, predicted, `aim ${(angle * 180 / Math.PI).toFixed(2)}°: line says ${predicted ? 'hit' : 'miss'}`);
    if (!predicted) continue;
    // Where the circles touch, the bowl leaves along the line of centres and the drink keeps
    // its sideways speed and bounces back (heavier bowl) along that line: same as render.ts.
    const t = along - Math.sqrt(R * R - across * across);
    const cx = s0.x + dx * t, cy = s0.y + dy * t;
    const ux = (bowl.x - cx) / R, uy = (bowl.y - cy) / R;
    const vn = dx * ux + dy * uy, after = (1 - GLASS_BOUNCE * mass) / (1 + mass);
    const off = (a: number, x: number, y: number) => Math.abs(((a - Math.atan2(y, x)) * 180 / Math.PI + 540) % 360 - 180);
    assert.ok(off(Math.atan2(uy, ux), b.velocity.x, b.velocity.y) < 0.5, 'the bowl goes where the amber stub points');
    const ax = dx - vn * ux + ux * vn * after, ay = dy - vn * uy + uy * vn * after;
    if (Math.hypot(ax, ay) > 0.12) assert.ok(off(Math.atan2(ay, ax), pour.velocity.x, pour.velocity.y) < 0.5, 'the drink goes where the cream stub points');
    checked++;
  }
  assert.ok(checked > 80, 'most of the sweep hits the bowl');
});
