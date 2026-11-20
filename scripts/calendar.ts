// The night calendar: every date's map made and tested ahead of time, then frozen.
//
//   npm run calendar -- build 2026-12-01 2027-12-31 [--jobs 4] [--want 4] [--max 100]
//     Makes and tests candidates for each date, using several processes. Each date is saved to
//     calendar/parts/<date>.json as soon as it's done, so a stopped run picks up where it left off.
//   npm run calendar -- pack 2026-12-01 2027-12-31
//     Chooses up to 3 candidates per date (easier / target / harder), keeps the signature
//     twist from repeating two days running, re-checks every stored solution and writes
//     calendar/nights.json.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { candidate, dayIndex, GEN_VERSION, structureProblems } from '../src/generator';
import { checkOrder, rulesFor } from '../src/fairness';
import { difference, measureNight, SIGNATURE_TITLE, type NightMetrics } from '../src/metrics';
import { findSolution, replay } from '../src/solver';
import type { Level } from '../src/levels';
import type { Shot } from '../src/sim';
import matterPkg from 'matter-js/package.json' with { type: 'json' };

const DIR = new URL('../calendar/', import.meta.url).pathname;
const PARTS = DIR + 'parts/';
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Share of average players who should clear the night, per weekday [low, high]. */
export const CLEAR_BAND: [number, number][] = [[0.8, 1], [0.6, 0.8], [0.6, 0.8], [0.45, 0.65], [0.45, 0.65], [0.3, 0.45], [0.5, 0.65]];

interface Candidate { attempt: number; level: Level; solution: Shot[]; metrics: NightMetrics }
interface Part { date: string; genVersion: number; tried: number; candidates: Candidate[]; ms: number }

