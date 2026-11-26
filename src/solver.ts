// Solver: finds a sequence of pours that serves every order, and checks that each
// pour is "robust" (small aiming errors still work), so a human can actually do it.
// Used by the level tooling and by the daily generator to refuse impossible maps.
import type { Level } from './levels';
import { AIR_POUR, KINETIC_POUR, MAX_SPEED, POUR_R, Sim, type Pt, type Shot } from './sim';

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
  /** Pours already played, one per order in turn (e.g. ending in a combo); the search carries on from there. */
  prefix?: Shot[];
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

export interface Combo {
  /** The order the combo pour serves (it replaces solution[order]). */
  order: number;
  shot: Shot;
  /** How many of the 4 near-miss variations are combos too. */
  robustness: number;
  /** True when the rest of the stored solution still wins after the combo pour. */
  finishes: boolean;
  sims: number;
}

export type BonusKind = 'peanuts' | 'cards';
export const BONUS_BADGE: Record<BonusKind, string> = { peanuts: 'Peanuts for Pete', cards: 'Cheat exposed' };

/** The bonus items a night has. */
export function bonusKinds(level: Level): BonusKind[] {
  const out: BonusKind[] = [];
  if (level.bonus && level.bowl) out.push('peanuts');
  if (level.props.some((p) => p.kind === 'cards')) out.push('cards');
  return out;
}

/** Where a bonus item sits before a pour, or null once it's used up. */
function bonusTarget(sim: Sim, kind: BonusKind): Pt | null {
  if (sim.badges.has(BONUS_BADGE[kind])) return null;
  if (kind === 'peanuts') return sim.bowl ? { x: sim.bowl.position.x, y: sim.bowl.position.y } : null;
  const p = sim.props.find((q) => q.kind === 'cards' && !q.touched && q.body);
  return p?.body ? { x: p.body.position.x, y: p.body.position.y } : null;
}

function isCombo(level: Level, prefix: Shot[], shot: Shot, kind: BonusKind, clean = false): boolean {
  const sim = replay(level, [...prefix, shot]);
  return sim.badges.has('Combo') && sim.badges.has(BONUS_BADGE[kind]) && sim.status !== 'failed' && sim.left.size === 0 && !(clean && sim.hatWarned);
}

/**
 * Looks for one pour that earns this bonus (peanuts or cards) and serves a drink, at any
 * point of a proven solution. The search aims straight at the bonus item and at its mirror
 * images behind the side rails, across a fan of angles, strengths and spins.
 * `from`: the first pour to try. `clean`: the pour must not earn a warning about the sheriff's
 * hat (for the "Show me how" lessons).
 */
export function findCombo(level: Level, solution: Shot[], kind: BonusKind, opts: { robustNeeded?: number; maxSims?: number; from?: number; clean?: boolean } = {}): Combo | null {
  const robustNeeded = opts.robustNeeded ?? 1;
  const maxSims = opts.maxSims ?? 90000;
  const c = level.counter, s = level.start;
  let sims = 0;
  let fallback: Combo | null = null;
  for (let k = opts.from ?? 0; k < solution.length; k++) {
    const prefix = solution.slice(0, k);
    const base = replay(level, prefix);
    if (base.status !== 'aiming') break;
    const target = bonusTarget(base, kind);
    if (!target) break;
    const targets = [target];
    const waits = level.arm ? [0, 1, 2].map((w) => Math.round((w * level.arm!.period) / 3)) : [0];
    for (const t of targets) {
      const aims = [t, { x: 2 * (c.x + POUR_R) - t.x, y: t.y }, { x: 2 * (c.x + c.w - POUR_R) - t.x, y: t.y }];
      for (const aim of aims) {
        const a0 = Math.atan2(aim.y - s.y, aim.x - s.x);
        for (const w of waits) {
          for (let da = -14; da <= 14; da += 0.25) { // fine: the aim line shows the exact cut, so a narrow combo is fair
            for (let p = 0.15; p <= 1.0001; p += 0.03) {
              for (const spin of [0, -0.6, 0.6]) {
                if (sims++ >= maxSims) return fallback;
                const shot: Shot = { tick: base.tick + w, angle: a0 + da * DEG, power: Math.min(1, p), spin };
                if (!isCombo(level, prefix, shot, kind, opts.clean)) continue;
                const variations: Shot[] = [
                  { ...shot, angle: shot.angle - 0.6 * DEG }, { ...shot, angle: shot.angle + 0.6 * DEG },
                  { ...shot, power: Math.max(0.05, shot.power - 0.02) }, { ...shot, power: Math.min(1, shot.power + 0.02) },
                ];
                const r = variations.filter((v) => isCombo(level, prefix, v, kind, opts.clean)).length;
                sims += 4;
                if (r < robustNeeded) continue;
                const finishes = replay(level, [...prefix, shot, ...solution.slice(k + 1)]).status === 'won';
                const combo = { order: k, shot, robustness: r, finishes, sims };
                if (finishes) return combo;
                fallback ??= combo;
              }
            }
          }
        }
      }
    }
  }
  return fallback && { ...fallback, sims };
}

/**
 * Greedy search: serve each order in turn with the first robust pour found.
 * Returns null when some order has no robust pour within the budget.
 */
export function findSolution(level: Level, opts: SolveOptions = {}): Solution | null {
  const robustNeeded = opts.robustNeeded ?? 2;
  const maxSims = opts.maxSimsPerOrder ?? 3000;
  const shots: Shot[] = [...(opts.prefix ?? [])];
  const robust: number[] = shots.map(() => 4);
  let sims = 0;

  for (let i = shots.length; i < level.orders.length; i++) {
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

/** True when every bonus item on the night can be earned by a pour that also serves a drink. */
export function hasCombos(level: Level, solution: Shot[]): boolean {
  return bonusKinds(level).every((k) => findCombo(level, solution, k) !== null);
}
