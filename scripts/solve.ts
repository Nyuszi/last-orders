// Greedy solver: for each order in turn, finds a pour that serves it from the
// current state of the bar. Proves a night can be cleared and shows how forgiving
// each order is (the share of all tried pours that land in the spot).
// Usage: npm run solve [-- n2]
import { LEVELS, type Level } from '../src/levels';
import { Sim, type Shot } from '../src/sim';

const DEG = Math.PI / 180;

function grid(tick: number): Shot[] {
  const shots: Shot[] = [];
  for (let a = -170; a <= -10; a += 1) {
    for (let p = 0.2; p <= 1.0001; p += 0.025) {
      for (const spin of [-1, 0, 1]) shots.push({ tick, angle: a * DEG, power: Math.min(1, p), spin });
    }
  }
  return shots;
}

function run(level: Level, shots: Shot[]): Sim {
  const sim = new Sim(level);
  for (const s of shots) {
    sim.playShot({ ...s, tick: Math.max(s.tick, sim.tick) });
    if (sim.status !== 'aiming') break;
  }
  return sim;
}

const fmt = (s: Shot) => `${(s.angle / DEG).toFixed(0)}° p${s.power.toFixed(2)} spin${s.spin}${s.tick ? ` t${s.tick}` : ''}`;

function solve(level: Level) {
  const t0 = Date.now();
  console.log(`\nNight ${level.night}: ${level.title}  (${level.orders.length} orders, ${level.pours} pours)`);
  const seq: Shot[] = [];
  let bonuses = new Set<string>();
  for (let i = 0; i < level.orders.length; i++) {
    const base = run(level, seq);
    const waits = level.arm ? [0, 25, 50, 75, 100, 125] : [0];
    let served = 0, total = 0, fails = 0;
    let best: { shot: Shot; score: number } | null = null;
    for (const w of waits) {
      for (const shot of grid(base.tick + w)) {
        total++;
        const sim = run(level, [...seq, shot]);
        for (const b of sim.badges) if (b === 'Peanuts for Pete' || b === 'Cheat exposed') bonuses.add(b);
        if (sim.status === 'failed') { fails++; continue; }
        const last = sim.pourResults[sim.pourResults.length - 1];
        if (last !== 'served' && last !== 'perfect') continue;
        if (sim.servedCount < i + 1) continue; // served this one but knocked an earlier one
        served++;
        const score = sim.tips * 10 - sim.spills * 5 + (last === 'perfect' ? 3 : 0);
        if (!best || score > best.score) best = { shot, score };
      }
    }
    const o = level.orders[i];
    console.log(`  ${i + 1}. ${o.owner} ${o.drink}: ${((100 * served) / total).toFixed(2)}% of pours serve it, ${((100 * fails) / total).toFixed(1)}% upset the sheriff${best ? `  best ${fmt(best.shot)}` : '  NOT SERVABLE'}`);
    if (!best) return;
    seq.push(best.shot);
  }
  const final = run(level, seq);
  console.log(`  -> ${final.status}, tips ${final.tips}¢, badges: ${[...final.badges].join(', ') || 'none'}`);
  console.log(`  bonuses seen while searching: ${[...bonuses].join(', ') || 'none'}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

const only = process.argv[2];
for (const level of LEVELS) if (!only || level.id === only) solve(level);
