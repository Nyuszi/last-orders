// Solver: finds a sequence of pours that serves every order, and checks that each
// pour is "robust" (small aiming errors still work), so a human can actually do it.
// Used by the level tooling and by the daily generator to refuse impossible maps.
import type { Level } from './levels';
import { AIR_POUR, KINETIC_POUR, MAX_SPEED, POUR_R, Sim, type Shot } from './sim';

const DEG = Math.PI / 180;

export interface SolveOptions {
  /** How many of the 4 near-miss variations of a found pour must also work (0-4). */
  robustNeeded?: number;
  /** Give up on an order after this many simulated pours. */
  maxSimsPerOrder?: number;
  /**
   * Final say on a pour that passed the quick near-miss check, e.g. a fairness test with a
   * simulated player. Return the pour to use (it may be adjusted) or null to keep searching.
   * Called at most `maxAcceptChecks` times per order, because it is expensive.
   */
  accept?: (prefix: Shot[], shot: Shot, orderIndex: number, minTick: number) => Shot | null;
  maxAcceptChecks?: number;
}

export interface Solution {
  shots: Shot[];
  /** Per order: how many of the 4 near-miss variations also served it. */
  robustness: number[];
  sims: number;
}

/** Replays a list of pours from a fresh start. */
export function replay(level: Level, shots: Shot[]): Sim {
  const sim = new Sim(level);
  for (const s of shots) {
    sim.playShot({ ...s, tick: Math.max(s.tick, sim.tick) });
    if (sim.status !== 'aiming') break;
  }
  return sim;
}

/** Stopping distance on plain wood for a launch speed (matches the sim's friction). */
export function stopDistance(v0: number): number {
  const a = AIR_POUR, k = KINETIC_POUR;
  return v0 / a - (k / (a * a)) * Math.log(1 + (a * v0) / k);
}

/** The power (0-1) that stops a pour after `d` units on plain wood, or null if out of reach. */
export function powerFor(d: number): number | null {
  if (d > stopDistance(MAX_SPEED)) return null;
  let lo = 0, hi = MAX_SPEED;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (stopDistance(mid) < d) lo = mid; else hi = mid;
  }
  return (hi / MAX_SPEED) ** 2; // power is the square of the speed fraction (see launchSpeed)
}

function servesOrder(level: Level, prefix: Shot[], shot: Shot, orderIndex: number): boolean {
  const sim = replay(level, [...prefix, shot]);
  if (sim.status === 'failed' || sim.left.size > 0) return false; // proven solutions keep everyone at the bar
  const last = sim.pourResults[sim.pourResults.length - 1];
  return (last === 'served' || last === 'perfect' || last === 'trick') && sim.orders[orderIndex].served && sim.servedCount >= orderIndex + 1;
}

/** Pours worth trying for one order, most promising first. */
function* candidates(level: Level, orderIndex: number, tick: number): Generator<Shot> {
  const o = level.orders[orderIndex];
  const s = level.start;
  const c = level.counter;
  const angleOffsets = [0, -1, 1, -2, 2, -3, 3, -5, 5, -8, 8];
  const powerScales = [1, 0.97, 1.03, 0.94, 1.06, 0.9, 1.1, 0.85, 1.15, 1.25, 1.4, 1.6, 1.85];
  const spins = [0, -0.5, 0.5, -1, 1];

  const aims: { x: number; y: number; scale: number }[] = [{ x: o.x, y: o.y, scale: 1 }];
  // One-rail bank shots: aim at the spot's mirror image behind each side rail.
  aims.push({ x: 2 * (c.x + POUR_R) - o.x, y: o.y, scale: 1.12 });
  aims.push({ x: 2 * (c.x + c.w - POUR_R) - o.x, y: o.y, scale: 1.12 });

  for (const aim of aims) {
    const angle0 = Math.atan2(aim.y - s.y, aim.x - s.x);
    const p0 = powerFor(Math.hypot(aim.x - s.x, aim.y - s.y) * aim.scale);
    if (p0 === null) continue;
    for (const spin of spins) {
      for (const da of angleOffsets) {
        for (const ps of powerScales) {
          const power = p0 * ps;
          if (power > 1 || power < 0.05) continue;
          yield { tick, angle: angle0 + da * DEG, power, spin };
        }
      }
    }
  }
  // Last resort: a coarse sweep of everything.
  for (let a = -165; a <= -15; a += 1.25) {
    for (let p = 0.2; p <= 1.0001; p += 0.025) {
      for (const spin of [0, -1, 1]) yield { tick, angle: a * DEG, power: Math.min(1, p), spin };
    }
  }
}

function robustness(level: Level, prefix: Shot[], shot: Shot, orderIndex: number): number {
  const variations: Shot[] = [
    { ...shot, angle: shot.angle - 0.6 * DEG },
    { ...shot, angle: shot.angle + 0.6 * DEG },
    { ...shot, power: Math.max(0.05, shot.power - 0.02) },
    { ...shot, power: Math.min(1, shot.power + 0.02) },
  ];
  return variations.filter((v) => servesOrder(level, prefix, v, orderIndex)).length;
}

/**
 * Greedy search: serve each order in turn with the first robust pour found.
 * Returns null when some order has no robust pour within the budget.
 */
export function findSolution(level: Level, opts: SolveOptions = {}): Solution | null {
  const robustNeeded = opts.robustNeeded ?? 2;
  const maxSims = opts.maxSimsPerOrder ?? 3000;
  const shots: Shot[] = [];
  const robust: number[] = [];
  let sims = 0;

  for (let i = 0; i < level.orders.length; i++) {
    const base = replay(level, shots);
    if (base.status !== 'aiming') return null;
    const waits = level.arm ? [0, 1, 2, 3, 4, 5].map((k) => Math.round((k * level.arm!.period) / 6)) : [0];
    let found: Shot | null = null;
    let foundRobust = 0;
    let used = 0;
    let acceptChecks = 0;
    outer: for (const w of waits) {
      let usedHere = 0;
      for (const shot of candidates(level, i, base.tick + w)) {
        if (usedHere++ >= maxSims / waits.length) break;
        used++;
        if (!servesOrder(level, shots, shot, i)) continue;
        const r = robustness(level, shots, shot, i);
        used += 4;
        usedHere += 4;
        if (r < robustNeeded) continue;
        if (opts.accept) {
          if (acceptChecks++ >= (opts.maxAcceptChecks ?? 12)) break outer;
          const fair = opts.accept(shots, shot, i, base.tick);
          if (!fair) continue;
          found = fair;
        } else found = shot;
        foundRobust = r;
        break outer;
      }
    }
    sims += used;
    if (!found) return null;
    shots.push(found);
    robust.push(foundRobust);
  }
  const final = replay(level, shots);
  return final.status === 'won' ? { shots, robustness: robust, sims } : null;
}
