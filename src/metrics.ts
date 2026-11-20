// Night metrics: numbers that describe how a generated night plays, measured by simulation.
// Used to pick the best candidates for each date and to keep the week varied.
import type { Level } from './levels';
import { makeRng } from './rng';
import { replay } from './solver';
import { Sim, type Shot } from './sim';
import { AVERAGE, SKILLS, serves, successRate, wobble, type Skill } from './fairness';

const DEG = Math.PI / 180;

export type Signature = 'arm' | 'peanuts' | 'bank' | 'edges' | 'taps' | 'straight';
export const SIGNATURE_TITLE: Record<Signature, string> = {
  arm: "Pete's Clock",
  peanuts: 'Peanut Night',
  bank: 'Bank Night',
  edges: 'Mind the Edge',
  taps: 'Around the Taps',
  straight: 'Straight Pour',
};

export interface NightMetrics {
  /** Per order: success rate for expert, average, novice. */
  orders: { expert: number; average: number; novice: number }[];
  /** Share of simulated average players who clear the whole night with the pours given. */
  clear: number;
  /** Average pours those players needed (counting failed nights as all pours used). */
  pours: number;
  /** Rail bounces in the proven solution. */
  banks: number;
  /** Orders a plain straight pour can't serve: the player has to find something cleverer. */
  naiveFails: number;
  /** Pours in the simulated runs that stopped just outside the circle (within 12 units). */
  nearMiss: number;
  signature: Signature;
  /** Coarse description used to keep consecutive days different. */
  features: number[];
}

/** The next tick at or after `from` with the same arm phase as `tick` (so timed pours stay timed). */
function samePhase(level: Level, tick: number, from: number): number {
  if (!level.arm) return from;
  const p = level.arm.period;
  const phase = ((tick % p) + p) % p;
  let t = from - (from % p) + phase;
  if (t < from) t += p;
  return t;
}

/** A simulated player pours the proven solution with wobble and retries missed orders. */
function rollout(level: Level, solution: Shot[], skill: Skill, seed: string): { won: boolean; pours: number; near: number } {
  const rng = makeRng(seed);
  const sim = new Sim(level);
  let near = 0;
  while (sim.status === 'aiming') {
    const i = sim.nextOrder;
    if (i < 0) break;
    const want = solution[i];
    const tick = samePhase(level, want.tick, sim.tick);
    sim.playShot(wobble({ ...want, tick }, skill, rng, sim.tick, !!level.arm));
    const o = sim.orders[i];
    const last = sim.glasses[sim.glasses.length - 1];
    if (!o.served && last?.body && last.id.startsWith('pour-')) {
      const d = Math.hypot(last.body.position.x - o.x, last.body.position.y - o.y);
      if (d > o.r && d < o.r + 12) near++;
    }
  }
  return { won: sim.status === 'won', pours: sim.shots.length, near };
}

function signatureOf(level: Level, banks: number): Signature {
  if (level.arm) return 'arm';
  if (level.bowl && level.bonus) return 'peanuts';
  if (banks > 0) return 'bank';
  const sides = level.rails.filter((r) => r.side === 'left' || r.side === 'right');
  const covered = sides.reduce((n, r) => n + (r.to - r.from), 0);
  if (covered < 2 * level.counter.h - 20) return 'edges';
  if (level.posts.length) return 'taps';
  return 'straight';
}

export function measureNight(level: Level, solution: Shot[], runs = 80): NightMetrics {
  const orders = solution.map((s, i) => {
    const prefix = solution.slice(0, i);
    const [expert, average, novice] = SKILLS.map((k) => successRate(level, prefix, s, i, k, 100));
    return { expert, average, novice };
  });

  let wins = 0, pours = 0, near = 0;
  for (let r = 0; r < runs; r++) {
    const res = rollout(level, solution, AVERAGE, `rollout:${r}`);
    if (res.won) wins++;
    pours += res.pours;
    near += res.near;
  }

  const sim = replay(level, solution);
  const banks = sim.events.filter((e) => e.t === 'bank').length;

  // Would aiming straight at the circle (no spin, small aim and strength tweaks) ever work?
  let naiveFails = 0;
  solution.forEach((s, i) => {
    const o = level.orders[i];
    const base = Math.atan2(o.y - level.start.y, o.x - level.start.x);
    let ok = false;
    for (const da of [0, -1, 1]) for (const k of [0.8, 0.9, 1, 1.1, 1.2]) {
      if (ok) break;
      ok = serves(level, solution.slice(0, i), { tick: s.tick, angle: base + da * DEG, power: Math.min(1, s.power * k), spin: 0 }, i);
    }
    if (!ok) naiveFails++;
  });

  const signature = signatureOf(level, banks);
  const sideRails = level.rails.filter((r) => r.side === 'left' || r.side === 'right');
  const timber = sideRails.filter((r) => r.type === 'timber').reduce((n, r) => n + (r.to - r.from), 0) / (2 * level.counter.h);
  const features = [
    level.orders.length, level.posts.length, level.glasses.length, level.puddles.length,
    level.arm ? 1 : 0, level.bowl ? 1 : 0, banks, naiveFails, Math.round(timber * 4),
    Math.round(level.orders.reduce((n, o) => n + o.y, 0) / level.orders.length / 100),
  ];
  return { orders, clear: wins / runs, pours: pours / runs, banks, naiveFails, nearMiss: near / runs, signature, features };
}

/** 0 = identical layout features, larger = more different. */
export function difference(a: number[], b: number[]): number {
  return a.reduce((n, x, i) => n + Math.abs(x - (b[i] ?? 0)), 0);
}
