// Fairness: would a real person manage this pour?
//
// The solver only proves a pour exists. Here a simulated bartender with human-sized wobble
// (angle, strength and, with Pete's arm, timing) tries it many times. An order is fair when
// the pour has room for error on every side and an average player serves it often enough.
import type { Level } from './levels';
import { makeRng, type Rng } from './rng';
import { replay } from './solver';
import type { Shot } from './sim';

const DEG = Math.PI / 180;

/** How unsteady a player is: angle error in degrees, strength error relative to the pour, timing error in ticks (1/60 s). */
export interface Skill { name: string; angle: number; power: number; timing: number }
export const SKILLS: Skill[] = [
  { name: 'expert', angle: 0.5, power: 0.03, timing: 2 },
  { name: 'average', angle: 1, power: 0.06, timing: 4 },
  { name: 'novice', angle: 2, power: 0.1, timing: 7 },
];
export const AVERAGE = SKILLS[1];

export interface FairnessRules {
  /** The average player must serve the order at least this often (0-1). */
  minSuccess: number;
  /** Degrees of aim to spare on each side of the centred pour. */
  minAngle: number;
  /** Relative strength to spare on each side (0.04 = 4%). */
  minPower: number;
  /** Noisy pours per check. */
  samples: number;
}
export const DEFAULT_RULES: FairnessRules = { minSuccess: 0.5, minAngle: 1, minPower: 0.04, samples: 120 };
/** Monday is gentler. */
export function rulesFor(dayIndex: number): FairnessRules {
  return dayIndex === 0 ? { ...DEFAULT_RULES, minSuccess: 0.7 } : DEFAULT_RULES;
}

export interface OrderCheck {
  /** The pour moved to the middle of everything that works around it. */
  shot: Shot;
  /** Degrees of aim that still work below / above the centred pour. */
  angle: [number, number];
  /** Relative strength that still works below / above. */
  power: [number, number];
  /** Average-player success rate. */
  success: number;
  ok: boolean;
  why?: string;
}

/** Does this pour, after `prefix`, serve order `i` while keeping everyone at the bar? */
export function serves(level: Level, prefix: Shot[], shot: Shot, i: number): boolean {
  const sim = replay(level, [...prefix, shot]);
  if (sim.status === 'failed' || sim.left.size > 0) return false;
  return sim.orders[i].served && sim.servedCount >= i + 1;
}

const clampPower = (p: number) => Math.min(1, Math.max(0.02, p));
const withAngle = (s: Shot, d: number): Shot => ({ ...s, angle: s.angle + d * DEG });
const withPower = (s: Shot, r: number): Shot => ({ ...s, power: clampPower(s.power * (1 + r)) });

/** Walks out from a working pour in both directions until it stops working. */
function window1d(ok: (x: number) => boolean, step: number, max: number): [number, number] {
  let hi = 0, lo = 0;
  for (let x = step; x <= max + 1e-9; x += step) { if (ok(x)) hi = x; else break; }
  for (let x = step; x <= max + 1e-9; x += step) { if (ok(-x)) lo = x; else break; }
  return [lo, hi];
}

export function gaussian(rng: Rng): number {
  let u = 0, v = 0;
  while (!u) u = rng.next();
  while (!v) v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** One wobbly attempt at a pour. */
export function wobble(shot: Shot, skill: Skill, rng: Rng, minTick: number, timed: boolean): Shot {
  return {
    ...shot,
    angle: shot.angle + gaussian(rng) * skill.angle * DEG,
    power: clampPower(shot.power * (1 + skill.power * gaussian(rng))),
    tick: timed ? Math.max(minTick, Math.round(shot.tick + gaussian(rng) * skill.timing)) : shot.tick,
  };
}

/**
 * How often a player of this skill serves the order. The same seed is used for every map,
 * so maps are compared under identical wobble. Stops early once the answer is clear.
 */
export function successRate(level: Level, prefix: Shot[], shot: Shot, i: number, skill: Skill, samples: number, threshold?: number, minTick = 0): number {
  const rng = makeRng(`wobble:${skill.name}`);
  const timed = !!level.arm;
  let hits = 0;
  for (let n = 1; n <= samples; n++) {
    if (serves(level, prefix, wobble(shot, skill, rng, minTick, timed), i)) hits++;
    if (threshold !== undefined && n >= 30) {
      // Clear pass or clear fail: no need to keep pouring.
      if (hits / samples >= threshold) return hits / n;
      if ((hits + (samples - n)) / samples < threshold) return hits / n;
    }
  }
  return hits / samples;
}

/** Centres a working pour, measures its margins and success rate, and says whether it is fair. */
export function checkOrder(level: Level, prefix: Shot[], shot: Shot, i: number, rules: FairnessRules = DEFAULT_RULES, minTick = 0): OrderCheck {
  const okAngle = (s: Shot) => (x: number) => serves(level, prefix, withAngle(s, x), i);
  const okPower = (s: Shot) => (x: number) => serves(level, prefix, withPower(s, x), i);
  let a = window1d(okAngle(shot), 0.2, 6);
  let p = window1d(okPower(shot), 0.01, 0.4);
  // Move to the middle of what works; the solver's first hit is often near an edge.
  let centred = withPower(withAngle(shot, (a[1] - a[0]) / 2), (p[1] - p[0]) / 2);
  if (!serves(level, prefix, centred, i)) centred = shot;
  else {
    a = window1d(okAngle(centred), 0.2, 6);
    p = window1d(okPower(centred), 0.01, 0.4);
  }
  const base = { shot: centred, angle: a, power: p } as const;
  if (Math.min(...a) < rules.minAngle) return { ...base, success: 0, ok: false, why: `aim window ${a[0].toFixed(1)}°/${a[1].toFixed(1)}°` };
  if (Math.min(...p) < rules.minPower) return { ...base, success: 0, ok: false, why: `strength window ${(p[0] * 100).toFixed(0)}%/${(p[1] * 100).toFixed(0)}%` };
  const success = successRate(level, prefix, centred, i, AVERAGE, rules.samples, rules.minSuccess, minTick);
  const ok = success >= rules.minSuccess;
  return { ...base, success, ok, why: ok ? undefined : `average player ${(success * 100).toFixed(0)}%` };
}
