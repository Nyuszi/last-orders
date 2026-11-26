// Deterministic simulation for Last Orders. No DOM: the same code can run on the
// Devvit server to re-simulate submitted pours and check scores.
import Matter from 'matter-js';
import type { Drink, Level, NpcId, OrderDef, PropDef } from './levels';
import { NPCS } from './levels';

const { Engine, Bodies, Body, Composite, Events } = Matter;

export const POUR_R = 9; // a drink sliding down the bar
export const GLASS_R = 8; // a drink standing on the bar
/** A drink counts as served when any part of the glass touches its ring, not just its centre. */
export const SERVE_REACH = POUR_R;
export const BOWL_R = 13;
export const PROP_R = { hat: 13, cards: 11 } as const;
export const MAX_SPEED = 12.5;
export const STEP_MS = 1000 / 60;
// Feel, tuned after pool and putting: speed drops at an almost steady rate (rolling
// friction is nearly constant with speed), with only a touch of drag. So a drink keeps
// its pace across the bar and then settles, instead of crawling for ages at the end.
export const AIR_POUR = 0.0015;
export const KINETIC_POUR = 0.0659;
const RAIL_T = 14;
/** Extra tip when one pour earns the bonus and serves a drink. */
export const COMBO_TIP = 30;
// Drinks behave like pool balls: they bounce off each other and slide, so a missed drink
// becomes something to bank off or to knock into its circle later. Only a real slam spills.
const SPILL_IMPACT = 7.5;
export const GLASS_BOUNCE = 0.9;
// Like side spin in pool: a slight curve on the wood, and most of the effect at the rail.
const SPIN_RATE = 0.006;
export const ENGLISH = 0.35; // extra sideways speed off a brass rail, per unit of spin
/** Cushions: share of speed into the rail that comes back out, and the grip along it. */
export const CUSHION = { brass: { e: 0.8, grip: 0.96 }, timber: { e: 0.12, grip: 0.7 } };

const AIR = { pour: AIR_POUR, glass: 0.07, bowl: 0.02, prop: 0.09 };
// Sliding friction: a fixed loss of speed per step, so things come to a clean stop.
const KINETIC = { pour: KINETIC_POUR, glass: 0.05, bowl: 0.022, prop: 0.06 };
// Multiplier on friction while a body is inside a puddle.
export const PUDDLE_FRICTION: Record<Drink, number> = { beer: 0.3, rye: 0.35, whiskey: 0.2, sarsaparilla: 2.5, water: 0.9 };
const PUDDLE_RADIUS: Record<Drink, number> = { beer: 46, rye: 40, whiskey: 54, sarsaparilla: 36, water: 36 };

export interface Pt { x: number; y: number }

/**
 * Round hitboxes. Matter.js builds a circle as a polygon with as many sides as its radius
 * (10-13 here), so glancing hits pushed along a face, not the line of centres, and the aim line
 * couldn't predict them. Round things are 40-sided instead: within 0.3% of a true circle.
 */
export const ROUND_SIDES = 40;
function roundBody(x: number, y: number, r: number, options: Matter.IChamferableBodyDefinition): Matter.Body {
  return Bodies.polygon(x, y, ROUND_SIDES, r, { ...options, circleRadius: r } as Matter.IChamferableBodyDefinition);
}
/** Mass of a round body as the physics has it (density times the 40-gon's area). */
export function roundMass(density: number, r: number): number {
  return density * (ROUND_SIDES / 2) * r * r * Math.sin((2 * Math.PI) / ROUND_SIDES);
}
/** Mass of a poured drink, the unit the aim line and the generator measure masses in. */
export const DRINK_MASS = roundMass(0.003, POUR_R);

/** Launch speed (units per step) for a pour power from 0 to 1. */
export function launchSpeed(power: number): number {
  return Math.sqrt(Math.max(0, Math.min(1, power))) * MAX_SPEED;
}
export interface Puddle { drink: Drink; poly: Pt[]; born: number; cx: number; cy: number }

/** Any drink on the bar: one already there, one you served, or one that missed. */
export interface Glass {
  id: string;
  drink: Drink;
  owner: NpcId | null;
  role: 'pour' | 'served' | 'stray' | 'standing';
  order: number; // index into level.orders, or -1
  body: Matter.Body | null;
  tipped: boolean; tipAngle: number; tipX: number; tipY: number; floor: boolean;
}
export interface Prop extends PropDef { body: Matter.Body | null; touched: boolean; wet: boolean }
export interface Order extends OrderDef { served: boolean; quality: number; tip: number; cancelled: boolean }
export interface Shot { tick: number; angle: number; power: number; spin: number }
export type Status = 'aiming' | 'rolling' | 'won' | 'failed' | 'out';

