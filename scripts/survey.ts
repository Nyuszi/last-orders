// Usage: npm run survey -- 2026-11-23 7 [attempts]
// For each date: how many of the first N candidates pass the fairness check, and how long it takes.
import { candidate, dayIndex, structureProblems } from '../src/generator';
import { checkOrder, rulesFor } from '../src/fairness';
import { findSolution } from '../src/solver';

const [start, days = '7', attempts = '30'] = process.argv.slice(2);
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
for (let d = 0; d < Number(days); d++) {
  const date = new Date(Date.parse(start + 'T00:00:00Z') + d * 864e5).toISOString().slice(0, 10);
  const rules = rulesFor(dayIndex(date));
  const t = Date.now();
  const passed: number[] = [];
  const why: Record<string, number> = {};
  for (let a = 0; a < Number(attempts); a++) {
    const level = candidate(date, a);
    if (structureProblems(level).length) { why.structure = (why.structure ?? 0) + 1; continue; }
    let last = 'no pour found';
    const sol = findSolution(level, {
      robustNeeded: 2, maxSimsPerOrder: 2500,
      accept: (prefix, shot, i, minTick) => { const c = checkOrder(level, prefix, shot, i, rules, minTick); if (!c.ok) last = c.why!.replace(/[\d.%°/-]+/g, '').trim(); return c.ok ? c.shot : null; },
    });
    if (sol) passed.push(a); else why[last] = (why[last] ?? 0) + 1;
  }
  console.log(`${date} ${DAY[dayIndex(date)]}: ${passed.length}/${attempts} pass [${passed.join(',')}] in ${((Date.now() - t) / 1000).toFixed(0)}s; rejected: ${JSON.stringify(why)}`);
}
