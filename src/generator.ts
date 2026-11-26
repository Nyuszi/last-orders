// Daily map generator. The date is the seed, so everyone gets the same night on the
// same day. A map is only released after the solver proves every order can be served
// with a pour a human can repeat. Otherwise the next variation of that day's seed is
// tried, and if none pass, a handmade night (proven by tests) is used instead.
import { LEVELS, type Drink, type GlassDef, type Level, type NpcDef, type NpcId, type OrderDef, type PropDef, type PostDef, type PuddleDef, type RailSeg, type ArmDef } from './levels';
import { makeRng, type Rng } from './rng';
import { findSolution, hasCombos, type Solution } from './solver';
import { BOWL_R, DRINK_MASS, roundMass, type Shot } from './sim';

export const COUNTER = { x: 125, y: 20, w: 140, h: 570 };
export const START = { x: 195, y: 550 };
const LEFT_X = 70, RIGHT_X = 320; // where customers sit, off the counter
const SLOT_YS = [70, 130, 190, 250, 310, 370, 430];
/** Minimum gap (world units) between two customers on the same side of the bar. */
export const MIN_SAME_SIDE_GAP = 72;
const FAVOURITE: Record<NpcId, Drink> = { sheriff: 'whiskey', dutch: 'beer', twofist: 'rye', pete: 'water', lavinia: 'sarsaparilla' };
const TITLES = ['Payday', 'Dust storm', 'Card night', 'The long table', 'Rain on the roof', 'Cattle drive', 'Full moon', 'Quiet hour', 'Stagecoach in', 'Fiddle night', 'Hot spell', 'Gold rush', 'Election day', 'Mail day'];
const FLAVOURS = [
  'The stagecoach just pulled in.', 'Somebody hit a seam of silver.', 'The piano player is late again.',
  'It is too hot to argue.', 'The sheriff is in a mood.', 'A drifter is asking about the safe.',
  'Somebody bet their boots.', 'The roof is leaking over the far end.',
];

