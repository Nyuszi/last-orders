// Pixel-art renderer for Last Orders. The world is drawn into a small 195x300 buffer
// with hard-edged primitives (no anti-aliasing), then scaled up by a whole number so
// every pixel stays square. Text is drawn on top at full resolution in a pixel font.
import type { Drink, Level, NpcId, Side } from './levels';
import { NPCS } from './levels';
import { BOWL_R, GLASS_R, POUR_R, PROP_R, type Sim, type SimEvent } from './sim';
import {
  ACE, BOWL, BOWL_PAL, CARDS, GLASS, GLASS_BEER, GLASS_TIPPED, HAT, HAT_PAL, ITEM_PAL, NPC_PAL, NPC_SPRITES,
  PETE_DROP, PETE_LEAN, PETE_SLIP, TAP, TAP_PAL, TIPJAR, glassPal, rotateCCW, rotateCW, type SpriteMap,
} from './sprites';

// Customers sit with their hands toward the counter: left-side sprites face right, right-side face left.
const NPC_LEFT = Object.fromEntries(Object.entries(NPC_SPRITES).map(([k, m]) => [k, rotateCCW(m)])) as Record<NpcId, SpriteMap>;
const NPC_RIGHT = Object.fromEntries(Object.entries(NPC_SPRITES).map(([k, m]) => [k, rotateCW(m)])) as Record<NpcId, SpriteMap>;
const PETE_POSES = {
  lean: { left: rotateCCW(PETE_LEAN), right: rotateCW(PETE_LEAN) },
  slip: { left: rotateCCW(PETE_SLIP), right: rotateCW(PETE_SLIP) },
  drop: { left: rotateCCW(PETE_DROP), right: rotateCW(PETE_DROP) },
};
const SHARD_DIRS: [number, number][] = [[-1, -0.4], [0.9, -0.6], [1, 0.5], [-0.7, 0.7], [0.2, -1]];
/** Customers are drawn at double pixel size, so they read clearly next to the bar. */
const NPC_SCALE = 2;
/** Mass of a drink glass in the physics (density 0.003, radius 9). */
const DRINK_MASS = 0.003 * Math.PI * 81;
/** How many art pixels a customer's centre sits from the rail. */
const NPC_INSET = 15;
/** Colours sampled from Pete's sprite (npc-pete-drop.png), for the arm that slides across the bar. */
const PETE_ARM = { outline: '#3d3b3b', sleeve: '#5c5c5c', light: '#757474', shade: '#474747', skin: '#df9b72', skinLight: '#eea378', skinShade: '#c27754' };
/** Column of Pete's slapping arm (the one that drops in npc-pete-drop.png) in his 32 px wide sprite. */
const PETE_ARM_COL = 5.5;
/** Where a hand-drawn customer's hands end: on the rail's outer part, sleeves well off it. */
const HAND_EDGE_LEFT = 59;
const HAND_EDGE_RIGHT = 137;
const TIPPED = { right: GLASS_TIPPED, down: rotateCW(GLASS_TIPPED), left: rotateCW(rotateCW(GLASS_TIPPED)), up: rotateCCW(GLASS_TIPPED) };

export const W = 390;
export const H = 600;
const S = 0.5; // world units -> buffer pixels
/** The glasses' fine layer is FINE× the buffer; each glass art pixel is GLASS_PX fine pixels (2/3 of a game pixel). */
const FINE = 6;
const GLASS_PX = 4;
export const PW = W * S;
export const PH = H * S;
const FONT = '"Silkscreen", "Pixelify Sans", monospace';
const BUBBLE_FONT = '"Pixelify Sans", "Silkscreen", monospace';
const P = (v: number) => Math.round(v * S);

const PAL = {
  floor: '#2b1a12', floorLine: '#22140d', floorKnot: '#3a2418',
  wood: '#8a5631', woodDark: '#6e4226', woodLight: '#a0683c', woodSeam: '#5a341d',
  brassDark: '#9a6c1f', brass: '#d9a441', brassLight: '#f6dc8f',
  timber: '#4a2f1e', timberDark: '#2e1c11', nail: '#9a8670',
  cream: '#f3e6cc', ink: '#1a0f0a', amber: '#f2b53a', blue: '#7cc2f0', danger: '#e8664a', green: '#6dbb4a',
  glass: '#dfeaea', glassShade: '#a9bcbc', shadow: '#00000055', skin: '#e2b48c',
};
const DRINK: Record<Drink, string> = { beer: '#e8b24a', rye: '#b5652c', whiskey: '#c77b2e', sarsaparilla: '#5a2c17', water: '#bfe0ea' };
const PUDDLE: Record<Drink, { base: string; hi: string }> = {
  beer: { base: '#b98a3e', hi: '#f0d48a' }, rye: { base: '#9a5a2e', hi: '#d39058' },
  whiskey: { base: '#b07a3a', hi: '#f2cf86' }, sarsaparilla: { base: '#40200f', hi: '#7a4a30' },
  water: { base: '#8fa6a3', hi: '#d6ecef' },
};

