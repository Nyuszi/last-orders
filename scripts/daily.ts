// Preview the daily map for a date: npm run daily -- 2026-11-21   (defaults to today, UTC)
import { NPCS } from '../src/levels';
import { dailyLevel, dayIndex, todayKey } from '../src/generator';

const date = process.argv[2] ?? todayKey();
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const t0 = Date.now();
const d = dailyLevel(date);
const L = d.level;
console.log(`${date} (${DAYS[dayIndex(date)]}): "${L.title}"  ${L.blurb}`);
console.log(`  released after ${d.fallback ? 'all candidates failed: using a handmade night' : `${d.attempt + 1} candidate(s)`} in ${Date.now() - t0}ms`);
console.log(`  ${L.orders.length} orders, ${L.pours} pours`);
L.orders.forEach((o, i) => console.log(`    ${i + 1}. ${NPCS[o.owner].short}: ${o.drink} at (${o.x}, ${o.y})`));
const open = L.rails.filter((r) => r.side === 'left' || r.side === 'right').reduce((n, r) => n + (r.to - r.from), 0);
console.log(`  timber stretches: ${L.rails.filter((r) => r.type === 'timber').length}, rail coverage on the sides: ${Math.round((open / (2 * L.counter.h)) * 100)}%`);
console.log(`  posts: ${L.posts.length}, puddles: ${L.puddles.length}, drinks already out: ${L.glasses.length}, Pete's arm: ${L.arm ? 'yes' : 'no'}, peanut bonus: ${L.bonus ? 'yes' : 'no'}`);
console.log(`  proven solution: ${d.solution.map((s) => `${((s.angle * 180) / Math.PI).toFixed(1)}° power ${s.power.toFixed(2)} spin ${s.spin}`).join(' | ')}`);