/** 0 = Monday (easiest) ... 6 = Sunday (hardest). */
export function dayIndex(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

/** Today's key in UTC, e.g. "2026-11-20". Everyone's day flips at the same moment. */
export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

interface Tier { orders: number; spare: number; spotR: number; timber: number; gaps: number; posts: number; puddles: number; standing: number; arm: number; }
const TIERS: Tier[] = [
  { orders: 2, spare: 2, spotR: 21, timber: 0, gaps: 0, posts: 0, puddles: 0, standing: 0, arm: 0 },
  { orders: 3, spare: 2, spotR: 20, timber: 0.3, gaps: 0.5, posts: 1, puddles: 1, standing: 1, arm: 0 },
  { orders: 3, spare: 2, spotR: 20, timber: 0.45, gaps: 1, posts: 1, puddles: 1, standing: 1, arm: 0.35 },
  // Hardest tier: four orders in a row; fewer obstacles, so the challenge is the sequence, not clutter.
  { orders: 4, spare: 2, spotR: 20, timber: 0.5, gaps: 1, posts: 1, puddles: 1, standing: 1, arm: 0.4 },
];
/** Monday..Sunday difficulty: easy Monday, hardest Saturday, Sunday a showpiece at Thursday level. */
const WEEK: number[] = [0, 1, 1, 2, 2, 3, 2];
/**
 * Bump this whenever a change would alter the map produced for any date. Maps already handed
 * to players are stored with their version and never regenerated.
 */
export const GEN_VERSION = 3;

interface Circle { x: number; y: number; r: number }

function clear(c: Circle, taken: Circle[], gap = 6): boolean {
  return taken.every((t) => Math.hypot(t.x - c.x, t.y - c.y) >= t.r + c.r + gap);
}

function onCounter(c: Circle, margin = 2): boolean {
  return c.x - c.r >= COUNTER.x + margin && c.x + c.r <= COUNTER.x + COUNTER.w - margin && c.y - c.r >= COUNTER.y + margin && c.y + c.r <= COUNTER.y + COUNTER.h - margin;
}

function place(rng: Rng, taken: Circle[], r: number, make: () => { x: number; y: number }, tries = 40): Circle | null {
  for (let i = 0; i < tries; i++) {
    const p = make();
    const c = { x: Math.round(p.x), y: Math.round(p.y), r };
    if (onCounter(c) && clear(c, taken)) { taken.push(c); return c; }
  }
  return null;
}

/**
 * The peanut bowl goes where one pour can push it into Pete's spot and carry on into an
 * order's circle (a combo). Like a pool cut shot: the bowl leaves along the line of centres,
 * and the drink keeps its sideways speed and, off the heavier bowl, bounces back a little
 * along that line (the same formula as the aim line and the physics). So the bowl goes where a
 * pour meeting it at a 25-65 degree cut sends the bowl at the spot and the drink within 8
 * degrees of an order's circle. The calendar still proves the combo with the solver (findCombo).
 */
function placeBowl(rng: Rng, taken: Circle[], spot: Circle, orders: OrderDef[]): Circle | null {
  const BOWL = 13, POUR = 9;
  const targets = orders.filter((o) => Math.hypot(o.x - spot.x, o.y - spot.y) > 70);
  if (!targets.length) return null;
  const unit = (x: number, y: number) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
  const sources = [START, { x: 2 * (COUNTER.x + POUR) - START.x, y: START.y }, { x: 2 * (COUNTER.x + COUNTER.w - POUR) - START.x, y: START.y }];
  return place(rng, taken, BOWL, () => {
    for (let i = 0; i < 400; i++) {
      const o = rng.pick(targets);
      const b = { x: rng.range(165, 225), y: rng.range(110, 480) };
      const toSpot = Math.hypot(spot.x - b.x, spot.y - b.y), toOrder = Math.hypot(o.x - b.x, o.y - b.y);
      if (toSpot < 50 || toSpot > 150 || toOrder < 45 || toOrder > 190) continue;
      const u = unit(spot.x - b.x, spot.y - b.y), w = unit(o.x - b.x, o.y - b.y);
      const contact = { x: b.x - u.x * (BOWL + POUR), y: b.y - u.y * (BOWL + POUR) };
      // Straight from the start, or off one side rail (aimed at the start's mirror image).
      const ok = sources.some((s) => {
        const d = unit(contact.x - s.x, contact.y - s.y);
        const vn = d.x * u.x + d.y * u.y;
        const cut = Math.acos(vn) / DEG;
        if (cut < 25 || cut > 65) return false;
        // Where the drink goes after the hit (sim.ts roundHit).
        const out = unit(d.x - vn * u.x + u.x * vn * BOUNCE_BACK, d.y - vn * u.y + u.y * vn * BOUNCE_BACK);
        return Math.acos(Math.min(1, out.x * w.x + out.y * w.y)) / DEG <= 8;
      });
      if (ok) return b;
    }
    return { x: -999, y: -999 }; // off the counter, so place() tries again
  }, 20);
}
const DEG = Math.PI / 180;
/** Share of its speed along the line of centres a drink keeps off the bowl (negative: it comes back). */
const BOWL_MASS = roundMass(0.0035, BOWL_R) / DRINK_MASS;
const BOUNCE_BACK = (1 - 0.9 * BOWL_MASS) / (1 + BOWL_MASS);

function railsFor(rng: Rng, t: Tier): RailSeg[] {
  const top = COUNTER.y, bottom = COUNTER.y + COUNTER.h;
  const rails: RailSeg[] = [];
  const gapsLeft = Math.floor(t.gaps) + (rng.chance(t.gaps % 1) ? 1 : 0);
  const gapSides = rng.shuffle(['left', 'right'] as const).slice(0, Math.min(2, gapsLeft));
  for (const side of ['left', 'right'] as const) {
    // Build the side from top to bottom: brass, maybe a timber stretch, maybe one open gap.
    const marks: { from: number; to: number; type: 'brass' | 'timber' | 'open' }[] = [];
    if (gapSides.includes(side)) {
      const len = rng.int(70, 100);
      const from = rng.int(110, 440 - len);
      marks.push({ from, to: from + len, type: 'open' });
    }
    if (rng.chance(t.timber)) {
      const len = rng.int(110, 200);
      const from = rng.int(top + 20, bottom - 40 - len);
      if (marks.every((m) => from + len < m.from - 10 || from > m.to + 10)) marks.push({ from, to: from + len, type: 'timber' });
    }
    marks.sort((a, b) => a.from - b.from);
    let cur = top;
    for (const m of marks) {
      if (m.from > cur) rails.push({ side, from: cur, to: m.from, type: 'brass' });
      if (m.type !== 'open') rails.push({ side, from: m.from, to: m.to, type: m.type });
      cur = m.to;
    }
    if (cur < bottom) rails.push({ side, from: cur, to: bottom, type: 'brass' });
  }
  rails.push({ side: 'top', from: COUNTER.x, to: COUNTER.x + COUNTER.w, type: rng.chance(t.timber) ? 'timber' : 'brass' });
  rails.push({ side: 'bottom', from: COUNTER.x, to: COUNTER.x + COUNTER.w, type: 'timber' });
  return rails;
}

/** One deterministic candidate map for a date and attempt number. Not yet checked. */
export function candidate(date: string, attempt: number): Level {
  const rng = makeRng(`last-orders:${date}:${attempt}`);
  const day = dayIndex(date);
  const t = TIERS[WEEK[day]];

  // Who's in tonight. The sheriff is always here (his hat is the house rule).
  const hasArm = rng.chance(t.arm);
  const others = rng.shuffle(['dutch', 'twofist', 'lavinia', 'pete'] as NpcId[]);
  const cast: NpcId[] = ['sheriff', ...others.slice(0, Math.min(4, t.orders + t.standing))];
  if (hasArm && !cast.includes('pete')) cast[cast.length - 1] = 'pete';
  const slots = rng.shuffle([...SLOT_YS]).slice(0, cast.length).sort((a, b) => a - b);
  const npcs: NpcDef[] = rng.shuffle([...cast]).map((id, i) => ({ id, side: rng.chance(0.5) ? 'left' : 'right', y: slots[i] }));
  // Customers are drawn big, so two on the same side need room between them.
  for (let i = 1; i < npcs.length; i++) {
    const clash = (side: 'left' | 'right') => npcs.slice(0, i).some((n) => n.side === side && Math.abs(n.y - npcs[i].y) < MIN_SAME_SIDE_GAP);
    if (clash(npcs[i].side)) npcs[i].side = npcs[i].side === 'left' ? 'right' : 'left';
  }
  // Customers on the same side need room for their name labels.
  const sideX = (n: NpcDef) => (n.side === 'left' ? 160 : 230);

  const taken: Circle[] = [{ x: START.x, y: START.y, r: 34 }];
  const orders: OrderDef[] = [];
  const asleep = hasArm ? 'pete' : null;
  const orderers = rng.shuffle(npcs.filter((n) => n.id !== asleep));
  for (const n of orderers) {
    if (orders.length >= t.orders) break;
    const c = place(rng, taken, t.spotR, () => ({ x: sideX(n) + rng.range(-5, 5), y: n.y + rng.range(-8, 8) }));
    if (c) orders.push({ owner: n.id, drink: FAVOURITE[n.id], x: c.x, y: c.y, r: t.spotR });
  }
  // A customer may order twice (a second round further along the bar).
  while (orders.length < t.orders && orderers.length) {
    const n = rng.pick(orderers);
    const c = place(rng, taken, t.spotR, () => ({ x: sideX(n) + rng.range(-5, 5), y: n.y + rng.pick([-1, 1]) * rng.range(36, 48) }));
    if (!c) break;
    orders.push({ owner: n.id, drink: FAVOURITE[n.id], x: c.x, y: c.y, r: t.spotR });
  }
  rng.shuffle(orders);

  const props: PropDef[] = [];
  const sheriff = npcs.find((n) => n.id === 'sheriff')!;
  const hat = place(rng, taken, 13, () => ({ x: sheriff.side === 'left' ? rng.range(143, 152) : rng.range(238, 247), y: sheriff.y + rng.pick([-1, 1]) * rng.range(28, 56) }), 80);
  if (hat) props.push({ id: 'sheriff-hat', kind: 'hat', owner: 'sheriff', x: hat.x, y: hat.y });
  const lavinia = npcs.find((n) => n.id === 'lavinia');
  if (lavinia && rng.chance(0.6)) {
    const cards = place(rng, taken, 11, () => ({ x: lavinia.side === 'left' ? rng.range(143, 152) : rng.range(238, 247), y: lavinia.y + rng.pick([-1, 1]) * rng.range(30, 42) }));
    if (cards) props.push({ id: 'lavinia-cards', kind: 'cards', owner: 'lavinia', x: cards.x, y: cards.y });
  }

  const glasses: GlassDef[] = [];
  for (let i = 0; i < t.standing; i++) {
    const n = rng.pick(npcs);
    const c = place(rng, taken, 8, () => ({ x: sideX(n) + rng.range(-6, 6), y: n.y + rng.pick([-1, 1]) * rng.range(26, 40) }));
    if (c) glasses.push({ id: `standing-${i}`, x: c.x, y: c.y, drink: FAVOURITE[n.id], owner: n.id });
  }

  const posts: PostDef[] = [];
  for (let i = 0; i < t.posts; i++) {
    const r = rng.pick([11, 12]);
    const c = place(rng, taken, r + 8, () => ({ x: rng.range(178, 212), y: rng.range(130, 420) }));
    if (c) posts.push({ x: c.x, y: c.y, r, kind: rng.chance(0.5) ? 'tap' : 'tipjar' });
  }

  const puddles: PuddleDef[] = [];
  for (let i = 0; i < t.puddles; i++) {
    const r = rng.int(20, 28);
    // Puddles may lie under spots and lanes (that's their job), but not on top of objects.
    const cx = rng.range(165, 225), cy = rng.range(130, 440);
    if (props.every((p) => Math.hypot(p.x - cx, p.y - cy) > r + 16)) puddles.push({ drink: rng.pick(['beer', 'whiskey', 'sarsaparilla'] as Drink[]), x: Math.round(cx), y: Math.round(cy), r });
  }

  let bowl: Level['bowl'];
  let bonus: Level['bonus'];
  const pete = npcs.find((n) => n.id === 'pete');
  if (pete && rng.chance(0.8)) {
    const b = place(rng, taken, 20, () => ({ x: pete.side === 'left' ? rng.range(152, 160) : rng.range(230, 238), y: pete.y + rng.range(-10, 10) }));
    // A cut-shot spot if the layout has one; otherwise the old spot below Pete's, where the
    // combo usually needs a bank. Either way the calendar proves a combo before release.
    const w = b && (placeBowl(rng, taken, b, orders) ?? place(rng, taken, 13, () => ({ x: rng.range(178, 214), y: Math.min(470, b.y + rng.range(90, 140)) })));
    if (b && w) { bonus = { x: b.x, y: b.y, r: 18 }; bowl = { x: w.x, y: w.y }; }
  }

  let arm: ArmDef | undefined;
  if (hasArm && pete) arm = { owner: 'pete', y: pete.y, reach: rng.int(66, 84), period: rng.int(130, 170) };

  const title = rng.pick(TITLES);
  const flavour = rng.pick(FLAVOURS);
  return {
    id: `daily-${date}`,
    night: 0,
    title,
    blurb: `${orders.length} orders tonight. ${flavour}`,
    hint: 'Touch the bar to aim, then pull the beer tap down and let go to pour. Stop each drink inside its dotted circle.',
    pours: orders.length + t.spare,
    counter: { ...COUNTER },
    rails: railsFor(rng, t),
    start: { ...START },
    npcs,
    orders,
    glasses,
    props,
    posts,
    bowl,
    bonus,
    puddles,
    arm,
  };
}

/** Structural checks: everything on the counter, nothing overlapping, the start lane clear. */
export function structureProblems(level: Level): string[] {
  const problems: string[] = [];
  const items: (Circle & { what: string })[] = [
    ...level.orders.map((o, i) => ({ x: o.x, y: o.y, r: o.r, what: `order ${i + 1}` })),
    ...level.glasses.map((g) => ({ x: g.x, y: g.y, r: 8, what: g.id })),
    ...level.props.map((p) => ({ x: p.x, y: p.y, r: p.kind === 'hat' ? 13 : 11, what: p.id })),
    ...level.posts.map((p, i) => ({ x: p.x, y: p.y, r: p.r, what: `post ${i}` })),
    ...(level.bowl ? [{ x: level.bowl.x, y: level.bowl.y, r: 13, what: 'bowl' }] : []),
  ];
  for (const it of items) if (!onCounter(it, 0)) problems.push(`${it.what} is off the counter`);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) problems.push(`${a.what} overlaps ${b.what}`);
    }
    if (Math.hypot(items[i].x - level.start.x, items[i].y - level.start.y) < items[i].r + 20) problems.push(`${items[i].what} blocks the start`);
  }
  if (level.orders.length === 0) problems.push('no orders');
  if (level.pours < level.orders.length) problems.push('fewer pours than orders');
  // The bowl must start well clear of Pete's spot, or it counts as delivered before any pour.
  if (level.bowl && level.bonus && Math.hypot(level.bowl.x - level.bonus.x, level.bowl.y - level.bonus.y) < level.bonus.r + 22) problems.push("peanut bowl starts in Pete's spot");
  if (!level.props.some((p) => p.kind === 'hat')) problems.push('no sheriff hat');
  for (let i = 0; i < level.npcs.length; i++) {
    for (let j = i + 1; j < level.npcs.length; j++) {
      const a = level.npcs[i], b = level.npcs[j];
      if (a.side === b.side && Math.abs(a.y - b.y) < MIN_SAME_SIDE_GAP) problems.push(`${a.id} and ${b.id} sit too close together`);
    }
  }
  return problems;
}