function dates(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
function flag(args: string[], name: string, def: number): number {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : def;
}

function makeDate(date: string, want: number, max: number): Part {
  const t = Date.now();
  const rules = rulesFor(dayIndex(date));
  const found: Candidate[] = [];
  let tried = 0;
  for (let attempt = 0; attempt < max && found.length < want; attempt++) {
    tried++;
    const level = candidate(date, attempt);
    if (structureProblems(level).length) continue;
    const sol = findSolution(level, {
      robustNeeded: 2,
      maxSimsPerOrder: 2500,
      accept: (prefix, shot, i, minTick) => {
        const c = checkOrder(level, prefix, shot, i, rules, minTick);
        return c.ok ? c.shot : null;
      },
    });
    if (!sol) continue;
    found.push({ attempt, level, solution: sol.shots, metrics: measureNight(level, sol.shots) });
  }
  return { date, genVersion: GEN_VERSION, tried, candidates: found, ms: Date.now() - t };
}

async function build(args: string[]) {
  const [from, to] = args;
  const jobs = flag(args, '--jobs', cpus().length);
  const want = flag(args, '--want', 4);
  const max = flag(args, '--max', 100);
  mkdirSync(PARTS, { recursive: true });
  const todo = dates(from, to).filter((d) => !existsSync(PARTS + d + '.json'));
  console.log(`${todo.length} dates to make with ${jobs} processes (want ${want} candidates, up to ${max} attempts each)`);
  const queue = [...todo];
  let done = 0;
  const started = Date.now();
  const runOne = (): Promise<void> => new Promise((resolve) => {
    const date = queue.shift();
    if (!date) return resolve();
    const child = spawn(process.execPath, [...process.execArgv, new URL(import.meta.url).pathname, 'worker', date, String(want), String(max)], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('exit', () => {
      done++;
      const eta = ((Date.now() - started) / done) * queue.length / 60000;
      if (done % 5 === 0 || !queue.length) console.log(`  ${done}/${todo.length} done, about ${eta.toFixed(0)} min left`);
      runOne().then(resolve);
    });
  });
  await Promise.all(Array.from({ length: jobs }, runOne));
}

function worker([date, want, max]: string[]) {
  const part = makeDate(date, Number(want), Number(max));
  writeFileSync(PARTS + date + '.json', JSON.stringify(part));
  const c = part.candidates.map((x) => `${x.metrics.signature}:${(x.metrics.clear * 100).toFixed(0)}%`).join(' ');
  console.log(`${date} ${DAY[dayIndex(date)]}: ${part.candidates.length} of ${part.tried} passed in ${(part.ms / 1000).toFixed(0)}s  ${c}`);
}

export function hashNight(level: Level, solution: Shot[]): string {
  return createHash('sha256').update(JSON.stringify({ level, solution })).digest('hex').slice(0, 16);
}

function pack(args: string[]) {
  const [from, to] = args;
  const nights: unknown[] = [];
  const missing: string[] = [];
  const recent: { signature: string; features: number[] }[] = [];
  for (const date of dates(from, to)) {
    const file = PARTS + date + '.json';
    if (!existsSync(file)) { missing.push(date); continue; }
    const part: Part = JSON.parse(readFileSync(file, 'utf8'));
    const [lo, hi] = CLEAR_BAND[dayIndex(date)];
    const mid = (lo + hi) / 2;
    const prev = recent[recent.length - 1];
    // Score: distance from the weekday's target, a penalty for repeating yesterday's twist,
    // and a small reward for looking different from the last week.
    const score = (c: Candidate) => Math.abs(c.metrics.clear - mid)
      + (prev && prev.signature === c.metrics.signature ? 0.5 : 0)
      - 0.01 * Math.min(10, Math.min(...recent.slice(-7).map((r) => difference(r.features, c.metrics.features)), 10));
    const ranked = [...part.candidates].sort((a, b) => score(a) - score(b));
    const pick = ranked[0];
    if (!pick) { nights.push({ date, fallback: true }); recent.push({ signature: 'fallback', features: [] }); continue; }
    const byClear = [...part.candidates].sort((a, b) => b.metrics.clear - a.metrics.clear);
    const k = byClear.indexOf(pick);
    const chosen = [byClear[k - 1], pick, byClear[k + 1]].filter(Boolean) as Candidate[];
    const versions = chosen.map((c) => {
      const level = { ...c.level, title: SIGNATURE_TITLE[c.metrics.signature] };
      const check = replay(level, c.solution);
      if (check.status !== 'won') throw new Error(`${date} attempt ${c.attempt}: stored solution no longer wins`);
      return { attempt: c.attempt, level, solution: c.solution, metrics: c.metrics, hash: hashNight(level, c.solution) };
    });
    nights.push({ date, genVersion: part.genVersion, engine: `matter-js@${matterPkg.version}`, pick: versions.findIndex((v) => v.attempt === pick.attempt), versions });
    recent.push({ signature: pick.metrics.signature, features: pick.metrics.features });
  }
  writeFileSync(DIR + 'nights.json', JSON.stringify({ made: new Date().toISOString(), from, to, nights }));
  // The slim copy the game reads outside Reddit: only the chosen version of each night.
  type Packed = { date: string; fallback?: boolean; pick?: number; versions?: { level: Level; solution: Shot[]; metrics: NightMetrics }[] };
  const slim = (nights as Packed[]).map((n) => {
    if (n.fallback || !n.versions) return { date: n.date, fallback: true };
    const v = n.versions[n.pick!];
    return { date: n.date, level: v.level, solution: v.solution, metrics: { clear: v.metrics.clear, signature: v.metrics.signature } };
  });
  // The copy bundled into the Reddit server: every stored version, without the bulky metrics.
  const server = (nights as Packed[]).map((n) => n.fallback || !n.versions ? { date: n.date, fallback: true } : {
    date: n.date, pick: n.pick,
    versions: n.versions.map((v) => ({ level: v.level, solution: v.solution, metrics: { clear: v.metrics.clear, signature: v.metrics.signature }, hash: (v as { hash?: string }).hash })),
  });
  writeFileSync(DIR + 'server.json', JSON.stringify({ from, to, nights: server }));
  mkdirSync(new URL('../public/', import.meta.url).pathname, { recursive: true });
  writeFileSync(new URL('../public/nights.json', import.meta.url).pathname, JSON.stringify({ nights: slim }));
  const fall = (nights as { fallback?: boolean }[]).filter((n) => n.fallback).length;
  console.log(`Packed ${nights.length} nights (${fall} fall back to a handmade night)${missing.length ? `; ${missing.length} dates not made yet, e.g. ${missing.slice(0, 3).join(', ')}` : ''}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'build') await build(rest);
else if (cmd === 'worker') worker(rest);
else if (cmd === 'pack') pack(rest);
else console.log('Usage: npm run calendar -- build|pack <from> <to>');
