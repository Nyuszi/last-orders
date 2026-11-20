import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, type Level } from '../src/levels';
import { makeRng, hashString } from '../src/rng';
import { candidate, dailyLevel, dayIndex, structureProblems, todayKey } from '../src/generator';
import { findSolution, replay } from '../src/solver';

const SLOW = { timeout: 600_000 };

function dates(start: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

test('rng: same seed gives the same sequence, different seeds differ', () => {
  const a = makeRng('2026-11-20'), b = makeRng('2026-11-20'), c = makeRng('2026-11-21');
  const sa = Array.from({ length: 20 }, () => a.next());
  const sb = Array.from({ length: 20 }, () => b.next());
  const sc = Array.from({ length: 20 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.equal(hashString('abc'), hashString('abc'));
});

test('rng: int stays inside its bounds', () => {
  const r = makeRng(42);
  for (let i = 0; i < 5000; i++) {
    const v = r.int(3, 7);
    assert.ok(v >= 3 && v <= 7 && Number.isInteger(v));
  }
});

test('days: the day flips in UTC, Monday is the easiest day', () => {
  assert.equal(todayKey(new Date('2026-11-20T23:59:59Z')), '2026-11-20');
  assert.equal(todayKey(new Date('2026-11-21T00:00:00Z')), '2026-11-21');
  assert.equal(dayIndex('2026-11-16'), 0); // a Monday
  assert.equal(dayIndex('2026-11-22'), 6); // a Sunday
});

test('same date gives exactly the same map for everyone', () => {
  for (const date of dates('2026-11-16', 7)) {
    assert.deepEqual(candidate(date, 0), candidate(date, 0));
    assert.deepEqual(JSON.parse(JSON.stringify(candidate(date, 3))), JSON.parse(JSON.stringify(candidate(date, 3))));
  }
  const first = dailyLevel('2026-11-23');
  const second = dailyLevel('2026-11-23');
  assert.deepEqual(first.level, second.level);
  assert.deepEqual(first.solution, second.solution);
});

test('different dates give different maps', () => {
  const seen = new Set(dates('2026-12-01', 30).map((d) => JSON.stringify(candidate(d, 0).orders)));
  assert.ok(seen.size >= 28, `only ${seen.size} different maps in 30 days`);
});

test('candidates are well formed: on the counter, no overlaps, clear start', () => {
  let clean = 0;
  for (const date of dates('2026-01-01', 120)) {
    const level = candidate(date, 0);
    const problems = structureProblems(level);
    if (problems.length) continue; // the generator skips these; it never releases them
    clean++;
    assert.ok(level.pours >= level.orders.length);
    assert.ok(level.props.some((p) => p.kind === 'hat'));
    for (const o of level.orders) assert.ok(o.r >= 16);
  }
  assert.ok(clean >= 100, `only ${clean}/120 first candidates were well formed`);
});

test('harder days have at least as many orders as Monday', () => {
  for (const monday of ['2026-11-16', '2026-11-23', '2026-11-30']) {
    const mon = candidate(monday, 0).orders.length;
    const sun = new Date(`${monday}T00:00:00Z`);
    sun.setUTCDate(sun.getUTCDate() + 6);
    assert.ok(candidate(sun.toISOString().slice(0, 10), 0).orders.length >= mon);
  }
});

test('the solver refuses a map that cannot be finished', () => {
  // The only order sits inside a closed ring of beer taps: no pour can reach it.
  const base = LEVELS[0];
  const cx = 195, cy = 300;
  const posts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    return { x: cx + Math.cos(a) * 27, y: cy + Math.sin(a) * 27, r: 10, kind: 'tap' as const };
  });
  const impossible: Level = { ...base, orders: [{ owner: 'dutch', drink: 'beer', x: cx, y: cy, r: 14 }], posts, bowl: undefined, bonus: undefined };
  assert.equal(findSolution(impossible, { maxSimsPerOrder: 1500 }), null);
});

test('if no candidate passes, a proven handmade night is released instead', SLOW, () => {
  const daily = dailyLevel('2026-11-18', { validate: () => null, maxAttempts: 3 });
  assert.equal(daily.fallback, true);
  assert.equal(replay(daily.level, daily.solution).status, 'won');
});

test('every handmade night can be finished', SLOW, () => {
  for (const level of LEVELS) {
    const sol = findSolution(level, { robustNeeded: 1, maxSimsPerOrder: 20000 });
    assert.ok(sol, `${level.title} has no solution`);
    assert.equal(replay(level, sol.shots).status, 'won');
  }
});

test('two weeks of daily maps: every released map is proven possible', SLOW, () => {
  for (const date of dates('2026-11-16', 14)) {
    const daily = dailyLevel(date);
    assert.deepEqual(structureProblems(daily.level), [], `${date} released a malformed map`);
    const sim = replay(daily.level, daily.solution);
    assert.equal(sim.status, 'won', `${date}: the stored solution does not finish the night`);
    assert.equal(sim.servedCount, daily.level.orders.length);
    assert.ok(daily.solution.length <= daily.level.pours);
  }
});