export type SimEvent =
  | { t: 'say'; npc: NpcId; text: string }
  | { t: 'tip'; x: number; y: number; drink: Drink; owner?: NpcId | null }
  | { t: 'smash'; x: number; y: number; owner?: NpcId | null }
  | { t: 'bank'; x: number; y: number }
  | { t: 'contact' }
  | { t: 'leave'; npc: NpcId }
  | { t: 'warn'; npc: NpcId }
  | { t: 'thud'; x: number; y: number }
  | { t: 'served'; x: number; y: number; quality: number; tip: number; owner: NpcId; trick: boolean }
  | { t: 'bonus'; kind: 'peanuts' | 'cards'; x: number; y: number }
  /** A perfect serve earned a spare glass. */
  | { t: 'extra'; x: number; y: number }
  /** The same pour earned the bonus and served a drink. */
  | { t: 'combo'; x: number; y: number; tip: number }
  | { t: 'slam'; x: number; y: number }
  | { t: 'settled' };

type Tag =
  | { kind: 'rail'; type: 'brass' | 'timber'; nx: number; ny: number }
  | { kind: 'post' }
  | { kind: 'arm' }
  | { kind: 'glass'; glass: Glass }
  | { kind: 'prop'; prop: Prop }
  | { kind: 'bowl' };

/** A contact the engine found this step: bodies, and their positions and velocities before it resolved it. */
interface QueuedHit { a: Matter.Body; b: Matter.Body; va: Pt; vb: Pt; pa: Pt; pb: Pt; n: Pt }

export class Sim {
  readonly level: Level;
  readonly engine: Matter.Engine;
  tick = 0;
  status: Status = 'aiming';
  shots: Shot[] = [];
  orders: Order[];
  glasses: Glass[] = [];
  props: Prop[];
  puddles: Puddle[] = [];
  bowl: Matter.Body | null = null;
  arm: Matter.Body | null = null;
  armExtension = 0;
  badges = new Set<string>();
  failReason = '';
  /** Customers who walked out (the sheriff, if you touch or splash his hat). */
  left = new Set<NpcId>();
  spills = 0;
  smashes = 0;
  events: SimEvent[] = [];
  /** What happened to each pour, for the share card: 'served' | 'perfect' | 'miss' | 'spill' | 'smash'. */
  pourResults: string[] = [];
  /** Spare glasses earned by perfect serves, on top of the night's pours. */
  extraPours = 0;
  /** A bonus (peanuts, cards) earned by the pour now rolling, so it isn't recorded as a miss. */
  private bonusThisPour: '' | 'peanuts' | 'cards' = '';

  private tags = new Map<number, Tag>();
  private hits: QueuedHit[] = [];
  private quiet = 0;
  private rollSteps = 0;
  private shotBanked = false;
  private current: Glass | null = null;
  private seq = 0;

  constructor(level: Level) {
    this.level = level;
    this.engine = Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
    this.engine.positionIterations = 10;
    this.engine.velocityIterations = 8;
    const c = level.counter;

    for (const seg of level.rails) {
      const len = seg.to - seg.from;
      const opts = { isStatic: true, restitution: seg.type === 'brass' ? 0.86 : 0.04, friction: 0, frictionStatic: 0 };
      const body = seg.side === 'left' || seg.side === 'right'
        ? Bodies.rectangle(seg.side === 'left' ? c.x - RAIL_T / 2 : c.x + c.w + RAIL_T / 2, seg.from + len / 2, RAIL_T, len, opts)
        : Bodies.rectangle(seg.from + len / 2, seg.side === 'top' ? c.y - RAIL_T / 2 : c.y + c.h + RAIL_T / 2, len + RAIL_T * 2, RAIL_T, opts);
      // Normal pointing from the rail back onto the counter.
      const n = { left: [1, 0], right: [-1, 0], top: [0, 1], bottom: [0, -1] }[seg.side];
      this.add(body, { kind: 'rail', type: seg.type, nx: n[0], ny: n[1] });
    }

    for (const p of level.posts) {
      this.add(roundBody(p.x, p.y, p.r, { isStatic: true, restitution: 0.75, friction: 0 }), { kind: 'post' });
    }

    this.orders = level.orders.map((o) => ({ ...o, served: false, quality: 0, tip: 0, cancelled: false }));

    for (const g of level.glasses) this.standGlass(g.id, g.drink, g.owner, 'standing', -1, g.x, g.y);

    this.props = level.props.map((p) => {
      const prop: Prop = { ...p, body: null, touched: false, wet: false };
      prop.body = roundBody(p.x, p.y, PROP_R[p.kind], { density: 0.0015, frictionAir: AIR.prop, restitution: 0.1, friction: 0.05 });
      this.add(prop.body, { kind: 'prop', prop });
      return prop;
    });

    if (level.bowl) {
      this.bowl = roundBody(level.bowl.x, level.bowl.y, BOWL_R, { density: 0.0035, frictionAir: AIR.bowl, restitution: 0.25, friction: 0.02 });
      this.add(this.bowl, { kind: 'bowl' });
    }

    if (level.arm) {
      this.arm = Bodies.rectangle(this.armX(0), level.arm.y, level.arm.reach + 40, 14, { isStatic: true, restitution: 0.3, friction: 0 });
      this.add(this.arm, { kind: 'arm' });
    }

    for (const p of level.puddles) {
      const poly: Pt[] = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        poly.push({ x: p.x + Math.cos(a) * p.r * (1 + 0.12 * Math.sin(a * 3)), y: p.y + Math.sin(a) * p.r * (1 + 0.1 * Math.cos(a * 2)) });
      }
      this.puddles.push({ drink: p.drink, poly, born: -999, cx: p.x, cy: p.y });
    }