// ---------- "smoothed and shaded" customers ----------
// The 16px art is doubled with EPX (a pixel-art upscaler that keeps diagonals clean),
// then lit from the top-left: a light edge where a shape meets its top-left outline and a
// darker edge on its bottom-right. Results are cached per sprite.
function scale2x(m: SpriteMap): SpriteMap {
  const h = m.length, w = m[0].length;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : m[y][x]);
  const o: string[][] = Array.from({ length: h * 2 }, () => []);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = at(x, y), a = at(x, y - 1), b = at(x + 1, y), c = at(x - 1, y), d = at(x, y + 1);
    o[2 * y][2 * x] = c === a && c !== d && a !== b ? a : p;
    o[2 * y][2 * x + 1] = a === b && a !== c && b !== d ? b : p;
    o[2 * y + 1][2 * x] = d === c && d !== b && c !== a ? c : p;
    o[2 * y + 1][2 * x + 1] = b === d && b !== a && d !== c ? d : p;
  }
  return o.map((r) => r.join(''));
}
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1, 7), 16), pb = parseInt(b.slice(1, 7), 16);
  const ch = (n: number, s: number) => (n >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return '#' + [m(16), m(8), m(0)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
const shadeCache = new Map<SpriteMap, (string | null)[][]>();
export function smoothShaded(map16: SpriteMap, pal: Record<string, string>): (string | null)[][] {
  const hit = shadeCache.get(map16);
  if (hit) return hit;
  const m = scale2x(map16);
  const edge = (x: number, y: number) => { const ch = m[y]?.[x]; return ch === undefined || ch === '.' || ch === 'k'; };
  const out = m.map((row, y) => [...row].map((ch, x) => {
    if (ch === '.') return null;
    const col = pal[ch] ?? '#ff00ff';
    if (ch === 'k' || ch === 'E') return col;
    if (edge(x - 1, y - 1) && !edge(x + 1, y + 1)) return mixHex(col, '#fff4dc', 0.22);
    if (edge(x + 1, y + 1) || edge(x + 1, y)) return mixHex(col, '#140a06', 0.22);
    return col;
  }));
  shadeCache.set(map16, out);
  return out;
}

interface Crash { x: number; y: number; t: number; drink: string }

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string }
interface Bubble { npc: NpcId; text: string; life: number }
interface Float { x: number; y: number; text: string; life: number; color: string }
export interface Aim { angle: number; power: number }

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private buf: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private bubbles: Bubble[] = [];
  private floats: Float[] = [];
  private moods = new Map<NpcId, 'angry' | 'happy'>();
  private crashes: Crash[] = [];
  /** Broken glass and puddles left on the floor after a crash. */
  private debris: { x: number; y: number; drink: string; seed: number }[] = [];
  private shake = 0;
  /** Frame each customer started walking out (they slide away from the bar and vanish). */
  private leaving = new Map<NpcId, number>();
  private frame = 0;
  private k = 2; // device pixels per buffer pixel

  /** Hand-drawn customer sprites (32×28, facing down), turned toward the counter like the maps. */
  private npcImgs = new Map<string, Record<'left' | 'right', { img: HTMLCanvasElement; shadow: HTMLCanvasElement; pad: number }>>();

  /**
   * Use a PNG for a customer instead of its character map. `key` is the customer's id, or for
   * Pete one of his poses ("pete-lean", "pete-slip", "pete-drop"); he switches only once all three exist.
   */
  setNpcImage(key: string, url: string) {
    const img = new Image();
    img.onload = () => {
      // Empty rows under the hands, so the hands (not the image edge) can be put on the rail.
      const probe = document.createElement('canvas');
      probe.width = img.width;
      probe.height = img.height;
      const pg = probe.getContext('2d')!;
      pg.drawImage(img, 0, 0);
      const alpha = pg.getImageData(0, 0, img.width, img.height).data;
      let pad = 0;
      while (pad < img.height - 1 && !alpha.slice((img.height - 1 - pad) * img.width * 4, (img.height - pad) * img.width * 4).some((v, i) => i % 4 === 3 && v > 0)) pad++;
      const turn = (dir: 1 | -1) => {
        const c = document.createElement('canvas');
        c.width = img.height;
        c.height = img.width;
        const g = c.getContext('2d')!;
        // -1: counter-clockwise (head left, hands right); 1: clockwise (head right, hands left).
        if (dir < 0) { g.translate(0, img.width); g.rotate(-Math.PI / 2); } else { g.translate(img.height, 0); g.rotate(Math.PI / 2); }
        g.drawImage(img, 0, 0);
        const shadow = document.createElement('canvas');
        shadow.width = c.width;
        shadow.height = c.height;
        const sg = shadow.getContext('2d')!;
        sg.drawImage(c, 0, 0);
        sg.globalCompositeOperation = 'source-in';
        sg.fillStyle = PAL.shadow;
        sg.fillRect(0, 0, c.width, c.height);
        return { img: c, shadow, pad };
      };
      this.npcImgs.set(key, { left: turn(-1), right: turn(1) });
    };
    img.src = url;
  }

  /** Hand-drawn bar items ("item-<name>.png"), drawn centred on the item at their own size. */
  private itemImgs = new Map<string, { img: HTMLImageElement | HTMLCanvasElement; shadow: HTMLCanvasElement }>();

  setItemImage(name: string, url: string) {
    const img = new Image();
    img.onload = () => {
      const shadow = document.createElement('canvas');
      shadow.width = img.width;
      shadow.height = img.height;
      const sg = shadow.getContext('2d')!;
      sg.drawImage(img, 0, 0);
      sg.globalCompositeOperation = 'source-in';
      sg.fillStyle = PAL.shadow;
      sg.fillRect(0, 0, img.width, img.height);
      this.itemImgs.set(name, { img, shadow });
    };
    img.src = url;
  }

  private drawItem(art: { img: HTMLImageElement | HTMLCanvasElement; shadow: HTMLCanvasElement }, cx: number, cy: number) {
    const x0 = Math.round(cx - art.img.width / 2), y0 = Math.round(cy - art.img.height / 2);
    this.g.drawImage(art.shadow, x0 + 1, y0 + 1);
    this.g.drawImage(art.img, x0, y0);
  }

  /** Customers playing a reaction animation: what kind, and the frame it started. */
  private anims = new Map<NpcId, { kind: 'drink' | 'peanuts'; start: number }>();

  /** Pete's pose tracking: last arm extension, whether the arm is on its way back, last pose, a pending head slam. */
  private peteArmLast = 0;
  private peteArmBack = false;
  private petePose: 'lean' | 'slip' | 'drop' = 'lean';
  private peteSlam: { side: 'left' | 'right'; frame: number } | null = null;

  /** Pete's hand-drawn slapping arm (48×10, hand on the left, sleeve cut flat on the right), and its mirror. */
  private armImg: Record<'handLeft' | 'handRight', { img: HTMLCanvasElement; shadow: HTMLCanvasElement }> | null = null;

  setArmImage(url: string) {
    const img = new Image();
    img.onload = () => {
      const make = (mirror: boolean) => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext('2d')!;
        if (mirror) { g.translate(img.width, 0); g.scale(-1, 1); }
        g.drawImage(img, 0, 0);
        const shadow = document.createElement('canvas');
        shadow.width = c.width;
        shadow.height = c.height;
        const sg = shadow.getContext('2d')!;
        sg.drawImage(c, 0, 0);
        sg.globalCompositeOperation = 'source-in';
        sg.fillStyle = PAL.shadow;
        sg.fillRect(0, 0, c.width, c.height);
        return { img: c, shadow };
      };
      this.armImg = { handLeft: make(false), handRight: make(true) };
    };
    img.src = url;
  }

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.buf = document.createElement('canvas');
    this.buf.width = PW;
    this.buf.height = PH;
    this.g = this.gBase = this.buf.getContext('2d')!;
    this.bufTop = document.createElement('canvas');
    this.bufTop.width = PW;
    this.bufTop.height = PH;
    this.gTop = this.bufTop.getContext('2d')!;
    this.fine = [0, 1].map(() => {
      const c = document.createElement('canvas');
      c.width = PW * FINE;
      c.height = PH * FINE;
      c.getContext('2d')!.imageSmoothingEnabled = false;
      return c;
    });
  }

  /** Buffers: the bar and everything under the glasses, and a transparent one for everything above them. */
  private gBase: CanvasRenderingContext2D;
  private bufTop: HTMLCanvasElement;
  private gTop: CanvasRenderingContext2D;
  /** Finer layers (FINE× the buffer) for the glasses: [0] on the bar, [1] the drink in your hand on top. */
  private fine: HTMLCanvasElement[];

  /**
   * Draws a glass on a fine layer with its pixels 2/3 of a game pixel, so the hand-drawn ~14 px
   * glasses come out about 9–10 game pixels across, the size of their hit circle.
   */
  private drawFine(art: { img: HTMLImageElement | HTMLCanvasElement; shadow: HTMLCanvasElement }, wx: number, wy: number, layer: 0 | 1) {
    const g = this.fine[layer].getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const w = art.img.width * GLASS_PX, h = art.img.height * GLASS_PX;
    const x0 = Math.round(wx * S * FINE - w / 2), y0 = Math.round(wy * S * FINE - h / 2);
    g.drawImage(art.shadow, x0 + GLASS_PX, y0 + GLASS_PX, w, h);
    g.drawImage(art.img, x0, y0, w, h);
  }

  resize(cssW: number, cssH: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    const fit = Math.min((cssW * dpr) / PW, (cssH * dpr) / PH);
    // Fine fractional steps: a few art pixels end up one device pixel wider than others,
    // which is far less noticeable than a bar that stops short of the edges of the window.
    this.k = fit >= 2 ? fit : Math.max(0.75, Math.floor(fit * 16) / 16);
    this.canvas.width = Math.round(PW * this.k);
    this.canvas.height = Math.round(PH * this.k);
    this.canvas.style.width = `${this.canvas.width / dpr}px`;
    this.canvas.style.height = `${this.canvas.height / dpr}px`;
  }

  reset() {
    this.particles = [];
    this.bubbles = [];
    this.floats = [];
    this.moods.clear();
    this.crashes = [];
    this.debris = [];
    this.shake = 0;
    this.leaving.clear();
    this.anims.clear();
  }

  /**
   * Who is drinking or eating right now, from the game state: a customer keeps drinking while
   * one of their orders is served (until a later pour knocks the glass out of their circle), and
   * Pete keeps eating while the peanut bowl sits in his spot.
   */
  private syncAnims(sim: Sim) {
    const L = sim.level;
    for (const n of L.npcs) {
      let kind: 'drink' | 'peanuts' | null = null;
      if (n.id === 'pete' && L.bonus && sim.bowl && sim.badges.has('Peanuts for Pete')
        && Math.hypot(sim.bowl.position.x - L.bonus.x, sim.bowl.position.y - L.bonus.y) < L.bonus.r) kind = 'peanuts';
      else if (sim.orders.some((o) => o.owner === n.id && o.served)) kind = 'drink';
      const a = this.anims.get(n.id);
      if (!kind) this.anims.delete(n.id);
      else if (a?.kind !== kind) this.anims.set(n.id, { kind, start: this.frame });
    }
  }

  /**
   * The animation frame image key for a customer, or null when none is playing (or its frames
   * are missing). Drinking: lift once, then drink and enjoy it in turn. Pete's peanuts: grab
   * once, then crack and munch in turn.
   */
  private animFrame(id: NpcId): string | null {
    const a = this.anims.get(id);
    if (!a) return null;
    const t = this.frame - a.start;
    const n = a.kind === 'drink'
      ? (t < 20 ? 1 : (t - 20) % 90 < 50 ? 2 : 3)
      : (t < 30 ? 1 : Math.floor((t - 30) / 18) % 2 ? 3 : 2);
    const key = `anim-${id}-${a.kind}-${n}`;
    return this.npcImgs.has(key) ? key : null;
  }

  setMood(npc: NpcId, mood: 'angry' | 'happy') {
    this.moods.set(npc, mood);
  }

  handle(ev: SimEvent, sim?: Sim) {
    if (ev.t === 'smash' && sim) {
      const c = sim.level.counter;
      const out = 18;
      let x = ev.x, y = ev.y;
      if (x < c.x) x -= out; else if (x > c.x + c.w) x += out;
      if (y < c.y) y -= out; else if (y > c.y + c.h) y += out;
      this.crashes.push({ x, y, t: 0, drink: 'whiskey' });
      this.floats.push({ x, y: y - 16, text: 'CRASH!', life: 40, color: PAL.danger });
      return;
    }
    switch (ev.t) {
      case 'say':
        this.bubbles = this.bubbles.filter((b) => b.npc !== ev.npc);
        this.bubbles.push({ npc: ev.npc, text: ev.text, life: ev.text === 'zzz' ? 60 : 140 });
        break;
      case 'tip':
        this.burst(ev.x, ev.y, DRINK[ev.drink], 14, 1.6);
        this.burst(ev.x, ev.y, PAL.glass, 5, 1.2);
        break;
      case 'smash': {
        // Push the impact point out onto the floor, away from the counter edge it fell off.
        this.crashes.push({ x: ev.x, y: ev.y, t: 0, drink: 'whiskey' });
        break;
      }
      case 'leave':
        this.leaving.set(ev.npc, this.frame);
        break;
      case 'slam':
        this.shake = 8;
        this.burst(ev.x, ev.y, '#c9b49a', 10, 1.2);
        this.floats.push({ x: ev.x, y: ev.y - 14, text: 'SLAP!', life: 45, color: PAL.amber });
        break;
      case 'bank':
        this.burst(ev.x, ev.y, PAL.brassLight, 6, 1.4);
        break;
      case 'thud':
        this.floats.push({ x: ev.x, y: ev.y, text: 'THUD', life: 34, color: '#cdb894' });
        break;
      case 'served':
        this.burst(ev.x, ev.y, ev.quality === 3 ? PAL.amber : PAL.cream, ev.quality === 3 ? 18 : 9, 1.4);
        this.floats.push({ x: ev.x, y: ev.y - 16, text: ev.quality === 3 ? `PERFECT +${ev.tip}c` : `+${ev.tip}c`, life: 70, color: PAL.amber });
        break;
      case 'bonus':
        this.burst(ev.x, ev.y, PAL.amber, 18, 1.6);
        this.floats.push({ x: ev.x, y: ev.y - 12, text: 'BONUS', life: 70, color: PAL.amber });
        if (ev.kind === 'peanuts') this.setMood('pete', 'happy');
        break;
      default:
        break;
    }
  }

  private burst(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 20 + Math.random() * 16, color });
    }
  }

  // ---------- pixel primitives (buffer coordinates, integers) ----------
  private rect(x: number, y: number, w: number, h: number, col: string) {
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  private dot(x: number, y: number, col: string) {
    this.g.fillStyle = col;
    this.g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  private disc(cx: number, cy: number, r: number, col: string, pattern?: (x: number, y: number) => boolean) {
    cx = Math.round(cx); cy = Math.round(cy);
    this.g.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy));
      if (!pattern) { this.g.fillRect(cx - hw, cy + dy, 2 * hw + 1, 1); continue; }
      for (let dx = -hw; dx <= hw; dx++) if (pattern(cx + dx, cy + dy)) this.g.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }

  private ellipse(cx: number, cy: number, rx: number, ry: number, col: string) {
    cx = Math.round(cx); cy = Math.round(cy);
    this.g.fillStyle = col;
    for (let dy = -ry; dy <= ry; dy++) {
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)) + 0.3);
      this.g.fillRect(cx - hw, cy + dy, 2 * hw + 1, 1);
    }
  }

  /** Circle outline. dash > 0 draws `dash` pixels on, `dash` off, shifted by `phase`. */
  private ring(cx: number, cy: number, r: number, col: string, dash = 0, phase = 0) {
    cx = Math.round(cx); cy = Math.round(cy);
    this.g.fillStyle = col;
    const n = Math.max(12, Math.round(2 * Math.PI * r * 1.4));
    let last = '';
    for (let i = 0; i < n; i++) {
      if (dash && Math.floor((i + phase) / dash) % 2) continue;
      const a = (i / n) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      const key = `${x},${y}`;
      if (key === last) continue;
      last = key;
      this.g.fillRect(x, y, 1, 1);
    }
  }

  private line(x0: number, y0: number, x1: number, y1: number, col: string, every = 1, phase = 0) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, i = phase;
    this.g.fillStyle = col;
    for (;;) {
      if (i++ % every === 0) this.g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Scanline polygon fill; `pattern` may return a colour to paint over single pixels. */
  private poly(pts: { x: number; y: number }[], col: string, pattern?: (x: number, y: number) => string | null) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i], b = pts[j];
        if ((a.y > yc) !== (b.y > yc)) xs.push(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.round(xs[k]), x1 = Math.round(xs[k + 1]);
        if (x1 <= x0) continue;
        this.g.fillStyle = col;
        this.g.fillRect(x0, y, x1 - x0, 1);
        if (pattern) {
          for (let x = x0; x < x1; x++) {
            const c = pattern(x, y);
            if (c) { this.g.fillStyle = c; this.g.fillRect(x, y, 1, 1); }
          }
        }
      }
    }
  }

  // ---------- frame ----------
  draw(sim: Sim, aim: Aim | null, replay: false | 'REPLAY' | 'SOLUTION', slowArrow = 0) {
    const L = sim.level;
    this.frame++;
    this.g = this.gBase;
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.drawFloor(L);
    this.drawCounter(L);
    this.drawPuddles(sim);
    if (L.bonus) this.drawBonus(L.bonus, sim.badges.has('Peanuts for Pete'));
    this.drawOrders(sim);
    for (const p of L.posts) this.drawPost(p.x, p.y, p.r, p.kind);
    // Glasses go on their own finer layer (see drawFine); everything after them is drawn on a
    // transparent top buffer so it still covers the glasses.
    this.drawGlasses(sim);
    this.g = this.gTop;
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.g.clearRect(0, 0, PW, PH);
    this.drawProps(sim);
    if (sim.bowl) this.drawBowl(sim.bowl.position.x, sim.bowl.position.y);
    this.drawDebris();
    if (sim.arm && sim.armExtension > 0.03) this.drawArm(sim);
    this.syncAnims(sim);
    for (const n of L.npcs) this.drawNpc(n.id, n.side, n.y, n.id === L.arm?.owner ? sim.armExtension : 0, n.id === L.arm?.owner);
    const pete = L.npcs.find((n) => n.id === 'pete');
    if (pete && this.peteDreams(L)) this.drawDream(pete.side, pete.y);
    const next = sim.nextOrder;
    if (sim.status === 'aiming' && sim.poursLeft > 0 && next >= 0) {
      const s = L.start;
      if (aim) this.drawGuide(sim, aim);
      this.drawHand(sim, aim);
      if (!aim) this.ring(P(s.x), P(s.y), 8, PAL.cream, 2, Math.floor(this.frame / 6));
      this.drawPour(s.x, s.y, sim.orders[next].drink);
    }
    this.drawDirection(sim, slowArrow);
    this.drawCrashes();
    this.drawParticles();

    // Blit the buffer up, then draw text on top at full resolution.
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // Pete's slap shakes the whole bar for a few frames.
    let sx = 0;
    if (this.shake > 0) { sx = (this.shake % 2 ? 1 : -1) * this.k; this.shake--; }
    ctx.fillStyle = PAL.floor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    // Bar, then the glasses, then everything above them, then the drink in your hand.
    ctx.drawImage(this.buf, sx, 0, this.canvas.width, this.canvas.height);
    for (const layer of [this.fine[0], this.bufTop, this.fine[1]]) ctx.drawImage(layer, sx, 0, this.canvas.width, this.canvas.height);
    for (const f of this.fine) f.getContext('2d')!.clearRect(0, 0, f.width, f.height);
    this.g = this.gBase;
    this.drawOverlay(sim, replay);
  }

  private drawFloor(L: Level) {
    this.rect(0, 0, PW, PH, PAL.floor);
    const c0 = P(L.counter.x) - 9, c1 = P(L.counter.x + L.counter.w) + 9;
    for (let x = 4; x < PW; x += 9) {
      if (x > c0 && x < c1) continue;
      this.rect(x, 0, 1, PH, PAL.floorLine);
      for (let y = (x * 37) % 53; y < PH; y += 71) this.rect(x + 3, y, 2, 1, PAL.floorKnot);
    }
  }

  private npcPos(side: 'left' | 'right', y: number) {
    return { x: side === 'left' ? 56 - NPC_INSET : 140 + NPC_INSET, y: P(y) };
  }

  private drawNpc(id: NpcId, side: 'left' | 'right', y: number, armExt: number, hasArm = false) {
    const pos = this.npcPos(side, y);
    let x = pos.x;
    const py = pos.y;
    const leftAt = this.leaving.get(id);
    if (leftAt !== undefined) {
      // Gets up, turns away, walks off: slide out from the bar until gone.
      const t = this.frame - leftAt;
      if (t > 70) return;
      x += (side === 'left' ? -1 : 1) * Math.round((t * t) / 120);
    }
    const mood = this.moods.get(id);
    if (mood === 'angry' && Math.floor(this.frame / 8) % 2) this.ring(x, py, 18, PAL.danger);
    let map = side === 'left' ? NPC_LEFT[id] : NPC_RIGHT[id];
    let bob = 0;
    let artKey: string = id;
    if (id === 'pete') {
      // Asleep on his elbow; his head drops onto the bar while the arm reaches out, and he
      // stays startled awake until the arm is fully back.
      if (armExt < 0.03) this.peteArmBack = false;
      else if (armExt < this.peteArmLast - 1e-4) this.peteArmBack = true;
      this.peteArmLast = armExt;
      const pose = armExt < 0.03 ? 'lean' : this.peteArmBack ? 'drop' : 'slip';
      if (pose === 'slip' && this.petePose === 'lean') this.peteSlam = { side, frame: this.frame };
      this.petePose = pose;
      map = PETE_POSES[pose][side];
      if (pose === 'lean' && Math.floor(this.frame / 40) % 2) bob = side === 'left' ? -1 : 1;
      const allPoses = (['lean', 'slip', 'drop'] as const).every((p) => this.npcImgs.has(`pete-${p}`));
      artKey = allPoses ? `pete-${pose}` : '';
    }
    // A drink (or Pete's peanuts) just arrived: play that customer's 3-frame animation instead.
    const animKey = this.animFrame(id);
    if (animKey) {
      artKey = animKey;
      bob = 0;
      if (id === 'pete') { this.petePose = 'drop'; this.peteSlam = null; }
    }
    const art = this.npcImgs.get(artKey)?.[side];
    if (art) {
      // Hands rest on the rail (56–62 left, 133–139 right) and stop short of the play area.
      const { width: w, height: h } = art.img;
      const handEdge = side === 'left' ? HAND_EDGE_LEFT - (w - art.pad) : HAND_EDGE_RIGHT - art.pad;
      // Pete's slapping arm sits off-centre in his sprite: when his arm is in play, line that arm
      // up with the physics arm so the arm across the bar comes out of it.
      const armShift = hasArm && id === 'pete' ? (side === 'right' ? h / 2 - PETE_ARM_COL : PETE_ARM_COL + 1 - h / 2) : 0;
      const x0 = handEdge + (x - pos.x) + bob, y0 = Math.round(py - h / 2 + armShift);
      this.g.drawImage(art.shadow, x0 + 1, y0 + 1);
      this.g.drawImage(art.img, x0, y0);
      // His head hits the bar: a burst of sparks at the forehead (the rail side of the sprite).
      if (id === 'pete' && this.peteSlam) {
        const t = this.frame - this.peteSlam.frame;
        const hx = side === 'right' ? x0 + 3 : x0 + w - 3, hy = Math.round(y0 + h / 2);
        if (t === 0) {
          this.burst(hx / S, hy / S, PAL.brassLight, 14, 2.6);
          this.burst(hx / S, hy / S, PAL.cream, 8, 1.8);
        }
        // A comic impact star: short rays fanning away from the forehead, growing then gone.
        // White, not gold, so it stands out against the brass rail.
        if (t < 14) {
          const out = side === 'right' ? -1 : 1, r0 = 4 + (t >> 2), len = t < 9 ? 4 : 2;
          for (const [dx, dy] of [[1, 0], [0.85, -0.85], [0.85, 0.85], [0.3, -1], [0.3, 1]] as const) {
            for (let i = 0; i < len; i++) {
              const px = Math.round(hx + out * dx * (r0 + i)), py2 = Math.round(hy + dy * (r0 + i));
              this.rect(px, py2, 1, 1, i < len - 1 ? '#ffffff' : PAL.amber);
            }
          }
        } else this.peteSlam = null;
      }
      return;
    }
    const grid = smoothShaded(map, NPC_PAL[id]);
    this.colorGrid(grid, x + bob, py);
  }

  private drawCounter(L: Level) {
    const c = L.counter;
    const x0 = P(c.x), x1 = P(c.x + c.w), y0 = P(c.y), y1 = P(c.y + c.h);
    this.rect(x0, y0, x1 - x0, y1 - y0, PAL.wood);
    for (const off of [0, 14, 28, 42, 56]) {
      if (off) this.rect(x0 + off, y0, 1, y1 - y0, PAL.woodSeam);
      this.rect(x0 + off + 1, y0, 1, y1 - y0, PAL.woodLight);
      for (let y = y0 + ((off * 7) % 40); y < y1; y += 46) this.rect(x0 + off + 1, y, 13, 1, PAL.woodSeam);
      for (let y = y0 + ((off * 13) % 23); y < y1; y += 29) this.rect(x0 + off + 4 + (y % 5), y, 3, 1, PAL.woodDark);
    }
    const sides: Side[] = ['left', 'right', 'top', 'bottom'];
    for (const side of sides) {
      const [lo, hi] = side === 'left' || side === 'right' ? [c.y, c.y + c.h] : [c.x, c.x + c.w];
      const segs = L.rails.filter((r) => r.side === side).sort((a, b) => a.from - b.from);
      let cur = lo;
      for (const s of segs) {
        if (s.from > cur) this.drawOpenEdge(L, side, cur, s.from);
        cur = Math.max(cur, s.to);
      }
      if (cur < hi) this.drawOpenEdge(L, side, cur, hi);
      for (const s of segs) this.drawRail(L, side, s.from, s.to, s.type);
    }
  }

  private railRect(L: Level, side: Side, a: number, b: number): [number, number, number, number] {
    const c = L.counter;
    const x0 = P(c.x), x1 = P(c.x + c.w), y0 = P(c.y), y1 = P(c.y + c.h);
    if (side === 'left') return [x0 - 7, P(a), 7, P(b) - P(a)];
    if (side === 'right') return [x1, P(a), 7, P(b) - P(a)];
    if (side === 'top') return [P(a) - 7, y0 - 7, P(b) - P(a) + 14, 7];
    return [P(a) - 7, y1, P(b) - P(a) + 14, 7];
  }

  private drawRail(L: Level, side: Side, a: number, b: number, type: 'brass' | 'timber') {
    const [x, y, w, h] = this.railRect(L, side, a, b);
    const vertical = side === 'left' || side === 'right';
    const len = vertical ? h : w;
    if (type === 'brass') {
      const bands = [PAL.brassDark, PAL.brass, PAL.brass, PAL.brassLight, PAL.brass, PAL.brass, PAL.brassDark];
      bands.forEach((col, i) => (vertical ? this.rect(x + i, y, 1, h, col) : this.rect(x, y + i, w, 1, col)));
      for (let d = 6; d < len; d += 16) {
        if (vertical) this.dot(x + 3, y + d, '#ffffff'); else this.dot(x + d, y + 3, '#ffffff');
      }
    } else {
      this.rect(x, y, w, h, PAL.timber);
      if (vertical) this.rect(x, y, 1, h, PAL.timberDark); else this.rect(x, y, w, 1, PAL.timberDark);
      for (let d = 11; d < len; d += 17) {
        if (vertical) { this.rect(x, y + d, w, 1, PAL.timberDark); this.dot(x + 3, y + d - 5, PAL.nail); }
        else { this.rect(x + d, y, 1, h, PAL.timberDark); this.dot(x + d - 5, y + 3, PAL.nail); }
      }
    }
  }

  private drawOpenEdge(L: Level, side: Side, a: number, b: number) {
    const c = L.counter;
    const x0 = P(c.x), x1 = P(c.x + c.w) - 1, y0 = P(c.y), y1 = P(c.y + c.h) - 1;
    const blink = Math.floor(this.frame / 20) % 2;
    for (let t = P(a); t < P(b); t++) {
      if (Math.floor((t + blink) / 2) % 2) continue;
      if (side === 'left') this.dot(x0, t, PAL.danger);
      if (side === 'right') this.dot(x1, t, PAL.danger);
      if (side === 'top') this.dot(t, y0, PAL.danger);
      if (side === 'bottom') this.dot(t, y1, PAL.danger);
    }
  }

  private drawPuddles(sim: Sim) {
    const shift = Math.floor(this.frame / 5);
    for (const p of sim.puddles) {
      const age = sim.tick - p.born;
      const grow = p.born < 0 ? 1 : Math.min(1, 0.3 + age / 18);
      const pts = p.poly.map((q) => ({ x: (p.cx + (q.x - p.cx) * grow) * S, y: (p.cy + (q.y - p.cy) * grow) * S }));
      const col = PUDDLE[p.drink];
      const sticky = p.drink === 'sarsaparilla';
      this.poly(pts, col.base, (x, y) => {
        if (sticky) return (x * 7 + y * 13) % 23 === 0 ? col.hi : null;
        return (x + y + shift) % 11 === 0 && y % 2 === 0 ? col.hi : null;
      });
    }
  }

  private drawBonus(b: { x: number; y: number; r: number }, done: boolean) {
    const x = P(b.x), y = P(b.y), r = P(b.r);
    this.ring(x, y, r, done ? PAL.amber : PAL.cream, done ? 0 : 1);
    for (const [dx, dy] of [[-2, -1], [1, -2], [2, 1], [-1, 2]]) this.rect(x + dx, y + dy, 2, 1, '#e3c08a');
  }

  // Each order's dotted circle. The one you're pouring pulses; served ones turn solid.
  private drawOrders(sim: Sim) {
    const next = sim.nextOrder;
    sim.orders.forEach((o, i) => {
      if (o.cancelled) return;
      const x = P(o.x), y = P(o.y), r = P(o.r);
      if (o.served) {
        this.ring(x, y, r, PAL.amber);
        return;
      }
      if (i === next && sim.status !== 'won') {
        const on = Math.floor(this.frame / 14) % 2;
        this.disc(x, y, r - 1, PAL.amber, (px, py) => (px + py + on) % 4 === 0);
        this.ring(x, y, r, PAL.amber, 2, Math.floor(this.frame / 5));
      } else {
        this.ring(x, y, r, PAL.cream, 1);
      }
    });
  }

  private drawPost(wx: number, wy: number, wr: number, kind: 'tap' | 'tipjar') {
    const x = P(wx), y = P(wy);
    // Something to avoid: the same pulsing double red ring as the sheriff's hat.
    const pulse = Math.floor(this.frame / 12) % 2, rr = P(wr) + 3;
    this.ring(x, y, rr + pulse, PAL.danger, 3, Math.floor(this.frame / 6));
    this.ring(x, y, rr + 2 + pulse, '#7a2a1a', 3, Math.floor(this.frame / 6) + 3);
    const art = this.itemImgs.get(kind);
    if (art) this.drawItem(art, x, y);
    else {
      const map = kind === 'tap' ? TAP : TIPJAR;
      const pal = kind === 'tap' ? TAP_PAL : ITEM_PAL;
      this.sprite(map, pal, x + 1, y + 1, PAL.shadow);
      this.sprite(map, pal, x, y);
    }
    // Something to avoid: the same small warning sign as the sheriff's hat.
    this.drawWarning(x + 7, y - 11);
  }

  /**
   * The hand-drawn knocked-over glass (item-tipped.png: a whiskey tumbler on its side, open end to
   * the right) recoloured for this drink and turned the way it fell. Cached per drink and direction.
   */
  private tippedArt(drink: Drink, dir: 'right' | 'down' | 'left' | 'up') {
    const key = `tipped-${drink}-${dir}`;
    const done = this.itemImgs.get(key);
    if (done) return done;
    const base = this.itemImgs.get('tipped');
    if (!base) return null;
    const w = base.img.width, h = base.img.height;
    // Recolour the amber whiskey (orange pixels) to this drink, keeping each pixel's lightness.
    const tint = document.createElement('canvas');
    tint.width = w; tint.height = h;
    const tg = tint.getContext('2d')!;
    tg.drawImage(base.img, 0, 0);
    if (drink !== 'whiskey') {
      const d = tg.getImageData(0, 0, w, h), p = d.data;
      const to = DRINK[drink], tr = parseInt(to.slice(1, 3), 16), tgc = parseInt(to.slice(3, 5), 16), tb = parseInt(to.slice(5, 7), 16);
      for (let i = 0; i < p.length; i += 4) {
        const r = p[i], g = p[i + 1], b = p[i + 2];
        if (p[i + 3] === 0 || !(r > g && g > b && r - b > 70)) continue;
        const k = (r + g + b) / (0xc7 + 0x7b + 0x2e); // relative to the whiskey colour #c77b2e
        p[i] = Math.min(255, tr * k); p[i + 1] = Math.min(255, tgc * k); p[i + 2] = Math.min(255, tb * k);
      }
      tg.putImageData(d, 0, 0);
    }
    const turned = dir === 'right' || dir === 'left';
    const c = document.createElement('canvas');
    c.width = turned ? w : h; c.height = turned ? h : w;
    const g = c.getContext('2d')!;
    g.translate(c.width / 2, c.height / 2);
    g.rotate({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir]);
    g.drawImage(tint, -w / 2, -h / 2);
    const shadow = document.createElement('canvas');
    shadow.width = c.width; shadow.height = c.height;
    const sg = shadow.getContext('2d')!;
    sg.drawImage(c, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = PAL.shadow;
    sg.fillRect(0, 0, c.width, c.height);
    const art = { img: c, shadow };
    this.itemImgs.set(key, art);
    return art;
  }

  /** A glass at a world position: the hand-drawn art on the fine layer, or the old map. Layer 1 = above everything. */
  private drawGlass(wx: number, wy: number, drink: Drink, layer: 0 | 1 = 0) {
    const art = this.itemImgs.get(drink);
    if (art) { this.drawFine(art, wx, wy, layer); return; }
    const map = drink === 'beer' ? GLASS_BEER : GLASS;
    const pal = glassPal(drink);
    this.sprite(map, pal, P(wx) + 1, P(wy) + 1, PAL.shadow);
    this.sprite(map, pal, P(wx), P(wy));
  }

  /** The drink in the bartender's hand: drawn on top, over the hand and the aiming guide. */
  private drawPour(wx: number, wy: number, drink: Drink) {
    this.drawGlass(wx, wy, drink, 1);
  }

  private drawGlasses(sim: Sim) {
    for (const gl of sim.glasses) {
      if (gl.tipped) {
        if (gl.floor) continue;
        const ca = Math.cos(gl.tipAngle), sa = Math.sin(gl.tipAngle);
        const dir = Math.abs(ca) > Math.abs(sa) ? (ca > 0 ? 'right' : 'left') : sa > 0 ? 'down' : 'up';
        const art = this.tippedArt(gl.drink, dir);
        if (art) this.drawFine(art, gl.tipX, gl.tipY, 0);
        else this.sprite(TIPPED[dir], glassPal(gl.drink), P(gl.tipX), P(gl.tipY));
        continue;
      }
      if (!gl.body) continue;
      this.drawGlass(gl.body.position.x, gl.body.position.y, gl.drink);
    }
  }

  private drawProps(sim: Sim) {
    for (const p of sim.props) {
      if (!p.body) continue;
      const x = P(p.body.position.x), y = P(p.body.position.y);
      if (p.kind === 'hat') {
        // Danger, not a target: a double red ring that pulses, and a warning sign.
        const pulse = Math.floor(this.frame / 12) % 2;
        this.ring(x, y, 9 + pulse, PAL.danger, 3, Math.floor(this.frame / 6));
        this.ring(x, y, 11 + pulse, '#7a2a1a', 3, Math.floor(this.frame / 6) + 3);
        this.drawWarning(x + 8, y - 9);
        const hat = this.itemImgs.get('hat');
        if (hat) this.drawItem(hat, x, y);
        else {
          this.sprite(HAT, HAT_PAL, x, y + 1, PAL.shadow);
          this.sprite(HAT, HAT_PAL, x, y);
        }
      } else {
        if (!p.touched) this.ring(x, y, P(PROP_R.cards) + 3, PAL.cream, 1);
        const cards = this.itemImgs.get('cards');
        if (cards) this.drawItem(cards, x, y);
        else {
          this.sprite(CARDS, ITEM_PAL, x + 1, y + 1, PAL.shadow);
          this.sprite(CARDS, ITEM_PAL, x, y);
        }
        // Knocked: the hidden ace slides out from under the deck.
        if (p.touched) {
          const ace = this.itemImgs.get('ace');
          if (ace) this.drawItem(ace, x + 6, y + 4);
          else this.sprite(ACE, ITEM_PAL, x + 6, y + 4);
        }
      }
    }
  }

  /** Draws a grid of colours centred on (cx, cy), with a one-pixel drop shadow. */
  private colorGrid(grid: (string | null)[][], cx: number, cy: number) {
    const h = grid.length, w = grid[0].length;
    const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
    this.g.fillStyle = PAL.shadow;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (grid[r][c]) this.g.fillRect(x0 + c + 1, y0 + r + 1, 1, 1);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const col = grid[r][c];
      if (!col) continue;
      this.g.fillStyle = col;
      this.g.fillRect(x0 + c, y0 + r, 1, 1);
    }
  }

  /** A tiny red warning sign: a triangle with an exclamation mark. */
  private drawWarning(x: number, y: number) {
    for (let r = 0; r < 6; r++) this.rect(x - r, y + r, 2 * r + 1, 1, PAL.ink);
    for (let r = 1; r < 5; r++) this.rect(x - r + 1, y + r, 2 * r - 1, 1, PAL.danger);
    this.rect(x, y + 2, 1, 2, '#fff4dc');
    this.dot(x, y + 5, PAL.ink);
  }

  /** Draws an ASCII sprite centred on (cx, cy). '.' is transparent. */
  private sprite(map: string[], pal: Record<string, string>, cx: number, cy: number, solid?: string, scale = 1) {
    const h = map.length, w = map[0].length;
    const x0 = Math.round(cx - (w * scale) / 2), y0 = Math.round(cy - (h * scale) / 2);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const ch = map[r][c];
        if (ch === '.') continue;
        this.g.fillStyle = solid ?? pal[ch];
        this.g.fillRect(x0 + c * scale + (solid ? 1 : 0), y0 + r * scale, scale, scale);
      }
    }
  }

  /** When there are peanuts on the bar, Pete sleeps and dreams of them until he gets them. */
  private peteDreams(L: Sim['level']) {
    return !!L.bowl && this.moods.get('pete') !== 'happy' && !this.leaving.has('pete');
  }

  /** A comic thought cloud over Pete's head with a peanut bowl in it, drifting gently. */
  private drawDream(side: 'left' | 'right', wy: number) {
    const { x, y } = this.npcPos(side, wy);
    const g = this.g;
    const bob = Math.round(Math.sin(this.frame / 40) * 1.5);
    const cx = x - 4, cy = y - 38 + bob;
    const puffs = [[-8, 2, 6], [0, -3, 8], [8, 0, 7], [-1, 4, 7], [11, 4, 4], [-11, 4, 4]];
    const inCloud = (px: number, py: number) => puffs.some(([dx, dy, r]) => (px - dx) ** 2 + (py - dy) ** 2 <= r * r + r);
    for (let py = -12; py <= 12; py++) {
      for (let px = -16; px <= 16; px++) {
        if (!inCloud(px, py)) continue;
        const edge = !inCloud(px - 1, py) || !inCloud(px + 1, py) || !inCloud(px, py - 1) || !inCloud(px, py + 1);
        g.fillStyle = edge ? PAL.ink : py > 6 ? '#d9cdb4' : '#f4ead3';
        g.fillRect(cx + px, cy + py, 1, 1);
      }
    }
    // Thought trail: two small puffs from his head up to the cloud.
    const dot = (dx: number, dy: number, w: number) => {
      g.fillStyle = PAL.ink; g.fillRect(x + dx - 1, y + dy - 1, w + 2, w + 2);
      g.fillStyle = '#f4ead3'; g.fillRect(x + dx, y + dy, w, w);
    };
    dot(6, -17, 2);
    dot(3, -23 + Math.round(bob / 2), 3);
    // The same hand-drawn bowl as on the bar (no shadow: it's a thought).
    const bowl = this.itemImgs.get('peanuts');
    if (bowl) g.drawImage(bowl.img, Math.round(cx - bowl.img.width / 2), Math.round(cy + 1 - bowl.img.height / 2));
    else this.sprite(BOWL, BOWL_PAL, cx, cy + 1);
  }

  private drawBowl(wx: number, wy: number) {
    const x = P(wx), y = P(wy);
    const art = this.itemImgs.get('peanuts');
    if (art) { this.drawItem(art, x, y); return; }
    this.sprite(BOWL, BOWL_PAL, x + 1, y + 1, PAL.shadow);
    this.sprite(BOWL, BOWL_PAL, x, y);
  }

  private drawArm(sim: Sim) {
    const arm = sim.arm!;
    const L = sim.level;
    const npc = L.npcs.find((n) => n.id === L.arm!.owner)!;
    const w = L.arm!.reach + 40;
    const handAtLeft = npc.side === 'right';
    // The physics arm is a long bar; draw only the part between the hand and his shoulder,
    // in double pixels to match the customers.
    const shoulder = this.npcPos(npc.side, npc.y).x + (handAtLeft ? -6 : 6);
    let x0 = P(arm.position.x - w / 2), x1 = P(arm.position.x + w / 2);
    if (handAtLeft) x1 = Math.max(x0 + 4, shoulder); else x0 = Math.min(x1 - 4, shoulder);
    const y = P(arm.position.y);
    if (this.armImg) {
      // Hand at the tip of the physics arm; the sleeve runs back to just under Pete's own sleeve
      // at the rail (not behind his body), trimmed or stretched to fit.
      const art = handAtLeft ? this.armImg.handLeft : this.armImg.handRight;
      const aw = art.img.width, ah = art.img.height;
      const tip = handAtLeft ? x0 : x1;
      const shoulderAt = handAtLeft ? HAND_EDGE_RIGHT + 3 : HAND_EDGE_LEFT - 3;
      const len = Math.max(10, Math.abs(shoulderAt - tip));
      // 2px lower than centred, so the arm lines up with Pete's sleeve.
      const top = y - Math.floor(ah / 2) + 2;
      for (const layer of [art.shadow, art.img]) {
        const o = layer === art.shadow ? 1 : 0;
        // The hand end first (up to the whole image), then repeat a stretch of plain sleeve.
        const first = Math.min(len, aw);
        if (handAtLeft) this.g.drawImage(layer, 0, 0, first, ah, tip + o, top + o, first, ah);
        else this.g.drawImage(layer, aw - first, 0, first, ah, tip - first + o, top + o, first, ah);
        const SLEEVE = 12; // columns of plain sleeve near the cut end, used to lengthen the arm
        for (let done = first; done < len; done += SLEEVE) {
          const n = Math.min(SLEEVE, len - done);
          if (handAtLeft) this.g.drawImage(layer, aw - SLEEVE, 0, n, ah, tip + done + o, top + o, n, ah);
          else this.g.drawImage(layer, SLEEVE - n, 0, n, ah, tip - done - n + o, top + o, n, ah);
        }
      }
      return;
    }
    // Same sleeve and hand as the arm that drops in Pete's sprite: an 8 px grey sleeve, a skin-tone hand.
    this.rect(x0, y - 4, x1 - x0, 8, PETE_ARM.outline);
    this.rect(x0, y - 3, x1 - x0, 6, PETE_ARM.sleeve);
    this.rect(x0, y - 3, x1 - x0, 1, PETE_ARM.light);
    this.rect(x0, y + 1, x1 - x0, 2, PETE_ARM.shade);
    const hx = handAtLeft ? x0 - 5 : x1;
    this.rect(hx - 1, y - 4, 7, 8, PETE_ARM.outline);
    this.rect(hx, y - 3, 5, 6, PETE_ARM.skin);
    this.rect(hx + 1, y - 3, 3, 2, PETE_ARM.skinLight);
    this.rect(hx, y + 2, 5, 1, PETE_ARM.skinShade);
    const tip = handAtLeft ? hx : hx + 4;
    this.rect(tip, y - 1, 1, 1, PETE_ARM.skinShade);
    this.rect(tip, y + 1, 1, 1, PETE_ARM.skinShade);
  }

  // While you aim, only the bartender's hand shows, pulling straight back.
  // It never points the way you're aiming and has no meter.
  /**
   * Pool-style guideline: a line to the first thing the drink would touch, a ghost glass
   * where it touches, and a short line for what happens next (the bounce off a rail, or
   * the direction a hit object would go). It never depends on power, so it shows the
   * direction but not how far the drink will slide or where it stops.
   */
  private drawGuide(sim: Sim, aim: Aim) {
    const L = sim.level, c = L.counter;
    let x = L.start.x, y = L.start.y;
    const dx = Math.cos(aim.angle), dy = Math.sin(aim.angle);
    // Mass is relative to a drink (1). The bowl is about 2.4 drinks, so a straight hit sends your drink back.
    const obstacles: { x: number; y: number; r: number; fixed: boolean; mass: number }[] = [];
    for (const gl of sim.glasses) if (gl.body) obstacles.push({ x: gl.body.position.x, y: gl.body.position.y, r: GLASS_R, fixed: false, mass: 1 });
    for (const p of sim.props) if (p.body) obstacles.push({ x: p.body.position.x, y: p.body.position.y, r: PROP_R[p.kind], fixed: false, mass: p.body.mass / DRINK_MASS });
    for (const p of L.posts) obstacles.push({ x: p.x, y: p.y, r: p.r, fixed: true, mass: Infinity });
    if (sim.bowl) obstacles.push({ x: sim.bowl.position.x, y: sim.bowl.position.y, r: BOWL_R, fixed: false, mass: sim.bowl.mass / DRINK_MASS });
    const railAt = (side: Side, pos: number) => L.rails.find((r) => r.side === side && pos >= r.from && pos <= r.to);
    let end: { kind: 'object'; ox: number; oy: number; fixed: boolean; mass: number } | { kind: 'rail'; type: 'brass' | 'timber'; side: Side } | { kind: 'off' } | { kind: 'far' } = { kind: 'far' };
    for (let travelled = 0; travelled < 760; travelled += 1.5) {
      x += dx * 1.5; y += dy * 1.5;
      const hit = obstacles.find((o) => Math.hypot(o.x - x, o.y - y) < o.r + POUR_R);
      if (hit) { end = { kind: 'object', ox: hit.x, oy: hit.y, fixed: hit.fixed, mass: hit.mass }; break; }
      let side: Side | null = null;
      if (x < c.x + POUR_R) side = 'left';
      else if (x > c.x + c.w - POUR_R) side = 'right';
      else if (y < c.y + POUR_R) side = 'top';
      else if (y > c.y + c.h - POUR_R) side = 'bottom';
      if (side) {
        const rail = railAt(side, side === 'left' || side === 'right' ? y : x);
        if (rail) { end = { kind: 'rail', type: rail.type, side }; break; }
        if (x < c.x || x > c.x + c.w || y < c.y || y > c.y + c.h) { end = { kind: 'off' }; break; }
      }
    }
    const phase = Math.floor(this.frame / 3);
    const sx = P(L.start.x), sy = P(L.start.y), ex = P(x), ey = P(y);
    this.line(sx, sy, ex, ey, PAL.cream, 3, phase);
    const ghost = (gx: number, gy: number, col: string) => this.ring(gx, gy, 5, col, 1);
    if (end.kind === 'rail') {
      ghost(ex, ey, PAL.cream);
      if (end.type === 'brass') {
        // Mirror bounce, a short stub only.
        const bx = end.side === 'left' || end.side === 'right' ? -dx : dx;
        const by = end.side === 'top' || end.side === 'bottom' ? -dy : dy;
        this.line(ex, ey, ex + bx * 16, ey + by * 16, PAL.brassLight, 2, phase);
      } else {
        this.rect(ex - 2, ey - 2, 1, 1, '#cdb894'); this.rect(ex + 2, ey + 2, 1, 1, '#cdb894');
      }
    } else if (end.kind === 'object') {
      ghost(ex, ey, PAL.cream);
      // The line of centres at contact: what you hit is pushed along it.
      const nx = end.ox - x, ny = end.oy - y;
      const nl = Math.hypot(nx, ny) || 1;
      const ux = nx / nl, uy = ny / nl;
      if (end.fixed) {
        // A tap or tip jar doesn't move: your drink bounces off it like off a rail.
        const dot = dx * ux + dy * uy;
        const rx = dx - 2 * dot * ux, ry = dy - 2 * dot * uy;
        this.line(ex, ey, ex + rx * 16, ey + ry * 16, PAL.brassLight, 2, phase);
      } else {
        // Like pool: the thing you hit heads along the line of centres (amber). Your drink
        // keeps its sideways part and loses (or, off something heavier, reverses) the part
        // along that line (cream). Same bounce (0.9) as the physics.
        const ox = P(end.ox), oy = P(end.oy);
        this.line(ox, oy, ox + ux * 18, oy + uy * 18, PAL.amber, 2, phase);
        const vn = dx * ux + dy * uy;
        const tx = dx - vn * ux, ty = dy - vn * uy;
        const after = (1 - 0.9 * end.mass) / (1 + end.mass);
        const ax = tx + ux * vn * after, ay = ty + uy * vn * after;
        const sp = Math.hypot(ax, ay);
        if (sp > 0.12) this.line(ex, ey, ex + (ax / sp) * (8 + 16 * sp), ey + (ay / sp) * (8 + 16 * sp), PAL.cream, 2, phase);
      }
    } else if (end.kind === 'off') {
      this.line(ex - 2, ey - 2, ex + 2, ey + 2, PAL.danger); this.line(ex + 2, ey - 2, ex - 2, ey + 2, PAL.danger);
    }
  }

  /**
   * The bartender's forearm, lined up with the shot: the hand sits right behind the
   * glass and the sleeve runs straight back from it, pulling further the harder you drag.
   */
  private drawHand(sim: Sim, aim: Aim | null) {
    const s0 = sim.level.start;
    const angle = aim ? aim.angle : -Math.PI / 2;
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const pull = aim ? 1 + aim.power * 7 : 0;
    const hx = P(s0.x) - ux * (6 + pull), hy = P(s0.y) - uy * (6 + pull);
    const along = (t: number) => ({ x: hx - ux * t, y: hy - uy * t });
    // Outline pass, then sleeve, then the cuff and the hand on top.
    for (let t = 3; t <= 44; t += 1) { const p = along(t); this.disc(p.x, p.y, 4, PAL.ink); }
    for (let t = 3; t <= 44; t += 1) { const p = along(t); this.disc(p.x, p.y, 3, '#e8dcc6'); }
    for (let t = 3; t <= 44; t += 1) { const p = along(t); this.dot(p.x + uy * 2, p.y - ux * 2, '#b7a98f'); }
    for (let t = 4; t <= 6; t += 1) { const p = along(t); this.disc(p.x, p.y, 3, '#9a7a5a'); }
    this.disc(hx, hy, 4, PAL.ink);
    this.disc(hx, hy, 3, PAL.skin);
    this.dot(hx + ux * 2, hy + uy * 2, '#b98a68');
    this.dot(hx + ux * 2 + uy, hy + uy * 2 - ux, '#b98a68');
  }

  /** During the slow-motion start, a small arrow rides ahead of the drink. */
  private drawDirection(sim: Sim, alpha: number) {
    const pour = sim.pour;
    if (!pour?.body || alpha <= 0) return;
    const v = pour.body.velocity;
    const sp = Math.hypot(v.x, v.y);
    if (sp < 0.05) return;
    const ux = v.x / sp, uy = v.y / sp;
    const x = P(pour.body.position.x), y = P(pour.body.position.y);
    const col = `rgba(243,230,204,${alpha.toFixed(2)})`;
    for (let i = 7; i <= 14; i += 2) this.dot(x + ux * i, y + uy * i, col);
    const tx = x + ux * 16, ty = y + uy * 16;
    for (const side of [-1, 1]) {
      const bx = tx - ux * 3 + -uy * side * 2, by = ty - uy * 3 + ux * side * 2;
      this.line(bx, by, tx, ty, col);
    }
  }

  // Cartoon CRASH: a star burst, chunky shards that bounce once, a puff of dust,
  // then broken glass and a puddle stay on the floor.
  private drawCrashes() {
    for (const c of this.crashes) {
      c.t++;
      const x = P(c.x), y = P(c.y), t = c.t;
      if (t <= 6) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2, len = (i % 2 ? 6 : 10) * Math.min(1, t / 3);
          for (let r = 0; r < len; r++) this.dot(x + Math.cos(a) * r, y + Math.sin(a) * r, i % 2 ? PAL.amber : '#ffffff');
        }
        this.disc(x, y, 3, '#ffffff');
      } else if (t <= 26) {
        const u = (t - 6) / 20;
        const bounce = u < 0.6 ? 0 : Math.sin(((u - 0.6) / 0.4) * Math.PI) * -2;
        SHARD_DIRS.forEach(([dx, dy], i) => {
          const d = 4 + 10 * Math.min(1, u * 1.6);
          const sx = x + dx * d, sy = y + dy * d + bounce * (i % 2 ? 1 : 0.5);
          this.rect(sx, sy, 3, 2, PAL.glass);
          this.dot(sx, sy + 2, '#9fc0c8');
        });
        if (u > 0.35) for (const [dx, dy] of [[-2, 0], [2, -1], [0, 2], [-1, -3]]) this.disc(x + dx * (1 + u), y + dy * (1 + u), u < 0.8 ? 2 : 1, u < 0.8 ? '#c9b49a' : '#8a7a68');
      } else {
        this.debris.push({ x: c.x, y: c.y, drink: c.drink, seed: this.debris.length });
        c.t = -1;
      }
    }
    this.crashes = this.crashes.filter((c) => c.t >= 0);
  }

  private drawDebris() {
    for (const d of this.debris) {
      const x = P(d.x), y = P(d.y);
      this.ellipse(x, y + 1, 5, 3, '#4e2c14');
      this.dot(x - 2, y, '#7a4a20');
      SHARD_DIRS.forEach(([dx, dy], i) => {
        const sx = x + dx * 14, sy = y + dy * 14;
        this.rect(sx, sy, 2, 1, i % 2 ? '#9fc0c8' : PAL.glass);
      });
    }
  }

  private drawParticles() {
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const p of this.particles) {
      p.life++; p.x += p.vx; p.y += p.vy; p.vx *= 0.9; p.vy *= 0.9;
      if (p.life > p.max * 0.7 && p.life % 2) continue; // flicker out
      this.dot(P(p.x), P(p.y), p.color);
    }
  }

  // ---------- full-resolution text on top ----------
  /** `units` is roughly the letter height in art pixels. */
  private font(units: number, family = FONT) {
    const px = Math.max(9, Math.round(units * this.k * 2.1));
    this.ctx.font = `700 ${px}px ${family}`;
    return px;
  }

  private text(s: string, bx: number, by: number, color: string, align: CanvasTextAlign = 'center', units = 4) {
    const ctx = this.ctx;
    this.font(units);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PAL.ink;
    ctx.fillText(s, bx * this.k + Math.max(1, this.k / 2), by * this.k + Math.max(1, this.k / 2));
    ctx.fillStyle = color;
    ctx.fillText(s, bx * this.k, by * this.k);
  }

  private drawOverlay(sim: Sim, replay: false | 'REPLAY' | 'SOLUTION') {
    const L = sim.level;
    const k = this.k;
    const ctx = this.ctx;
    for (const n of L.npcs) {
      if (this.leaving.has(n.id)) continue; // walked out: no name label
      const { x, y } = this.npcPos(n.side, n.y);
      this.text(NPCS[n.id].name, x, y + 19, n.id === 'pete' ? '#cdb894' : PAL.cream, 'center', 2.6);
      if (n.id === 'pete' && this.moods.get('pete') !== 'happy' && !this.peteDreams(L)) {
        const bob = Math.floor(this.frame / 20) % 2;
        this.text('z', x + 12, y - 15 - bob, PAL.cream, 'center', 2.2);
        this.text('Z', x + 16, y - 20 - bob, PAL.cream, 'center', 2.8);
      }
    }
    const next = sim.nextOrder;
    sim.orders.forEach((o, i) => {
      if (o.served || o.cancelled) return;
      const npc = L.npcs.find((n) => n.id === o.owner);
      const left = npc ? npc.side === 'left' : o.x < 195;
      const x = P(o.x) + (left ? P(o.r) + 4 : -P(o.r) - 4);
      this.text(String(i + 1), x, P(o.y), i === next ? PAL.amber : PAL.cream, 'center', 3.4);
    });
    // "NO RAIL" warnings beside long open stretches.
    for (const side of ['left', 'right'] as const) {
      const segs = L.rails.filter((r) => r.side === side).sort((a, b) => a.from - b.from);
      let cur = L.counter.y;
      const gaps: [number, number][] = [];
      for (const s of segs) { if (s.from > cur) gaps.push([cur, s.from]); cur = Math.max(cur, s.to); }
      if (cur < L.counter.y + L.counter.h) gaps.push([cur, L.counter.y + L.counter.h]);
      for (const [a, b] of gaps) {
        if (b - a < 50) continue;
        const bx = side === 'left' ? P(L.counter.x) - 4 : P(L.counter.x + L.counter.w) + 4;
        ctx.save();
        ctx.translate(bx * k, P((a + b) / 2) * k);
        ctx.rotate(side === 'left' ? -Math.PI / 2 : Math.PI / 2);
        this.font(2.2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = PAL.danger;
        ctx.fillText('NO RAIL', 0, 0);
        ctx.restore();
      }
    }
    // Floating tip and crash text.
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const f of this.floats) {
      f.life--; f.y -= 0.35;
      if (f.life < 12 && f.life % 2) continue;
      this.text(f.text, P(f.x), P(f.y), f.color, 'center', 3);
    }
    // Speech bubbles: pixel boxes with a hard border and a stepped tail.
    this.bubbles = this.bubbles.filter((b) => b.life > 0);
    for (const b of this.bubbles) {
      b.life--;
      const n = L.npcs.find((x) => x.id === b.npc);
      if (!n) continue;
      const small = b.text === 'zzz';
      const px = this.font(small ? 3 : 3.6, BUBBLE_FONT);
      const maxW = this.canvas.width * 0.62;
      const lines: string[] = [];
      for (const word of b.text.split(' ')) {
        const cur = lines[lines.length - 1];
        if (cur && ctx.measureText(`${cur} ${word}`).width <= maxW) lines[lines.length - 1] = `${cur} ${word}`;
        else lines.push(word);
      }
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const pad = 3 * k;
      const lineH = px * 1.05;
      const w = Math.ceil((tw + pad * 2) / k) * k, h = Math.ceil((lineH * lines.length + pad * 1.2) / k) * k;
      const { x, y } = this.npcPos(n.side, n.y);
      let bx = x * k - w / 2;
      bx = Math.max(k, Math.min(this.canvas.width - w - k, Math.round(bx / k) * k));
      const by = (y - 19) * k - h;
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(bx - k, by - k, w + 2 * k, h + 2 * k);
      ctx.fillStyle = small ? '#d9ccb2' : PAL.cream;
      ctx.fillRect(bx, by, w, h);
      ctx.fillRect(x * k - k, by + h, 3 * k, k);
      ctx.fillRect(x * k, by + h + k, k, k);
      ctx.fillStyle = PAL.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, li) => ctx.fillText(l, bx + w / 2, by + h / 2 + (li - (lines.length - 1) / 2) * lineH + k / 3));
    }
    if (replay) {
      this.font(2.6);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(4 * k, 4 * k, 42 * k, 10 * k);
      ctx.fillStyle = PAL.amber;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(replay, 25 * k, 9 * k);
    }
  }
}