export interface Daily {
  date: string;
  level: Level;
  /** A proven way to serve every order. Kept server-side; handy for "show solution" later. */
  solution: Shot[];
  attempt: number;
  fallback: boolean;
}

export interface DailyOptions {
  maxAttempts?: number;
  /** Swap in a different check (tests use this). Return null to reject the map. */
  validate?: (level: Level) => Solution | null;
}

/** The night for a date. Always returns a map that has been proven possible. */
export function dailyLevel(date: string, opts: DailyOptions = {}): Daily {
  const maxAttempts = opts.maxAttempts ?? 20;
  const validate = opts.validate ?? ((l: Level) => { const s = findSolution(l, { robustNeeded: 2, maxSimsPerOrder: 2500 }); return s && hasCombos(l, s.shots) ? s : null; });
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const level = candidate(date, attempt);
    if (structureProblems(level).length) continue;
    const sol = validate(level);
    if (sol) return { date, level, solution: sol.shots, attempt, fallback: false };
  }
  // Nothing passed: use a handmade night. Tests prove every one of these is possible.
  const level = { ...LEVELS[dayIndex(date) % LEVELS.length], id: `daily-${date}` };
  const sol = findSolution(level, { robustNeeded: 1, maxSimsPerOrder: 20000 });
  if (!sol) throw new Error(`Fallback night ${level.title} could not be proven possible`);
  return { date, level, solution: sol.shots, attempt: -1, fallback: true };
}