    Events.on(this.engine, 'collisionStart', (ev) => {
      for (const pair of ev.pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        this.hits.push({ a, b, va: { ...a.velocity }, vb: { ...b.velocity }, pa: { ...a.position }, pb: { ...b.position }, n: { ...pair.collision.normal } });
      }
    });
  }

  private add(body: Matter.Body, tag: Tag) {
    this.tags.set(body.id, tag);
    Composite.add(this.engine.world, body);
  }

  private remove(body: Matter.Body) {
    Composite.remove(this.engine.world, body);
    this.tags.delete(body.id);
  }

  private standGlass(id: string, drink: Drink, owner: NpcId | null, role: Glass['role'], order: number, x: number, y: number): Glass {
    const glass: Glass = { id, drink, owner, role, order, body: null, tipped: false, tipAngle: 0, tipX: x, tipY: y, floor: false };
    // Same mass as a poured drink, so hits transfer speed the way pool balls do.
    glass.body = roundBody(x, y, GLASS_R, { density: 0.003 * (POUR_R / GLASS_R) ** 2, frictionAir: AIR.pour, restitution: GLASS_BOUNCE, friction: 0.01 });
    this.add(glass.body, { kind: 'glass', glass });
    this.glasses.push(glass);
    return glass;
  }

  // Pete's arm rests just off the counter and sweeps across it once per period.
  private armX(tick: number): number {
    const arm = this.level.arm!;
    const c = this.level.counter;
    const w = arm.reach + 40;
    const phase = (tick % arm.period) / arm.period;
    const e = phase < 0.55 ? 0 : Math.sin(((phase - 0.55) / 0.45) * Math.PI) ** 2;
    this.armExtension = e;
    const npc = this.level.npcs.find((n) => n.id === arm.owner)!;
    if (npc.side === 'right') return c.x + c.w + 6 - (arm.reach + 6) * e + w / 2;
    return c.x - 6 + (arm.reach + 6) * e - w / 2;
  }

  get poursLeft(): number {
    return this.level.pours + this.extraPours - this.shots.length;
  }

  /** The next order to pour, or -1 when everything is served. */
  get nextOrder(): number {
    return this.orders.findIndex((o) => !o.served && !o.cancelled);
  }

  get servedCount(): number {
    return this.orders.filter((o) => o.served).length;
  }

  get tips(): number {
    return this.orders.reduce((s, o) => s + o.tip, 0);
  }

  get pour(): Glass | null {
    return this.current;
  }

  fire(angle: number, power: number, spin: number): boolean {
    const oi = this.nextOrder;
    if (this.status !== 'aiming' || this.poursLeft <= 0 || oi < 0) return false;
    power = Math.max(0.05, Math.min(1, power));
    // Spin is continuous from -1 (curve left) to 1 (curve right), stored to 2 decimals.
    spin = Math.round(Math.max(-1, Math.min(1, spin)) * 100) / 100;
    const o = this.orders[oi];
    const s = this.level.start;
    const glass: Glass = { id: `pour-${++this.seq}`, drink: o.drink, owner: o.owner, role: 'pour', order: oi, body: null, tipped: false, tipAngle: 0, tipX: s.x, tipY: s.y, floor: false };
    glass.body = roundBody(s.x, s.y, POUR_R, { density: 0.003, frictionAir: AIR.pour, restitution: GLASS_BOUNCE, friction: 0.01 });
    (glass.body as Matter.Body & { spin?: number }).spin = spin;
    this.add(glass.body, { kind: 'glass', glass });
    this.glasses.push(glass);
    this.current = glass;
    // Like a putting stroke: distance grows in a straight line with how far you pull back.
    // With near-constant rolling friction distance goes with speed squared, so speed = sqrt(power).
    const speed = launchSpeed(power);
    Body.setVelocity(glass.body, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    this.shots.push({ tick: this.tick, angle, power, spin });
    this.status = 'rolling';
    this.quiet = 0;
    this.rollSteps = 0;
    this.shotBanked = false;
    return true;
  }

  step() {
    this.tick++;
    if (this.arm) {
      const before = this.armExtension;
      (Body.setPosition as (b: Matter.Body, p: Pt, v?: boolean) => void)(this.arm, { x: this.armX(this.tick), y: this.level.arm!.y }, true);
      // At full reach his palm slaps the bar; on the way back he half wakes up.
      if (before < 0.97 && this.armExtension >= 0.97) {
        const arm = this.level.arm!;
        const npc = this.level.npcs.find((n) => n.id === arm.owner)!;
        const c = this.level.counter;
        const handX = npc.side === 'right' ? c.x + c.w - arm.reach : c.x + arm.reach;
        this.events.push({ t: 'slam', x: handX, y: arm.y });
      }
      if (before >= 0.6 && this.armExtension < 0.6) this.say(this.level.arm!.owner, 'Hm?');
    }
    this.applyEnvironment();
    Engine.update(this.engine, STEP_MS);
    this.processHits();
    this.checkOffBar();
    if (this.status === 'rolling') {
      this.rollSteps++;
      let moving = false;
      for (const body of Composite.allBodies(this.engine.world)) {
        if (!body.isStatic && body.speed > 0.05) { moving = true; break; }
      }
      this.quiet = moving ? 0 : this.quiet + 1;
      if (this.quiet >= 8 || this.rollSteps > 1500) this.settle();
    }
  }

  /** Play one recorded pour to the end (used by replays and the solver). */
  playShot(shot: Shot, maxSteps = 4000): void {
    while (this.tick < shot.tick && this.status === 'aiming') this.step();
    if (!this.fire(shot.angle, shot.power, shot.spin)) return;
    let n = 0;
    while (this.status === 'rolling' && n++ < maxSteps) this.step();
  }

  private say(npc: NpcId, text: string) {
    this.events.push({ t: 'say', npc, text });
  }

  private puddleAt(x: number, y: number): Puddle | null {
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      if (pointInPoly(x, y, this.puddles[i].poly)) return this.puddles[i];
    }
    return null;
  }

  private applyEnvironment() {
    for (const body of Composite.allBodies(this.engine.world)) {
      if (body.isStatic) continue;
      const tag = this.tags.get(body.id);
      if (!tag) continue;
      // Every drink slides the same way once it's moving, whoever's it is.
      const k = tag.kind === 'glass' ? 'pour' : tag.kind === 'bowl' ? 'bowl' : 'prop';
      const p = this.puddleAt(body.position.x, body.position.y);
      const mult = p ? PUDDLE_FRICTION[p.drink] : 1;
      body.frictionAir = AIR[k] * mult;
      const speed0 = body.speed;
      if (speed0 > 0) {
        const kf = KINETIC[k] * mult;
        const f = speed0 <= kf ? 0 : (speed0 - kf) / speed0;
        Body.setVelocity(body, { x: body.velocity.x * f, y: body.velocity.y * f });
      }
      if (k === 'pour') {
        const spin = (body as Matter.Body & { spin?: number }).spin ?? 0;
        const speed = body.speed;
        if (spin !== 0 && speed > 0.25) {
          // Curve more as the drink slows down, like a curling stone.
          const turn = (spin * SPIN_RATE) / Math.max(speed, 1.5);
          const cos = Math.cos(turn), sin = Math.sin(turn);
          const v = body.velocity;
          Body.setVelocity(body, { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos });
        }
      }
    }
  }

  private processHits() {
    const hits = this.hits;
    this.hits = [];
    hits.push(...this.sweptHits(hits));
    for (const h of hits) {
      const ta = this.tags.get(h.a.id), tb = this.tags.get(h.b.id);
      if (!ta || !tb) continue;
      // Round on round (drinks, the bowl, props, posts) is resolved as true circles.
      const n = this.roundHit(h) ?? h.n;
      const rel = { x: h.va.x - h.vb.x, y: h.va.y - h.vb.y };
      const impact = Math.abs(rel.x * n.x + rel.y * n.y);
      this.handleHit(h.a, ta, h.b, tb, impact, h.vb, h.va);
      this.handleHit(h.b, tb, h.a, ta, impact, h.va, h.vb);
      if (ta.kind === 'rail' && !h.b.isStatic) this.cushion(h.b, tb, ta, h.vb);
      else if (tb.kind === 'rail' && !h.a.isStatic) this.cushion(h.a, ta, tb, h.va);
    }
  }

  /**
   * Hits the engine missed: a drink moves up to 12.5 units a step, so it can graze something
   * between two steps without the two ever overlapping at a step's end. Any two round things
   * whose true circles touched during the step (and weren't touching at its start) count as
   * a hit, so the aim line can promise thin cuts exactly.
   */
  private sweptHits(found: QueuedHit[]): QueuedHit[] {
    const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    const seen = new Set(found.map((h) => key(h.a.id, h.b.id)));
    const round = Composite.allBodies(this.engine.world).filter((b) => (b as Matter.Body & { circleRadius?: number }).circleRadius && this.tags.has(b.id));
    const out: QueuedHit[] = [];
    const still = { x: 0, y: 0 };
    for (let i = 0; i < round.length; i++) {
      for (let j = i + 1; j < round.length; j++) {
        const a = round[i], b = round[j];
        if ((a.isStatic || a.speed < 0.05) && (b.isStatic || b.speed < 0.05)) continue;
        if (seen.has(key(a.id, b.id))) continue;
        const R = (a as Matter.Body & { circleRadius: number }).circleRadius + (b as Matter.Body & { circleRadius: number }).circleRadius;
        const va = a.isStatic ? still : a.velocity, vb = b.isStatic ? still : b.velocity;
        const d0 = { x: a.position.x - va.x - (b.position.x - vb.x), y: a.position.y - va.y - (b.position.y - vb.y) };
        const dd = d0.x * d0.x + d0.y * d0.y;
        if (dd < R * R) continue; // already touching when the step began
        const w = { x: va.x - vb.x, y: va.y - vb.y };
        const A = w.x * w.x + w.y * w.y, B = 2 * (d0.x * w.x + d0.y * w.y), disc = B * B - 4 * A * (dd - R * R);
        if (A < 1e-9 || disc < 0) continue;
        const t = (-B - Math.sqrt(disc)) / (2 * A);
        if (t < 0 || t > 1) continue;
        out.push({ a, b, va: { ...va }, vb: { ...vb }, pa: { ...a.position }, pb: { ...b.position }, n: { x: 0, y: 0 } });
      }
    }
    return out;
  }

  /**
   * Two round things hitting, done by hand like a pool break rather than by the engine.
   * The engine only notices a contact once the shapes overlap, up to a whole step (12.5
   * units) late, and pushes along a polygon face, so bounces came out up to 20 degrees off
   * the aim line's prediction. Here time is wound back to the moment the true circles touch, both bounce
   * along the line of centres there (same formula as the aim line), and the rest of the step
   * is played forward. Returns the contact normal, or null when this isn't a round pair.
   */
  private roundHit(h: QueuedHit): Pt | null {
    const ra = (h.a as Matter.Body & { circleRadius?: number }).circleRadius;
    const rb = (h.b as Matter.Body & { circleRadius?: number }).circleRadius;
    if (!ra || !rb || (h.a.isStatic && h.b.isStatic)) return null;
    const R = ra + rb;
    const d0 = { x: h.pa.x - h.pb.x, y: h.pa.y - h.pb.y };
    const w = { x: h.va.x - h.vb.x, y: h.va.y - h.vb.y };
    // How far back (in steps) the circles first touched: |d0 - w s| = R. A swept hit (below)
    // ends the step already apart again, and this finds its touch the same way.
    let s = 0;
    const ww = w.x * w.x + w.y * w.y, dw = d0.x * w.x + d0.y * w.y, dd = d0.x * d0.x + d0.y * d0.y;
    const disc = dw * dw - ww * (dd - R * R);
    if (ww > 1e-9 && disc >= 0) s = Math.min(1, Math.max(0, (dw + Math.sqrt(disc)) / ww));
    const cx = d0.x - w.x * s, cy = d0.y - w.y * s;
    const len = Math.hypot(cx, cy) || 1;
    const n = { x: cx / len, y: cy / len }; // from b to a
    const vn = w.x * n.x + w.y * n.y;
    if (vn >= 0) return n; // already parting
    const e = Math.max(h.a.restitution, h.b.restitution); // as the engine does
    const ia = h.a.isStatic ? 0 : 1 / h.a.mass, ib = h.b.isStatic ? 0 : 1 / h.b.mass;
    const j = (-(1 + e) * vn) / (ia + ib);
    const va = { x: h.va.x + j * ia * n.x, y: h.va.y + j * ia * n.y };
    const vb = { x: h.vb.x - j * ib * n.x, y: h.vb.y - j * ib * n.y };
    // Back to the moment of touch, then on for the rest of the step with the new velocities.
    const move = (body: Matter.Body, p: Pt, v0: Pt, v1: Pt) => {
      if (body.isStatic) return;
      Body.setPosition(body, { x: p.x - v0.x * s + v1.x * s, y: p.y - v0.y * s + v1.y * s });
      Body.setVelocity(body, v1);
      Body.setAngularVelocity(body, 0);
    };
    move(h.a, h.pa, h.va, va);
    move(h.b, h.pb, h.vb, vb);
    return n;
  }

  /**
   * Rail bounce, done by hand rather than by the physics engine. The engine treats slow
   * or glancing contacts as resting, so a drink would cling to the rail and slide along it.
   * Here the angle out mirrors the angle in, the rail keeps part of the speed, and side spin
   * ("english") pushes the bounce wider or narrower, as it does off a pool cushion.
   */
  private cushion(body: Matter.Body, tag: Tag, rail: Extract<Tag, { kind: 'rail' }>, v: Pt) {
    const vn = v.x * rail.nx + v.y * rail.ny;
    if (vn >= 0) return; // already moving away
    const { e, grip } = CUSHION[rail.type];
    const tx = -rail.ny, ty = rail.nx; // tangent along the rail
    let vt = (v.x * tx + v.y * ty) * grip;
    const out = -vn * e;
    if (tag.kind === 'glass' && tag.glass.role === 'pour' && rail.type === 'brass') {
      const b = body as Matter.Body & { spin?: number };
      const spin = b.spin ?? 0;
      if (spin) {
        // Right spin pushes the bounce to the drink's right as it travels.
        const rx = -v.y, ry = v.x;
        const side = Math.sign(rx * tx + ry * ty) || 1;
        vt += side * spin * ENGLISH * -vn;
        b.spin = spin * 0.4; // most of the spin is used up by the rail
      }
    }
    Body.setVelocity(body, { x: rail.nx * out + tx * vt, y: rail.ny * out + ty * vt });
  }

  // `self` was hit by `other`. vOther/vSelf are pre-impact velocities.
  private handleHit(self: Matter.Body, ts: Tag, other: Matter.Body, to: Tag, impact: number, vOther: Pt, vSelf: Pt) {
    // Tell the screen the poured drink touched something (it eases out of slow motion).
    if (ts.kind === 'glass' && ts.glass.role === 'pour' && impact > 0.3) this.events.push({ t: 'contact' });
    if (ts.kind === 'glass' && ts.glass.role === 'pour' && to.kind === 'rail' && impact > 0.6) {
      if (to.type === 'brass') {
        this.shotBanked = true;
        this.events.push({ t: 'bank', x: self.position.x, y: self.position.y });
      } else {
        this.events.push({ t: 'thud', x: self.position.x, y: self.position.y });
      }
    }
    if (ts.kind === 'glass' && !ts.glass.tipped) {
      const g = ts.glass;
      let dir = Math.atan2(vOther.y - vSelf.y, vOther.x - vSelf.x);
      if (Math.hypot(vOther.x - vSelf.x, vOther.y - vSelf.y) < 0.2) dir = Math.atan2(self.position.y - other.position.y, self.position.x - other.position.x);
            // Drinks bounce off each other and off the peanut bowl; only slamming into
      // something fixed and hard (a beer tap, the tip jar, Pete's arm) spills one.
      if (impact > SPILL_IMPACT && (to.kind === 'post' || to.kind === 'arm')) this.tipGlass(g, g.role === 'pour' ? Math.atan2(vSelf.y, vSelf.x) : dir, true);
    }
    if (ts.kind === 'prop' && !ts.prop.touched) {
      const need = ts.prop.kind === 'cards' ? 0.6 : 0.25;
      if (impact > need || (to.kind !== 'rail' && ts.prop.kind === 'hat')) this.touchProp(ts.prop);
    }
  }

  /** Pour number on which the sheriff gave his one warning about the hat (-1: not yet). */
  private hatWarnedOn = -1;
  get hatWarned(): boolean { return this.hatWarnedOn >= 0; }

  /**
   * The first time the hat is touched or splashed the sheriff only warns you. Any touch
   * during the same pour is part of that warning; a touch on a later pour sends him out.
   */
  private hatTrouble(prop: Prop): boolean {
    const pour = this.shots.length;
    if (this.hatWarnedOn < 0) {
      this.hatWarnedOn = pour;
      this.say(prop.owner, 'Watch the hat, partner. Next time I walk.');
      this.events.push({ t: 'warn', npc: prop.owner });
      return false;
    }
    return pour > this.hatWarnedOn;
  }

  private touchProp(prop: Prop) {
    if (prop.touched) return;
    if (prop.kind === 'hat') {
      if (!this.hatTrouble(prop)) return;
      prop.touched = true;
      this.walkOut(prop.owner);
    } else {
      prop.touched = true;
      this.bonusThisPour = 'cards';
      this.badges.add('Cheat exposed');
      this.say(prop.owner, NPCS[prop.owner].lines.bonus ?? 'Hey!');
      const p = prop.body?.position ?? { x: prop.x, y: prop.y };
      this.events.push({ t: 'bonus', kind: 'cards', x: p.x, y: p.y });
    }
  }

  /**
   * Touch or splash the sheriff's hat and he doesn't end the night: he grabs his hat and
   * walks out. Anything he still wanted is cancelled, and he takes his tip with him.
   */
  private walkOut(npc: NpcId) {
    if (this.left.has(npc)) return;
    this.left.add(npc);
    for (const o of this.orders) {
      if (o.owner !== npc) continue;
      if (o.served) o.tip = 0; else o.cancelled = true;
    }
    for (const p of this.props) {
      if (p.owner === npc && p.kind === 'hat' && p.body) { this.remove(p.body); p.body = null; }
    }
    this.badges.add('Sheriff walked out');
    this.say(npc, NPCS[npc].lines.hat ?? "That's it. I'm leaving.");
    this.events.push({ t: 'leave', npc });
  }

  private tipGlass(glass: Glass, dir: number, onBar: boolean) {
    if (glass.tipped || !glass.body) return;
    const { x, y } = glass.body.position;
    glass.tipped = true;
    glass.tipAngle = dir;
    glass.tipX = x;
    glass.tipY = y;
    glass.floor = !onBar;
    this.remove(glass.body);
    glass.body = null;
    this.events.push(onBar ? { t: 'tip', x, y, drink: glass.drink, owner: glass.owner } : { t: 'smash', x, y, owner: glass.owner });
    if (onBar) { this.spill(glass.drink, x, y, dir); this.spills++; } else this.smashes++;

    if (glass.role === 'served' && glass.order >= 0) {
      // Knocking over a drink you already served: the customer wants another one.
      const o = this.orders[glass.order];
      o.served = false;
      o.tip = 0;
      o.quality = 0;
      if (glass.owner) this.say(glass.owner, NPCS[glass.owner].lines.knocked ?? 'Hey!');
    } else if (glass.role === 'standing' && glass.owner) {
      this.say(glass.owner, NPCS[glass.owner].lines.knocked ?? 'Hey!');
    } else if (glass.role === 'pour' && onBar) {
      const near = this.nearestNpc(x, y);
      if (near) this.say(near, 'What a waste.');
    }
  }

  private spill(drink: Drink, x: number, y: number, dir: number) {
    const R = PUDDLE_RADIUS[drink];
    const spread = 0.8;
    const ux = Math.cos(dir), uy = Math.sin(dir);
    const px = -uy, py = ux;
    const poly: Pt[] = [{ x: x + px * 10 - ux * 7, y: y + py * 10 - uy * 7 }];
    for (let i = 0; i <= 8; i++) {
      const a = dir - spread + (2 * spread * i) / 8;
      const r = R * (0.82 + 0.18 * Math.cos((i - 4) * 0.9));
      poly.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    poly.push({ x: x - px * 10 - ux * 7, y: y - py * 10 - uy * 7 });
    const c = this.level.counter;
    for (const p of poly) {
      p.x = Math.max(c.x + 2, Math.min(c.x + c.w - 2, p.x));
      p.y = Math.max(c.y + 2, Math.min(c.y + c.h - 2, p.y));
    }
    this.puddles.push({ drink, poly, born: this.tick, cx: x + ux * R * 0.45, cy: y + uy * R * 0.45 });

    // The sheriff's rule: his hat must stay dry.
    for (const p of this.props) {
      if (p.kind !== 'hat' || !p.body || p.wet) continue;
      if (circleHitsPoly(p.body.position.x, p.body.position.y, PROP_R.hat * 0.7, poly) && this.hatTrouble(p)) {
        p.wet = true;
        this.walkOut(p.owner);
      }
    }
  }

  private offBar(x: number, y: number): boolean {
    const c = this.level.counter;
    return x < c.x || x > c.x + c.w || y < c.y || y > c.y + c.h;
  }

  private checkOffBar() {
    for (const g of this.glasses) {
      if (!g.body || !this.offBar(g.body.position.x, g.body.position.y)) continue;
      const v = g.body.velocity;
      if (g.role === 'pour') {
        const near = this.nearestNpc(g.body.position.x, g.body.position.y);
        if (near) this.say(near, 'Butterfingers!');
      }
      this.tipGlass(g, Math.atan2(v.y, v.x), false);
    }
    for (const p of this.props) {
      if (p.body && this.offBar(p.body.position.x, p.body.position.y)) {
        this.touchProp(p);
        // The sheriff may already have taken his hat with him when he walked out.
        if (p.body) this.remove(p.body);
        p.body = null;
      }
    }
    if (this.bowl && this.offBar(this.bowl.position.x, this.bowl.position.y)) {
      this.events.push({ t: 'smash', x: this.bowl.position.x, y: this.bowl.position.y });
      this.remove(this.bowl);
      this.bowl = null;
    }
  }

  private nearestNpc(x: number, y: number): NpcId | null {
    let best: NpcId | null = null, bd = Infinity;
    for (const n of this.level.npcs) {
      const d = Math.hypot((n.side === 'left' ? 70 : 320) - x, n.y - y);
      if (d < bd) { bd = d; best = n.id; }
    }
    return best;
  }

  private settle() {
    for (const body of Composite.allBodies(this.engine.world)) {
      if (!body.isStatic) Body.setVelocity(body, { x: 0, y: 0 });
    }
    const pour = this.current;
    this.current = null;
    if (pour && !pour.tipped) pour.role = 'stray';

    // A served drink knocked out of its circle: the customer wants it back.
    for (const g of this.glasses) {
      if (g.role !== 'served' || !g.body) continue;
      const o = this.orders[g.order];
      // A customer who walked out is gone: their drink can be knocked about, nobody wants it back.
      if (this.left.has(o.owner)) continue;
      if (Math.hypot(g.body.position.x - o.x, g.body.position.y - o.y) > o.r + SERVE_REACH + 1) {
        o.served = false; o.tip = 0; o.quality = 0; g.role = 'stray';
        this.say(o.owner, 'Hey! I had that!');
      }
    }
    let trickThisPour = false;
    const servedNow: number[] = [];
    // Any drink now resting in its own customer's circle is served, including an old miss
    // that got knocked in (a trick shot).
    for (let i = 0; i < this.orders.length; i++) {
      const o = this.orders[i];
      if (o.served || o.cancelled) continue;
      let best: Glass | null = null, bestD = Infinity;
      for (const g of this.glasses) {
        if (g.order !== i || g.role !== 'stray' || !g.body) continue;
        const d = Math.hypot(g.body.position.x - o.x, g.body.position.y - o.y);
        if (d <= o.r + SERVE_REACH && d < bestD) { best = g; bestD = d; }
      }
      if (!best) continue;
      const trick = best !== pour;
      const quality = bestD < 6 ? 3 : bestD < 12 ? 2 : 1;
      o.served = true;
      o.quality = quality;
      o.tip = [0, 10, 25, 50][quality] + (this.shotBanked ? 15 : 0) + (trick ? 25 : 0);
      best.role = 'served';
      if (quality === 3) this.badges.add('Perfect pour');
      if (this.shotBanked) this.badges.add('Bank pour');
      if (trick) { this.badges.add('Trick shot'); trickThisPour = true; }
      // A plain serve shows the customer's happy portrait instead of a speech bubble (main.ts).
      if (trick) this.say(o.owner, 'Well, I\'ll be!');
      this.events.push({ t: 'served', x: o.x, y: o.y, quality, tip: o.tip, owner: o.owner, trick });
      servedNow.push(i);
      // A perfect serve earns a spare glass.
      if (quality === 3) {
        this.extraPours++;
        this.events.push({ t: 'extra', x: o.x, y: o.y });
      }
    }
    // Peanuts first, so a pour that only pushes the bowl into Pete's spot counts as a bonus
    // pour, not a miss.
    const bonus = this.level.bonus;
    if (bonus && this.bowl && !this.badges.has('Peanuts for Pete')) {
      if (Math.hypot(this.bowl.position.x - bonus.x, this.bowl.position.y - bonus.y) < bonus.r) {
        this.badges.add('Peanuts for Pete');
        this.bonusThisPour = 'peanuts';
        this.say('pete', NPCS.pete.lines.bonus);
        this.events.push({ t: 'bonus', kind: 'peanuts', x: bonus.x, y: bonus.y });
      }
    }
    // Combo: the pour that earned the bonus also served a drink. The bonus is meant to be
    // picked up on the way to a customer, not by spending a glass on it.
    if (this.bonusThisPour && servedNow.length) {
      const o = this.orders[servedNow[servedNow.length - 1]];
      o.tip += COMBO_TIP;
      this.badges.add('Combo');
      this.events.push({ t: 'combo', x: o.x, y: o.y, tip: COMBO_TIP });
    }
    if (pour) {
      if (pour.tipped) this.pourResults.push(pour.floor ? 'smash' : 'spill');
      else if (pour.role === 'served') this.pourResults.push(this.orders[pour.order].quality === 3 ? 'perfect' : 'served');
      else if (trickThisPour) this.pourResults.push('trick');
      else if (this.bonusThisPour) this.pourResults.push(this.bonusThisPour);
      else {
        this.pourResults.push('miss');
        // No bubble: the customer's angry portrait shows instead (main.ts).
      }
    }
    this.bonusThisPour = '';
    this.events.push({ t: 'settled' });

    if (this.nextOrder < 0) {
      this.status = 'won';
      if (this.shots.length === this.level.orders.length) this.badges.add('No wasted pours');
      if (this.spills === 0 && this.smashes === 0 && this.left.size === 0) this.badges.add('Clean bar');
    } else if (this.poursLeft <= 0) {
      this.status = 'out';
    } else {
      this.status = 'aiming';
    }
  }
}

export function pointInPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToSeg(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function circleHitsPoly(x: number, y: number, r: number, poly: Pt[]): boolean {
  if (pointInPoly(x, y, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (distToSeg(x, y, poly[i], poly[j]) < r) return true;
  }
  return false;
}
