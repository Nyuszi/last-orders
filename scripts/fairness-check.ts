// Usage: npm run fair -- 2026-11-22 [more dates]
// Generates each date with the old check and the new fairness check, and reports per-order margins.
import { candidate, dayIndex, structureProblems, dailyLevel } from '../src/generator';
import { checkOrder, rulesFor, successRate, SKILLS } from '../src/fairness';
import { findSolution } from '../src/solver';

for (const date of process.argv.slice(2)) {
  const old = dailyLevel(date);
  console.log(`\n${date} (old check: attempt ${old.attempt})`);
  old.solution.forEach((s, i) => {
    const c = checkOrder(old.level, old.solution.slice(0, i), s, i, { ...rulesFor(dayIndex(date)), minAngle: 0, minPower: 0 });
    console.log(`  order ${i + 1}: aim -${c.angle[0].toFixed(1)}/+${c.angle[1].toFixed(1)}°, strength -${(c.power[0] * 100).toFixed(0)}/+${(c.power[1] * 100).toFixed(0)}%, average ${(c.success * 100).toFixed(0)}%`);
  });
  const rules = rulesFor(dayIndex(date));
  const t = Date.now();
  for (let attempt = 0; attempt < 20; attempt++) {
    const level = candidate(date, attempt);
    if (structureProblems(level).length) continue;
    const reasons: string[] = [];
    const sol = findSolution(level, {
      robustNeeded: 2, maxSimsPerOrder: 2500,
      accept: (prefix, shot, i, minTick) => { const c = checkOrder(level, prefix, shot, i, rules, minTick); if (!c.ok) reasons.push(`o${i + 1}: ${c.why}`); return c.ok ? c.shot : null; },
    });
    if (!sol) { console.log(`  new check: attempt ${attempt} rejected (${reasons.slice(-2).join('; ') || 'no pour found'})`); continue; }
    console.log(`  new check: attempt ${attempt} accepted in ${((Date.now() - t) / 1000).toFixed(1)}s`);
    sol.shots.forEach((s, i) => {
      const r = SKILLS.map((k) => `${k.name} ${(successRate(level, sol.shots.slice(0, i), s, i, k, 120) * 100).toFixed(0)}%`).join(', ');
      console.log(`    order ${i + 1}: ${r}`);
    });
    break;
  }
}
