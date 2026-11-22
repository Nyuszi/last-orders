import { LEVELS, NPCS, type Level, type NpcId } from './levels';
import { Renderer, W, H, type Aim } from './render';
import { Sim, STEP_MS, pointInPoly, type Shot, type SimEvent, type Status } from './sim';
import { SOLUTIONS } from './solutions';
import { fetchNight, requestedDate } from './daily';
import { detectReddit, journey, onReddit, reportResult, shareResult } from './reddit';// Every portrait in assets/portraits is picked up automatically, keyed by its file name
// ("<customer>-<mood>.webp"), so new art only has to be dropped into the folder.
const PORTRAIT_FILES = import.meta.glob<string>('./assets/portraits/*.webp', { eager: true, query: '?inline', import: 'default' });

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const board = $('board');
const renderer = new Renderer(canvas);

const DRINK_COLOR: Record<string, string> = { beer: '#e8b24a', rye: '#b5652c', whiskey: '#c77b2e', sarsaparilla: '#5a2c17', water: '#bfe0ea' };

let levelIndex = 0;
/** Tonight's daily night first (once loaded), then the handmade practice nights. */
const NIGHTS: Level[] = [...LEVELS];
let dailyLoaded = false;
let reportedTry = '';
/** Tonight's night (not a practice night). Only these count towards stats and streaks. */
const isDaily = () => dailyLoaded && levelIndex === 0;
let sim: Sim;
let mode: 'play' | 'replay' = 'play';
let replayShots: Shot[] = [];
let recorded: Shot[] = [];
let aim: Aim | null = null;
let drag: { x0: number; y0: number } | null = null;
let acc = 0;
let last = performance.now();
let lastStatus: Status = 'aiming';
let resultTimer = 0;
let shownHint = '';
let hintTimer = 0;
/** The night's intro text is up and the next tap on the bar only closes it. */
let introOpen = false;
let replayKind: 'REPLAY' | 'SOLUTION' = 'REPLAY';
// After release a small direction arrow rides ahead of the drink for about half a second.
// (There used to be a slow-motion start here. Handing back to full speed made the drink look
// like it sped up mid-slide, so the clock now always runs at real speed: a pour starts fast
// and only ever slows down.)
const SLOW_STEPS = 30;
const EASE_STEPS = 14;
let slowSteps = 0;

// ---------------- Today's progress: tries and help, per night ----------------
// Kept per day (UTC, like the daily map), so yesterday's help or tries never follow you.
// On this device only for now; on Reddit it moves to the server, keyed by player and day.
interface NightProgress { tries: number; help: boolean; solvedOnTry: number }
const PROGRESS_KEY = 'last-orders-progress';
const today = new Date().toISOString().slice(0, 10);
let progress: { date: string; nights: Record<string, NightProgress> } = { date: today, nights: {} };
try {
  localStorage.removeItem('last-orders-help-used'); // the old, never-expiring help flag
  const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null');
  if (saved && saved.date === today && saved.nights) progress = saved;
} catch { /* storage unavailable: start fresh */ }
function night(id: string): NightProgress {
  return (progress.nights[id] ??= { tries: 0, help: false, solvedOnTry: 0 });
}
function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* storage unavailable */ }
}
const helpUsed = { has: (id: string) => night(id).help };
function markHelpUsed(id: string) { night(id).help = true; saveProgress(); }
/** A try starts when the first drink of a fresh night is poured (switching nights doesn't count). */
function countTryIfFirstPour() {
  if (mode !== 'play' || sim.shots.length !== 1) return;
  night(sim.level.id).tries++;
  if (isDaily()) journey.start();
  saveProgress();
  updateHud();
}
/** The try you're on: the last one counted, or the next one if you haven't poured yet. */
function currentTry(id: string) {
  const n = night(id);
  return sim && sim.level.id === id && mode === 'play' && sim.shots.length === 0 ? n.tries + 1 : Math.max(1, n.tries);
}
/** Bragging line for a finished night; a plain count for one you didn't finish. */
function triesText(t: number, won = true) { return won ? (t === 1 ? 'First try' : `Took ${t} tries`) : `Try ${t}`; }

// ---------------- Power meter (side bar) ----------------
const CELLS = 12;
const meter = $('power-meter');
for (let i = 0; i < CELLS; i++) {
  const cell = document.createElement('i');
  // Green for a gentle slide, amber in the middle, red when you really shove it.
  const t = i / (CELLS - 1);
  cell.style.setProperty('--cell', t < 0.45 ? '#6dbb4a' : t < 0.8 ? '#f2b53a' : '#e8664a');
  meter.appendChild(cell);
}
function showPower(power: number, resting: boolean) {
  const on = Math.round(power * CELLS);
  Array.from(meter.children).forEach((c, i) => c.classList.toggle('on', i < on));
  meter.classList.toggle('resting', resting);
  $('power-val').textContent = `${Math.round(power * 100)}%`;
  $('power').setAttribute('aria-valuenow', String(Math.round(power * 100)));
}

// ---------------- Spin pad: tap the glass where you want to hit it ----------------
const pad = $<HTMLCanvasElement>('spinpad');
const pg = pad.getContext('2d')!;
const PAD = 28, PC = 14, PR = 11;
let spin = 0;
let spinY = 0;

function drawPad() {
  const next = sim ? sim.nextOrder : -1;
  const drink = next >= 0 ? sim.orders[next].drink : 'beer';
  pg.fillStyle = '#1a0f0a';
  pg.fillRect(0, 0, PAD, PAD);
  const disc = (r: number, col: string) => {
    pg.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy));
      pg.fillRect(PC - hw, PC + dy, 2 * hw + 1, 1);
    }
  };
  disc(PR + 1, '#5a3a24');
  disc(PR, '#a9bcbc');
  disc(PR - 1, DRINK_COLOR[drink]);
  if (drink === 'beer') disc(PR - 5, '#f6ebd3');
  pg.fillStyle = '#ffffff';
  pg.fillRect(PC - 7, PC - 7, 2, 1);
  // Centre tick marks.
  pg.fillStyle = '#1a0f0a88';
  pg.fillRect(PC, PC - PR + 1, 1, 2);
  pg.fillRect(PC, PC + PR - 2, 1, 2);
  // The hit point.
  const mx = Math.round(PC + spin * (PR - 2)), my = Math.round(PC + spinY * (PR - 2));
  pg.fillStyle = '#1a0f0a';
  pg.fillRect(mx - 2, my - 2, 5, 5);
  pg.fillStyle = '#f2b53a';
  pg.fillRect(mx - 1, my - 1, 3, 3);
  // Curve arrows show which way the drink will bend.
  if (spin !== 0) {
    const dir = Math.sign(spin);
    pg.fillStyle = '#f3e6cc';
    const ax = dir > 0 ? PAD - 3 : 2;
    for (let i = 0; i < 3; i++) pg.fillRect(ax - dir * i, PC - i, 1, 1 + 2 * i);
  }
  const amount = Math.round(Math.abs(spin) * 100);
  $('spin-val').textContent = spin === 0 ? 'NONE' : `${spin < 0 ? 'LEFT' : 'RIGHT'} ${amount}%`;
  $('spin-short').textContent = spin === 0 ? 'off' : `${spin < 0 ? 'L' : 'R'} ${amount}%`;
}

function setSpinFromPointer(e: PointerEvent) {
  const r = pad.getBoundingClientRect();
  let dx = ((e.clientX - r.left) / r.width) * PAD - PC;
  let dy = ((e.clientY - r.top) / r.height) * PAD - PC;
  const len = Math.hypot(dx, dy);
  const max = PR - 2;
  if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
  let s = dx / max;
  if (Math.abs(s) < 0.12) s = 0; // a small dead zone makes "no spin" easy to hit
  spin = Math.round(s * 20) / 20;
  spinY = dy / max;
  drawPad();
}
pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); setSpinFromPointer(e); });
pad.addEventListener('pointermove', (e) => { if (e.buttons) setSpinFromPointer(e); });
pad.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    spin = Math.max(-1, Math.min(1, Math.round((spin + (e.key === 'ArrowLeft' ? -0.1 : 0.1)) * 20) / 20));
    drawPad();
    e.preventDefault();
  }
});
pad.tabIndex = 0;
$('spin-reset').onclick = () => { spin = 0; spinY = 0; drawPad(); };

// Spin is an advanced control, hidden behind a small button until opened (remembered per browser).
function setSpinOpen(open: boolean) {
  $('app').classList.toggle('spin-open', open);
  $('spin-toggle').setAttribute('aria-expanded', String(open));
  try { localStorage.setItem('lo-spin-open', open ? '1' : '0'); } catch { /* private mode */ }
}
$('spin-toggle').onclick = () => setSpinOpen(!$('app').classList.contains('spin-open'));
try { setSpinOpen(localStorage.getItem('lo-spin-open') === '1'); } catch { setSpinOpen(false); }

// ---------------- Levels and HUD ----------------
function loadLevel(i: number, asReplay = false, kind: 'REPLAY' | 'SOLUTION' = 'REPLAY') {
  if (replayKind === 'SOLUTION' && mode === 'replay') { spin = savedSpin; drawPad(); }
  if (asReplay && kind === 'SOLUTION') savedSpin = spin;
  replayKind = kind;
  lesson = null;
  if (document.getElementById('cutin')) { clearTimeout(cutinTimer); cutinEl.hidden = true; }
  peteSlapShown = false; lastServed = null;
  aimShown = false; charging = null; charge = 0;
  if (document.getElementById('power-grip')) placeGrip(0);
  if (document.getElementById('coach')) hideCoach();
  if (meter.children.length) showPower(0, true);
  levelIndex = i;
  const level = NIGHTS[i];
  sim = new Sim(level);
  renderer.reset();
  mode = asReplay ? 'replay' : 'play';
  if (!asReplay) recorded = [];
  lastStatus = 'aiming';
  aim = null;
  drag = null;
  clearTimeout(resultTimer);
  $('result').hidden = true;
  $('sub').textContent = `NIGHT ${level.night} · ${level.title.toUpperCase()}`;
  $('blurb').textContent = level.blurb;
  $('par').textContent = `${level.pours} POURS`;
  shownHint = '';
  const narrow = matchMedia('(max-width: 520px)').matches;
  if (!asReplay) {
    $('hint').classList.add('fade');
    showHowto(introText(level), currentTry(level.id) <= 1);
  } else {
    closeIntro();
    setHint(kind === 'SOLUTION' ? "Here's one way to serve everyone. Watch the power and spin." : 'Replaying your night: same numbers per pour, same result.');
  }
  void narrow;
  renderNights();
  updateHud();
}

function setHint(text: string) {
  if (text === shownHint) return;
  shownHint = text;
  const el = $('hint');
  el.textContent = text;
  el.classList.remove('fade');
  clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => el.classList.add('fade'), 7000);
}

// ---------------- How to play overlay: shown when a night loads ----------------
// It sits over the bar and takes the first tap, so nothing is poured before you've read it.
// Underneath, the real game plays a demo pour on a throwaway copy of tonight's bar: the hand
// pulls back, the real aim guideline appears, the drink slides into one of the bar's items.
// Labels say what each item does. The demo only plays on the first try of a night.
let wantDemo = false;
type DemoShot = { angle: number; power: number };
let demo: null | {
  sim: Sim; acc: number; shots: DemoShot[]; i: number; from: number;
  phaseAt: number; fired: boolean; settledAt: number;
} = null;
// Each demo pour: press and pull a little, sweep the aim to the target (so you see aiming),
// pull to full strength, hold, let go. Then wait for the drink to stop before the next pour.
const DEMO_START_MS = 500, DEMO_PRESS_MS = 450, DEMO_SWEEP_MS = 1100, DEMO_PULL_MS = 700, DEMO_HOLD_MS = 550;
const DEMO_BETWEEN_MS = 500, DEMO_AFTER_MS = 1400, DEMO_MAX_ROLL_MS = 5000;
/** Only physical effects show during the demo: no speech bubbles, tips or bonus pop-ups. */
const DEMO_EVENTS = new Set<SimEvent['t']>(['tip', 'smash', 'thud', 'contact', 'bank', 'slam', 'settled']);

function showHowto(text: string, withDemo: boolean) {
  $('howto-text').textContent = text;
  $('howto').hidden = false;
  $('help-btn').setAttribute('aria-pressed', 'true');
  introOpen = true;
  wantDemo = withDemo;
  demo = null;
  $('ghost').hidden = true;
  requestAnimationFrame(placeTags);
}
function closeIntro() {
  const wasDemo = !!demo;
  introOpen = false;
  wantDemo = false;
  demo = null;
  $('howto').hidden = true;
  $('help-btn').setAttribute('aria-pressed', 'false');
  $('ghost').hidden = true;
  // Clear the demo's splashes and bubbles; the real bar is untouched.
  if (wasDemo) renderer.reset();
}
$('howto').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); closeIntro(); });

/** The intro line: on phones the scene line too, since the orders box hides it there. */
function introText(level: Level) {
  return matchMedia('(max-width: 520px)').matches ? `${level.blurb} ${level.hint}` : level.hint;
}
// "?": bring the how-to overlay and its demo back at any point between pours.
$('help-btn').onclick = () => {
  if (introOpen) { closeIntro(); return; } // the "?" toggles the overlay
  if (mode !== 'play' || sim.status !== 'aiming' || drag) return;
  charging = null; charge = 0;
  // The demo pour only before the first pour: closing it resets the renderer, which would
  // wipe this night's broken glass and walk-outs.
  showHowto(introText(sim.level), sim.shots.length === 0);
};

const toScreen = (x: number, y: number) => {
  const c = canvas.getBoundingClientRect(), b = board.getBoundingClientRect();
  return { x: c.left - b.left + (x / W) * c.width, y: c.top - b.top + (y / H) * c.height };
};

/** What the demo aims at: an item it can bump, so you see that hitting things is allowed. */
type DemoTarget = { x: number; y: number; label: string };
function demoTarget(level: Level): DemoTarget {
  // A bonus item (peanuts, cards) if there is one, else an old drink; the nearest of those, so
  // the demo is short and the hit is easy to see.
  const s = level.start;
  const near = (a: DemoTarget, b: DemoTarget) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y);
  const bonus: DemoTarget[] = [
    ...(level.bowl ? [{ x: level.bowl.x, y: level.bowl.y, label: 'Peanuts: hit them for a bonus' }] : []),
    ...level.props.filter((p) => p.kind === 'cards').map((p) => ({ x: p.x, y: p.y, label: 'Cards: hit them for a bonus' })),
  ].sort(near);
  const old = level.glasses.map((g) => ({ x: g.x, y: g.y, label: 'Old drink: knock it in = trick shot' })).sort(near);
  const items = bonus.length ? bonus : old;
  // No item at all: a bank shot off the left rail, about a third of the way up.
  return items[0] ?? { x: level.counter.x, y: s.y - level.counter.h * 0.35, label: 'Gold rail: bounces' };
}
function aimAt(level: Level, t: { x: number; y: number }): DemoShot {
  const s = level.start;
  const dx = t.x - s.x, dy = t.y - s.y;
  return { angle: Math.atan2(dy, dx), power: Math.max(0.35, Math.min(0.8, 0.2 + Math.hypot(dx, dy) / 600)) };
}
/** Two pours: into the bonus item, then the aim swings to the other side, at the first circle. */
function demoShots(level: Level): DemoShot[] {
  const s = level.start, item = demoTarget(level);
  const itemSide = Math.sign(item.x - s.x) || -1;
  const other = level.orders.find((o) => Math.sign(o.x - s.x) === -itemSide)
    ?? { x: s.x - itemSide * level.counter.w * 0.3, y: item.y };
  return [aimAt(level, item), aimAt(level, other)];
}

function runDemo(now: number, dt: number) {
  const level = sim.level;
  if (!demo) {
    renderer.reset();
    demo = { sim: new Sim(level), acc: 0, shots: demoShots(level), i: 0, from: -Math.PI / 2, phaseAt: now + DEMO_START_MS, fired: false, settledAt: 0 };
  }
  const d = demo;
  let a: Aim | null = null;
  const shot = d.shots[d.i];
  if (shot && !d.fired) {
    const t = now - d.phaseAt;
    if (t >= 0) {
      // Press and pull a little at the old aim, sweep to the new aim, pull to full, hold.
      const ease = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 2;
      const k1 = ease(t / DEMO_PRESS_MS);
      const k2 = ease((t - DEMO_PRESS_MS) / DEMO_SWEEP_MS);
      const k3 = ease((t - DEMO_PRESS_MS - DEMO_SWEEP_MS) / DEMO_PULL_MS);
      const turn = Math.atan2(Math.sin(shot.angle - d.from), Math.cos(shot.angle - d.from));
      const angle = d.from + turn * k2;
      const power = 0.25 * shot.power * k1 + 0.75 * shot.power * k3;
      a = { angle, power };
      placeHand(angle, power / 0.8);
      if (t > DEMO_PRESS_MS + DEMO_SWEEP_MS + DEMO_PULL_MS + DEMO_HOLD_MS) {
        d.sim.fire(shot.angle, shot.power, 0);
        d.fired = true;
        d.settledAt = 0;
        d.phaseAt = now;
        $('ghost').hidden = true;
      }
    }
  }
  // Run the copy's physics at the game's fixed step. Only physical effects reach the screen.
  d.acc += dt;
  for (let n = 0; d.acc >= STEP_MS && n < 6; n++, d.acc -= STEP_MS) {
    d.sim.step();
    for (const ev of d.sim.events) if (DEMO_EVENTS.has(ev.t)) renderer.handle(ev, d.sim);
    d.sim.events = [];
  }
  if (d.fired && !d.settledAt && ((d.sim.status !== 'rolling' && now - d.phaseAt > 500) || now - d.phaseAt > DEMO_MAX_ROLL_MS)) d.settledAt = now;
  if (d.fired && d.settledAt) {
    const last = d.i >= d.shots.length - 1;
    if (now - d.settledAt > (last ? DEMO_AFTER_MS : DEMO_BETWEEN_MS)) {
      if (last || d.sim.status !== 'aiming') demo = null; // loop from the start
      else { d.from = shot.angle; d.i++; d.fired = false; d.phaseAt = now; }
    }
  }
  renderer.draw(d.sim, a, false, 0);
}

/** The hand presses on the upper bar and pulls back, opposite to the aim, as far as the pull. */
function placeHand(angle: number, pull: number) {
  const s = sim.level.start;
  const press = { x: s.x, y: s.y - 230 };
  const reach = 110 * pull; // world units on screen; the real pull for this power is longer
  const p = toScreen(press.x - Math.cos(angle) * reach, press.y - Math.sin(angle) * reach);
  const g = $('ghost');
  g.style.left = `${p.x}px`;
  g.style.top = `${p.y}px`;
  g.hidden = false;
}

/** Labels on the things on tonight's bar, so it's clear what you may hit and what not. */
function placeTags() {
  const box = $('howto-tags');
  box.innerHTML = '';
  if ($('howto').hidden) return;
  const L = sim.level, c = L.counter;
  const tags: { x: number; y: number; text: string; tone: '' | 'danger' | 'good'; ring?: boolean }[] = [];
  const o = L.orders[0];
  if (o) tags.push({ x: o.x, y: o.y, text: 'Stop the drink in its circle', tone: 'good', ring: true });
  const hat = L.props.find((p) => p.kind === 'hat');
  if (hat) tags.push({ x: hat.x, y: hat.y, text: "Sheriff's hat: don't touch", tone: 'danger', ring: true });
  // One "OK to hit" item: the one the demo pour aims at.
  const target = demoTarget(L);
  tags.push({ x: target.x, y: target.y, text: target.label, tone: '', ring: !target.label.startsWith('Gold') });
  // The first gap in a side rail: drinks fall off there.
  for (const side of ['left', 'right'] as const) {
    const segs = L.rails.filter((r) => r.side === side).sort((a, b) => a.from - b.from);
    let y = c.y, gap: number | null = null;
    for (const r of segs) { if (r.from - y > 30) { gap = (y + r.from) / 2; break; } y = Math.max(y, r.to); }
    if (gap === null && c.y + c.h - y > 30) gap = (y + c.y + c.h) / 2;
    if (gap !== null) { tags.push({ x: side === 'left' ? c.x : c.x + c.w, y: gap, text: 'No rail: it falls off', tone: 'danger' }); break; }
  }
  // Then the night's special hazard, if any, and one rail type: at most five labels in all.
  if (L.arm) tags.push({ x: c.x + c.w / 2, y: L.arm.y, text: "Pete's arm: time it", tone: 'danger' });
  else if (L.posts[0]) tags.push({ x: L.posts[0].x, y: L.posts[0].y, text: L.posts[0].kind === 'tap' ? 'Beer tap: spills a drink' : 'Tip jar: spills a drink', tone: 'danger', ring: true });
  const timber = L.rails.find((r) => (r.side === 'left' || r.side === 'right') && r.type === 'timber');
  const brass = L.rails.find((r) => (r.side === 'left' || r.side === 'right') && r.type === 'brass');
  // A rail label goes at the point along its rail furthest from every other label.
  const railTag = (r: (typeof L.rails)[number], text: string) => {
    const x = r.side === 'left' ? c.x : c.x + c.w;
    let best = (r.from + r.to) / 2, bestGap = -1;
    for (let k = 1; k < 12; k++) {
      const y = r.from + ((r.to - r.from) * k) / 12;
      const gap = Math.min(...tags.map((t) => Math.hypot((t.x - x) * 0.5, t.y - y)), 1e9);
      if (gap > bestGap) { bestGap = gap; best = y; }
    }
    tags.push({ x, y: best, text, tone: '' });
  };
  if (timber) railTag(timber, 'Dark rail: stops it dead');
  else if (brass && !target.label.startsWith('Gold')) railTag(brass, 'Gold rail: bounces');

  const bw = box.clientWidth;
  const placed: { x: number; y: number }[] = [];
  for (const t of tags.slice(0, 5)) {
    const p = toScreen(t.x, t.y);
    if (t.ring) {
      const r = document.createElement('span');
      r.className = `tag-ring ${t.tone}`;
      r.style.left = `${p.x}px`; r.style.top = `${p.y}px`;
      box.appendChild(r);
    }
    const el = document.createElement('span');
    el.className = `tag ${t.tone}`;
    el.textContent = t.text;
    box.appendChild(el);
    // Keep labels inside the bar area and off each other: nudge up if one is already close.
    let y = p.y - (t.ring ? 12 : 0);
    while (placed.some((q) => Math.abs(q.y - y) < 20 && Math.abs(q.x - p.x) < 120)) y -= 20;
    const w = el.offsetWidth;
    const x = Math.max(w / 2 + 2, Math.min(bw - w / 2 - 2, p.x));
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    el.style.setProperty('--arrow', `${Math.max(8, Math.min(w - 8, w / 2 + (p.x - x)))}px`);
    placed.push({ x, y });
  }
}

function renderNights() {
  const nav = $('nights');
  nav.innerHTML = '';
  NIGHTS.forEach((l, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const daily = dailyLoaded && i === 0;
    b.textContent = daily ? 'TODAY' : String(dailyLoaded ? i : l.night);
    if (daily) b.classList.add('today');
    b.setAttribute('aria-label', daily ? `Tonight: night ${l.night}, ${l.title}` : `Practice night ${l.night}: ${l.title}`);
    if (i === levelIndex) b.setAttribute('aria-current', 'true');
    b.onclick = () => loadLevel(i);
    nav.appendChild(b);
  });
}

function pixelGlass(fill: string) {
  // 9x11 pixel glass, drawn as rects so it stays crisp.
  return `<svg width="18" height="22" viewBox="0 0 9 11" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="0" y="0" width="9" height="1" fill="#1a0f0a"/><rect x="0" y="0" width="1" height="11" fill="#1a0f0a"/><rect x="8" y="0" width="1" height="11" fill="#1a0f0a"/><rect x="0" y="10" width="9" height="1" fill="#1a0f0a"/>
    <rect x="1" y="1" width="7" height="9" fill="#a9bcbc"/><rect x="2" y="3" width="5" height="6" fill="${fill}"/><rect x="2" y="2" width="1" height="1" fill="#ffffff"/></svg>`;
}

function updateHud() {
  const level: Level = sim.level;
  const chips = $('chips');
  chips.innerHTML = '';
  const add = (text: string, cls: string) => {
    const li = document.createElement('li');
    li.textContent = text;
    li.className = cls;
    chips.appendChild(li);
  };
  // The order to pour now, big; every other order as a small numbered step (full text on hover).
  const next = sim.nextOrder;
  const cur = next >= 0 ? sim.orders[next] : null;
  if (cur) add(`Now: ${NPCS[cur.owner].short} · ${cur.drink}`, 'chip-target chip-now');
  sim.orders.forEach((o, i) => {
    if (i === next) return;
    const full = `${i + 1}. ${NPCS[o.owner].short} · ${o.drink}`;
    add(o.cancelled ? `${i + 1} ✕` : o.served ? `${i + 1} ✓` : `${i + 1}`, `${o.served || o.cancelled ? 'chip-done' : 'chip-order'} chip-step`);
    (chips.lastElementChild as HTMLElement).title = o.cancelled ? `${full} (left)` : o.served ? `${full} (served)` : full;
  });
  if (level.props.some((p) => p.kind === 'hat') && !sim.left.has('sheriff')) add(sim.hatWarned ? 'Hat: last warning!' : 'Hat: hands off', 'chip-danger');
  if (level.bonus) add('Bonus: peanuts', `chip-bonus${sim.badges.has('Peanuts for Pete') ? ' got' : ''}`);
  if (level.props.some((p) => p.kind === 'cards')) add('Bonus: cards', `chip-bonus${sim.badges.has('Cheat exposed') ? ' got' : ''}`);

  const pours = $('bottles');
  pours.innerHTML = '';
  const nextDrink = next >= 0 ? sim.orders[next].drink : 'water';
  for (let i = 0; i < level.pours; i++) {
    const result = sim.pourResults[i];
    const fill = result ? (result === 'served' || result === 'perfect' || result === 'trick' ? '#d9a441' : '#7a3a2a') : i === sim.shots.length ? DRINK_COLOR[nextDrink] : '#3a2a20';
    pours.insertAdjacentHTML('beforeend', pixelGlass(fill));
  }
  pours.setAttribute('aria-label', `${sim.poursLeft} of ${level.pours} pours left`);
  $('tips').textContent = `${sim.tips}c`;
  $('help-tag').hidden = !helpUsed.has(level.id);
  $('try-tag').textContent = `TRY ${currentTry(level.id)}`;
  drawPad();
}

// Size the bar from the whole stage (minus the pull meter), not from the board, so the
// board can shrink to the bar's width and keep the meter right next to it.
const stage = $('stage');
// Must match the landscape media query in style.css. There the bar is sized from the full
// height first and the side column (min LANDSCAPE_SIDE px) gets whatever width is left.
const landscape = matchMedia('(min-width: 600px) and (min-aspect-ratio: 1/1)');
const LANDSCAPE_SIDE = 220;
function fit() {
  const s = stage.getBoundingClientRect(), cs = getComputedStyle(stage);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const meter = $('power').getBoundingClientRect().width + parseFloat(cs.columnGap || '0');
  const width = landscape.matches ? document.documentElement.clientWidth - LANDSCAPE_SIDE - 12 : s.width;
  // Desktop: size from the window height, not the stage (the bar itself would hold the stage open
  // when the window shrinks).
  const height = landscape.matches ? document.documentElement.clientHeight - padY : s.height - padY - 6;
  renderer.resize(Math.max(100, width - padX - meter - 6), Math.max(100, height));
  // Keep the item labels on their items when the bar is resized (the hand follows by itself).
  const h = document.getElementById('howto');
  if (h && !h.hidden) requestAnimationFrame(() => placeTags());
}
new ResizeObserver(fit).observe(stage);
addEventListener('resize', fit);

// ---------------- What's this? Hover (mouse) or tap (touch) to explain things ----------------
type Tip = { title: string; text: string; tone: 'danger' | 'order' | 'bonus' | 'info' };
const QUIRK: Record<string, string> = {
  sheriff: 'His hat is on the bar. Touch it or splash it and he walks out.',
  dutch: 'Loud, thirsty, and fond of his beer.',
  twofist: 'Drinks rye with both hands.',
  lavinia: 'Card shark. Knock her deck to expose her cheating, for a bonus.',
  pete: 'Asleep on his elbow. When it slips, his arm slaps across the bar.',
};
function npcOrders(id: string) {
  const list = sim.orders.map((o, i) => ({ o, i })).filter(({ o }) => o.owner === id);
  if (!list.length) return 'Not ordering tonight.';
  if (sim.left.has(id as never)) return 'Walked out.';
  return list.map(({ o, i }) => `Order ${i + 1}: ${o.drink}${o.served ? ' (served)' : i === sim.nextOrder ? ' (pour this now)' : ''}`).join('. ') + '.';
}
function describeAt(wx: number, wy: number): Tip | null {
  const L = sim.level;
  const near = (x: number, y: number, r: number) => Math.hypot(wx - x, wy - y) <= r;
  for (const p of sim.props) {
    if (!p.body || !near(p.body.position.x, p.body.position.y, 18)) continue;
    if (p.kind === 'hat') return { tone: 'danger', title: "SHERIFF'S HAT · AVOID", text: 'Touch it or splash it and the sheriff walks out, taking his order and his tip with him.' };
    return { tone: 'bonus', title: "LAVINIA'S DECK · BONUS", text: 'Knock it with a drink to expose her hidden ace.' };
  }
  if (sim.bowl && near(sim.bowl.position.x, sim.bowl.position.y, 17)) {
    return { tone: 'bonus', title: 'PEANUT BOWL · BONUS', text: L.bonus ? "Push it into Pete's dotted spot for a bonus. It's heavy: a straight hit bounces your drink back." : 'Heavy. A straight hit bounces your drink back.' };
  }
  for (const g of sim.glasses) {
    if (!g.body || !near(g.body.position.x, g.body.position.y, 13)) continue;
    const who = g.owner ? `${NPCS[g.owner].short}'s ${g.drink}` : g.drink;
    if (g.role === 'served') return { tone: 'info', title: `${who.toUpperCase()} · SERVED`, text: 'Knock it out of its circle and they\'ll want another.' };
    if (g.role === 'stray') return { tone: 'order', title: `${who.toUpperCase()} · MISSED`, text: 'Still counts if you knock it into its circle (a trick shot, +25c). Drinks bounce off each other.' };
    return { tone: 'info', title: who.toUpperCase(), text: 'A drink already on the bar. Drinks bounce off each other.' };
  }
  for (const p of L.posts) {
    if (!near(p.x, p.y, p.r + 6)) continue;
    return { tone: 'info', title: p.kind === 'tap' ? 'BEER TAP' : 'TIP JAR', text: "Doesn't move. Drinks bounce off it, but slam into it too hard and yours spills." };
  }
  for (const n of L.npcs) {
    const x = n.side === 'left' ? 82 : 310;
    if (Math.abs(wx - x) < 32 && Math.abs(wy - n.y) < 36) return { tone: n.id === 'sheriff' ? 'danger' : 'info', title: NPCS[n.id].name, text: `${npcOrders(n.id)} ${QUIRK[n.id]}` };
  }
  for (let i = 0; i < sim.orders.length; i++) {
    const o = sim.orders[i];
    if (!near(o.x, o.y, o.r + 3)) continue;
    return { tone: 'order', title: `ORDER ${i + 1} · ${NPCS[o.owner].short.toUpperCase()}'S ${o.drink.toUpperCase()}`, text: o.served ? 'Served.' : 'Stop the drink inside this circle. Closer to the middle, bigger tip.' };
  }
  if (L.bonus && near(L.bonus.x, L.bonus.y, L.bonus.r + 3)) return { tone: 'bonus', title: "PETE'S PEANUT SPOT", text: 'Slide the peanut bowl in here for a bonus.' };
  for (let i = sim.puddles.length - 1; i >= 0; i--) {
    const pd = sim.puddles[i];
    if (!pointInPoly(wx, wy, pd.poly)) continue;
    const sticky = pd.drink === 'sarsaparilla';
    return { tone: 'info', title: `${pd.drink.toUpperCase()} PUDDLE`, text: sticky ? 'Sticky: drinks slow down fast in it.' : 'Slippery: drinks slide further across it.' };
  }
  const c = L.counter;
  const side = wx < c.x + 10 ? 'left' : wx > c.x + c.w - 10 ? 'right' : null;
  if (side && wy > c.y && wy < c.y + c.h) {
    const rail = L.rails.find((r) => r.side === side && wy >= r.from && wy <= r.to);
    if (!rail) return { tone: 'danger', title: 'NO RAIL', text: 'Drinks slide straight off here and smash.' };
    return rail.type === 'brass'
      ? { tone: 'info', title: 'BRASS RAIL', text: 'Bouncy. Bank shots off it earn +15c. Spin changes the bounce.' }
      : { tone: 'info', title: 'TIMBER RAIL', text: 'Dead wood. Drinks stop with a thud.' };
  }
  return null;
}
const tipEl = $('tip');
let tipTimer = 0;
function showTip(e: PointerEvent, linger: boolean) {
  const p = toWorld(e);
  const t = describeAt(p.x, p.y);
  if (!t) { tipEl.hidden = true; return; }
  tipEl.className = `tip tip-${t.tone}`;
  tipEl.innerHTML = `<strong>${t.title}</strong><span>${t.text}</span>`;
  tipEl.hidden = false;
  const b = board.getBoundingClientRect();
  const x = e.clientX - b.left, y = e.clientY - b.top;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = `${Math.max(4, Math.min(b.width - w - 4, x - w / 2))}px`;
  tipEl.style.top = `${y - h - 14 < 4 ? y + 18 : y - h - 14}px`;
  clearTimeout(tipTimer);
  if (linger) tipTimer = window.setTimeout(() => { tipEl.hidden = true; }, 3200);
}
// Hovering an item with the mouse only shows a small "?"; clicking it (without aiming) explains it.
const qmark = document.createElement('span');
qmark.className = 'qmark';
qmark.textContent = '?';
qmark.hidden = true;
board.appendChild(qmark);
function hoverMark(e: PointerEvent) {
  const p = toWorld(e);
  const t = describeAt(p.x, p.y);
  if (!t || !tipEl.hidden) { qmark.hidden = true; return; }
  const b = board.getBoundingClientRect();
  qmark.style.left = `${e.clientX - b.left + 12}px`;
  qmark.style.top = `${e.clientY - b.top - 14}px`;
  qmark.hidden = false;
}
canvas.addEventListener('pointermove', (e) => { if (!drag && e.pointerType === 'mouse') hoverMark(e); else qmark.hidden = true; });
canvas.addEventListener('pointerdown', () => { qmark.hidden = true; });
// Touch fires pointerleave right after lifting the finger, so only a mouse leaving hides these.
canvas.addEventListener('pointerleave', (e) => { if (!drag && e.pointerType === 'mouse') { tipEl.hidden = true; qmark.hidden = true; } });

// ---------------- Reaction cut-ins: a big portrait slides in for the big moments ----------------
// Art is keyed "<customer>-<mood>", with "<customer>-any" as that customer's fallback for
// any mood. A moment without art simply shows no cut-in (the small speech bubble still appears).
const PORTRAITS: Record<string, string> = Object.fromEntries(
  Object.entries(PORTRAIT_FILES).map(([file, src]) => [file.split('/').pop()!.replace('.webp', ''), src]),
);
/** Background colour of the cut-in band per mood. */
const CUTIN_MOOD: Record<string, string> = { angry: 'mood-angry', happy: 'mood-happy', surprised: 'mood-surprised', sly: 'mood-sly' };
let peteSlapShown = false;
let lastServed: NpcId | null = null;
const DRY_LINES: Record<string, string> = {
  sheriff: "Outta bottles? I'll be at the next saloon.",
  dutch: 'That was the LAST bottle?! I came here thirsty!',
  twofist: 'Both hands empty. Not a good look, barkeep.',
  lavinia: 'All night and not a single drink. Charming.',
  pete: '*SLAP* ...where\'s my drink?!',
};
const SLY_LINES: Record<string, string> = {
  sheriff: "Not bad, kid. Not bad at all.",
  dutch: 'Same again tomorrow, eh? Ha!',
  twofist: 'Steady hands. I could use you at the tables.',
  lavinia: "Darling, you'd clean up at poker.",
  pete: '...zzz... same again... zzz',
};
const cutinEl = $('cutin');
let cutinTimer = 0;
function cutIn(npc: string, mood: string, line: string) {
  const src = PORTRAITS[`${npc}-${mood}`] ?? PORTRAITS[`${npc}-any`];
  if (!src) return;
  cutinEl.classList.remove(...Object.values(CUTIN_MOOD));
  cutinEl.classList.add(CUTIN_MOOD[mood] ?? 'mood-angry');
  ($('cutin-img') as HTMLImageElement).src = src;
  $('cutin-name').textContent = NPCS[npc as keyof typeof NPCS]?.name ?? '';
  $('cutin-line').textContent = line;
  cutinEl.hidden = false;
  cutinEl.classList.remove('in', 'out');
  void cutinEl.offsetWidth; // restart the slide-in
  cutinEl.classList.add('in');
  clearTimeout(cutinTimer);
  cutinTimer = window.setTimeout(hideCutIn, 2200);
}
function hideCutIn() {
  if (cutinEl.hidden) return;
  cutinEl.classList.add('out');
  clearTimeout(cutinTimer);
  cutinTimer = window.setTimeout(() => { cutinEl.hidden = true; }, 260);
}
cutinEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); hideCutIn(); });

// ---------------- Input: drag back anywhere, release to slide ----------------
function toWorld(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

// Tuned after playtesting on phones ("too sensitive"): a longer pull for full power, a dead
// zone at the start that also works as "cancel" (slide back and let go), and a smoothed
// direction so a wobbling finger doesn't swing the aim.
const FULL_PULL = 240; // world units of drag for full power (was 150)
const DEAD_ZONE = 24; // pull shorter than this: no aim yet, and letting go here cancels
const AIM_SMOOTHING = 0.45; // share of each finger move the aim follows (1 = no smoothing)
let smoothAngle: number | null = null;

canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || sim.status !== 'aiming' || sim.poursLeft <= 0) return;
  // The first tap of a night only closes the intro, so nobody pours blind under the text.
  if (introOpen) { closeIntro(); return; }
  canvas.setPointerCapture(e.pointerId);
  $('hint').classList.add('fade');
  tipEl.hidden = true;
  const p = toWorld(e);
  drag = { x0: p.x, y0: p.y };
  aim = null;
  smoothAngle = null;
  showPower(0, false);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = toWorld(e);
  const dx = drag.x0 - p.x, dy = drag.y0 - p.y;
  const len = Math.hypot(dx, dy);
  if (len < DEAD_ZONE) {
    if (aim) pullHint('Let go here to cancel');
    aim = null; showPower(0, false); return;
  }
  const target = Math.atan2(dy, dx);
  if (smoothAngle === null) smoothAngle = target;
  else {
    const d = Math.atan2(Math.sin(target - smoothAngle), Math.cos(target - smoothAngle));
    smoothAngle += d * AIM_SMOOTHING;
  }
  aim = { angle: smoothAngle, power: Math.min(1, (len - DEAD_ZONE) / (FULL_PULL - DEAD_ZONE)) };
  aimAngle = clampAngle(aim.angle);
  showPower(aim.power, false);
  pullHint('Let go to pour · slide back to cancel');
});

/** A short line at the top of the bar while you pull (not the intro, which is closed by now). */
function pullHint(text: string) {
  const el = $('hint');
  if (el.textContent !== text) el.textContent = text;
  el.classList.remove('fade');
  shownHint = text;
  clearTimeout(hintTimer);
}

let lastAimed = false;
function endDrag() {
  lastAimed = !!aim;
  if (drag) $('hint').classList.add('fade');
  if (drag && aim && aim.power > 0.02 && sim.status === 'aiming') {
    if (sim.fire(aim.angle, aim.power, spin)) {
      recorded = [...sim.shots];
      slowSteps = SLOW_STEPS;
      countTryIfFirstPour();
      showPower(aim.power, true);
      updateHud();
    }
  } else {
    showPower(0, true);
  }
  drag = null;
  aim = null;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointerup', (e) => { if (!lastAimed) showTip(e, true); });
canvas.addEventListener('pointercancel', () => { drag = null; aim = null; showPower(0, true); $('hint').classList.add('fade'); });

// ---------------- Pool-style controls: Q/E to aim, pull to shoot ----------------
// Like 8 Ball Pool: turn the aim with Q and E (hold Shift for fine aim), then either hold
// Space to draw the hand back (release to pour) or drag the pull handle beside the bar down.
let aimAngle = -Math.PI / 2;
let aimShown = false; // the guideline stays up once you've aimed with keys or the handle
let turning = 0; // -1 (Q), 0, 1 (E)
let fine = false;
let charge = 0;
let charging: null | { by: 'space'; started: number } | { by: 'handle'; y0: number; height: number } = null;
const TURN_SPEED = Math.PI / 3; // radians per second (60°/s); Shift: a quarter of that
const CHARGE_MS = 1300; // Space: empty to full, then back down, so you time the release

function clampAngle(a: number) {
  // Keep aims pointing up the bar (between nearly flat left and nearly flat right).
  const deg = (a * 180) / Math.PI;
  return (Math.max(-178, Math.min(-2, deg > 90 ? deg - 360 : deg)) * Math.PI) / 180;
}
function canShoot() { return mode === 'play' && sim.status === 'aiming' && sim.poursLeft > 0 && !drag; }
function shootCharged() {
  const by = charging?.by;
  const power = charge;
  charging = null;
  charge = 0;
  const min = by === 'space' ? 0.1 : 0.04; // a quick Space tap (e.g. mashing to restart) doesn't pour
  if (power < min || !canShoot()) { showPower(0, true); placeGrip(0); return; }
  if (sim.fire(aimAngle, power, spin)) {
    recorded = [...sim.shots];
    slowSteps = SLOW_STEPS;
    countTryIfFirstPour();
    showPower(power, true);
    placeGrip(0);
    updateHud();
  }
}

// The pull handle sits at the top of the power bar and slides down as you pull.
const grip = $('power-grip');
function placeGrip(p: number) {
  const h = meter.getBoundingClientRect().height;
  grip.style.transform = `translateY(${Math.round(p * (h - 6))}px)`;
}
$('power').addEventListener('pointerdown', (e) => {
  if (!canShoot()) return;
  if (introOpen) closeIntro();
  $('power').setPointerCapture(e.pointerId);
  aimShown = true;
  charging = { by: 'handle', y0: e.clientY, height: meter.getBoundingClientRect().height };
  charge = 0;
});
$('power').addEventListener('pointermove', (e) => {
  if (charging?.by !== 'handle') return;
  charge = Math.max(0, Math.min(1, (e.clientY - charging.y0) / charging.height));
});
$('power').addEventListener('pointerup', () => { if (charging?.by === 'handle') shootCharged(); });
$('power').addEventListener('pointercancel', () => { if (charging?.by === 'handle') { charging = null; charge = 0; placeGrip(0); showPower(0, true); } });

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|BUTTON)$/.test(e.target.tagName) && e.code === 'Space') return;
  const k = e.key.toLowerCase();
  if ((k === 'q' || k === 'e' || e.code === 'Space') && mode === 'play') { if (introOpen) closeIntro(); }
  if (k === 'q' || k === 'e') { turning = k === 'q' ? -1 : 1; aimShown = true; fine = e.shiftKey; e.preventDefault(); }
  if (e.key === 'Shift') fine = true;
  if (e.code === 'Space') {
    e.preventDefault();
    // Didn't finish the night? Space starts it again straight away, even before the card shows.
    if (!e.repeat && mode === 'play' && (sim.status === 'failed' || sim.status === 'out')) { loadLevel(levelIndex); return; }
    if (!e.repeat && canShoot() && !charging) { aimShown = true; charging = { by: 'space', started: performance.now() }; }
  }
  if (e.key === 'Escape' && charging) { charging = null; charge = 0; placeGrip(0); showPower(0, true); }
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if ((k === 'q' && turning === -1) || (k === 'e' && turning === 1)) turning = 0;
  if (e.key === 'Shift') fine = false;
  if (e.code === 'Space' && charging?.by === 'space') { e.preventDefault(); shootCharged(); }
});

/** Called every frame: turn the aim, grow the Space charge, and show the guideline. */
function updatePoolControls(dt: number, now: number) {
  if (turning) aimAngle = clampAngle(aimAngle + turning * TURN_SPEED * (fine ? 0.25 : 1) * (dt / 1000));
  if (charging?.by === 'space') {
    const t = ((now - charging.started) % (CHARGE_MS * 2)) / CHARGE_MS;
    charge = t <= 1 ? t : 2 - t; // up to full, then back down
  }
  if (charging) { showPower(charge, false); placeGrip(charge); }
  if (!drag && !lesson) aim = (aimShown || charging) && canShoot() ? { angle: aimAngle, power: charge } : aim && drag ? aim : null;
}

/** When the last pour stopped just outside its circle, says which way it was off. */
function nearMiss(): string | null {
  const g = [...sim.glasses].reverse().find((x) => x.id.startsWith('pour-'));
  const o = g && g.order >= 0 ? sim.orders[g.order] : null;
  if (!g?.body || !o || o.served) return null;
  const { x, y } = g.body.position;
  const d = Math.hypot(x - o.x, y - o.y);
  if (d <= o.r || d > o.r + 14) return null;
  // Compare with the line from the start to the circle: along it is short/long, across it is wide.
  const s = sim.level.start;
  const len = Math.hypot(o.x - s.x, o.y - s.y) || 1;
  const ux = (o.x - s.x) / len, uy = (o.y - s.y) / len;
  const along = (x - o.x) * ux + (y - o.y) * uy;
  const across = (x - o.x) * -uy + (y - o.y) * ux;
  const by = d - o.r < 5 ? 'a hair' : 'a glass-width';
  if (Math.abs(along) >= Math.abs(across)) return along < 0 ? `Just short, by ${by}.` : `Just long, by ${by}.`;
  return across > 0 ? `Just wide to the right.` : `Just wide to the left.`;
}

// ---------------- Result card ----------------
// A miss used to be ▫️, which looks like a broken character in Reddit comments.
const RESULT_ICON: Record<string, string> = { perfect: '⭐', served: '🍺', trick: '🎱', miss: '❌', spill: '💦', smash: '💥' };

function shareText(): string {
  const L = sim.level;
  const icons = sim.pourResults.map((r) => RESULT_ICON[r] ?? '❌').join('');
  const par = L.orders.length;
  const lines = [`LAST ORDERS · Night ${L.night} · ${L.title}`, `${icons}  Served ${sim.servedCount}/${L.orders.length} · ${sim.shots.length} pours (par ${par}) · Tips ${sim.tips}¢`];
  // (A walk-out shows up through the "Sheriff walked out" badge on the next line.)
  if (sim.badges.size) lines.push([...sim.badges].join(' · '));
  const tryLine = [triesText(currentTry(L.id), sim.status === 'won')];
  if (helpUsed.has(L.id)) tryLine.push('Used help');
  lines.push(tryLine.join(' · '));
  return lines.join('\n');
}

function showResult() {
  const L = sim.level;
  $('r-night').textContent = `NIGHT ${L.night} · ${L.title.toUpperCase()}`;
  const used = sim.shots.length;
  const watchingSolution = mode === 'replay' && replayKind === 'SOLUTION';
  if (watchingSolution) {
    $('r-title').textContent = "That's one way";
    $('r-sub').textContent = 'Your turn. This night is now marked "Used help".';
  } else if (sim.status === 'won' && sim.left.size) {
    $('r-title').textContent = 'Everyone else served';
    $('r-sub').textContent = `The sheriff walked out after you touched his hat, and took his tip with him. ${sim.tips}c in tips.`;
  } else if (sim.status === 'won') {
    $('r-title').textContent = 'Everyone served';
    $('r-sub').textContent = `${used} of ${L.pours} pours used · ${sim.tips}c in tips. The Copper Spur is happy tonight.`;
  } else if (sim.status === 'failed') {
    $('r-title').textContent = 'Sheriff not amused';
    $('r-sub').textContent = sim.failReason;
  } else {
    const left = L.orders.length - sim.servedCount;
    $('r-title').textContent = 'Closing time';
    $('r-sub').textContent = `Out of pours with ${left} ${left === 1 ? 'customer' : 'customers'} still waiting.`;
  }
  const badges = $('r-badges');
  badges.innerHTML = '';
  for (const b of sim.badges) {
    const li = document.createElement('li');
    li.textContent = b;
    badges.appendChild(li);
  }
  if (!watchingSolution) {
    const t = currentTry(L.id);
    const li = document.createElement('li');
    li.textContent = triesText(t, sim.status === 'won');
    li.className = t === 1 && sim.status === 'won' ? 'first-try' : 'tries';
    badges.prepend(li);
    if (sim.status === 'won' && !night(L.id).solvedOnTry) { night(L.id).solvedOnTry = t; saveProgress(); }
  }
  if (helpUsed.has(L.id)) {
    const li = document.createElement('li');
    li.textContent = 'Used help';
    li.className = 'used-help';
    badges.appendChild(li);
  }
  // Stuck? Offer the proven solution, but only after a real attempt that didn't finish.
  $('r-help').hidden = !(mode === 'play' && sim.status !== 'won' && SOLUTIONS[L.id]);
  $('r-share').hidden = watchingSolution;
  $('r-copy').hidden = watchingSolution;
  $('r-replay').hidden = watchingSolution;
  $('r-share').textContent = shareText();
  $('r-next').hidden = levelIndex >= NIGHTS.length - 1;
  $('r-copy').textContent = 'Copy result';
  const failed = sim.status !== 'won' && !watchingSolution;
  const counts = mode === 'play' && isDaily();
  $('r-post').hidden = !(counts && onReddit());
  $('r-post').textContent = 'Share in comments';
  $('r-stats').hidden = true;
  const tryKey = `${L.id}:${currentTry(L.id)}`;
  if (counts && reportedTry !== tryKey) {
    reportedTry = tryKey;
    journey.end(sim.status === 'won', sim.tips);
    // Still recorded on the server (players, clears, streaks); just not shown on the card.
    void reportResult({ tries: currentTry(L.id), won: sim.status === 'won', pours: sim.shots.length, tips: sim.tips, help: helpUsed.has(L.id) });
  }
  $('result').querySelector('.card')!.classList.toggle('failed', failed);
  $('r-retry').classList.toggle('primary', failed);
  $('r-copy').classList.toggle('primary', !failed);
  $('result').hidden = false;
  if (failed) $('r-retry').focus({ preventScroll: true });
}

$('r-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(shareText());
    $('r-copy').textContent = 'Copied';
  } catch {
    $('r-copy').textContent = 'Copy failed';
  }
};
$('r-post').onclick = async () => {
  const btn = $<HTMLButtonElement>('r-post');
  btn.disabled = true;
  btn.textContent = 'Sharing…';
  const ok = await shareResult(shareText());
  if (ok) journey.share();
  btn.textContent = ok ? 'Shared ✓' : 'Couldn’t share, try again';
  btn.disabled = ok;
};
$('r-retry').onclick = () => loadLevel(levelIndex);
$('r-help').onclick = () => {
  const id = NIGHTS[levelIndex].id;
  markHelpUsed(id);
  replayShots = SOLUTIONS[id];
  loadLevel(levelIndex, true, 'SOLUTION');
};
$('r-next').onclick = () => loadLevel(Math.min(NIGHTS.length - 1, levelIndex + 1));
$('r-replay').onclick = () => {
  replayShots = [...recorded];
  loadLevel(levelIndex, true, 'REPLAY');
};

// ---------------- Main loop: fixed 60 Hz simulation steps ----------------
function onStatusChange(prev: Status) {
  if (prev === 'rolling' && sim.status === 'aiming' && mode === 'play') {
    const lastResult = sim.pourResults[sim.pourResults.length - 1];
    const next = sim.orders[sim.nextOrder];
    const who = next ? `${NPCS[next.owner].short}'s ${next.drink}` : '';
    const close = lastResult === 'miss' ? nearMiss() : null;
    if (close) setHint(`So close! ${close} That glass stays on the bar now. Try ${who} again.`);
    else if (lastResult === 'miss') setHint(`Missed the spot. That glass stays on the bar now. Try ${who} again.`);
    else if (lastResult === 'spill' || lastResult === 'smash') setHint(`Spilled. Watch out for the puddle. Pour ${who} again.`);
    else setHint(`Next up: ${who}.`);
  }
  if (sim.status === 'won' || sim.status === 'failed' || sim.status === 'out') {
    if (sim.status === 'failed') renderer.setMood('sheriff', 'angry');
    if (mode === 'replay') setHint('Replay finished.');
    const winner = sim.status === 'won' && mode === 'play' && lastServed && !sim.left.has(lastServed) ? lastServed : null;
    if (winner) cutIn(winner, 'sly', SLY_LINES[winner] ?? 'Not bad, kid.');
    // Out of bottles with someone still waiting: the customer you couldn't serve gets the last word.
    const waiting = sim.status === 'out' && mode === 'play' ? sim.orders.find(o => !o.served && !o.cancelled && !sim.left.has(o.owner)) : undefined;
    if (waiting) cutIn(waiting.owner, 'angry', DRY_LINES[waiting.owner] ?? 'Still waitin\' on my drink!');
    resultTimer = window.setTimeout(showResult, winner || waiting ? 2000 : 1200);
  }
}

// ---------------- "Show me how": a step-by-step lesson ----------------
// Before each pour the lesson stops, draws the guideline, sets the spin glass, pulls the
// hand back to the right strength while a card spells out aim, pull and spin, and then
// pours in slow motion. The simulation is paused during the explanation, so the pour
// still happens on exactly the same tick as the proven solution.
const LESSON_PULL_MS = 1400;
const LESSON_HOLD_MS = 1100;
let lesson: { shot: number; started: number } | null = null;
let savedSpin = 0;

function strengthWord(p: number) {
  return p < 0.3 ? 'gentle' : p < 0.55 ? 'medium' : p < 0.8 ? 'firm' : 'full';
}
function showCoach(i: number, total: number, shot: Shot) {
  const o = sim.orders[sim.nextOrder] ?? sim.orders[i];
  const spinText = shot.spin === 0 ? 'None' : `${shot.spin < 0 ? 'Left' : 'Right'} ${Math.round(Math.abs(shot.spin) * 100)}%`;
  $('coach').innerHTML = `<p class="coach-step">POUR ${i + 1} OF ${total} · ${NPCS[o.owner].short.toUpperCase()}'S ${o.drink.toUpperCase()}</p>
    <dl class="coach-rows">
      <div><dt>AIM</dt><dd>Follow the dotted line</dd></div>
      <div><dt>PULL</dt><dd>${Math.round(shot.power * 100)}% (${strengthWord(shot.power)})</dd></div>
      <div><dt>SPIN</dt><dd>${spinText}</dd></div>
    </dl>${sim.level.arm ? '<p class="coach-tip">Wait for Pete\'s arm to pull back before you let go.</p>' : ''}`;
  $('coach').hidden = false;
  $('hint').classList.add('fade');
}
function hideCoach() { $('coach').hidden = true; }

function frame(now: number) {
  const dt = Math.min(100, now - last);
  last = now;
  updatePoolControls(dt, now);
  // While the how-to overlay is up on a first try, the bar shows the demo pour instead.
  if (introOpen && wantDemo && mode === 'play') {
    runDemo(now, dt);
    requestAnimationFrame(frame);
    return;
  }
  // During a lesson's explanation, hold the bar still and animate the hand instead.
  if (lesson) {
    const shot = replayShots[lesson.shot];
    const t = now - lesson.started;
    aim = { angle: shot.angle, power: shot.power * Math.min(1, t / LESSON_PULL_MS) };
    showPower(aim.power, false);
    if (t >= LESSON_PULL_MS + LESSON_HOLD_MS) {
      aim = null;
      hideCoach();
      lesson = null;
      sim.fire(shot.angle, shot.power, shot.spin);
      slowSteps = SLOW_STEPS;
      updateHud();
    }
    renderer.draw(sim, aim, 'SOLUTION', 0);
    requestAnimationFrame(frame);
    return;
  }
  acc += dt;
  let steps = 0;
  const fast = mode === 'replay' && sim.status === 'aiming' && !lesson;
  while ((acc >= STEP_MS || fast) && steps < (fast ? 40 : 6)) {
    if (mode === 'replay' && sim.status === 'aiming') {
      const next = replayShots[sim.shots.length];
      if (next && sim.tick >= next.tick) {
        if (replayKind === 'SOLUTION') {
          // Start the explanation for this pour; the bar waits until it's done.
          lesson = { shot: sim.shots.length, started: now };
          spin = next.spin;
          drawPad();
          showCoach(sim.shots.length, replayShots.length, next);
          break;
        }
        sim.fire(next.angle, next.power, next.spin);
        slowSteps = SLOW_STEPS;
        updateHud();
      } else if (!next) break;
    }
    sim.step();
    if (slowSteps > 0 && sim.status === 'rolling') slowSteps--; else if (sim.status !== 'rolling') slowSteps = 0;
    if (!fast) acc -= STEP_MS;
    steps++;
    let hud = false;
    for (const ev of sim.events) {
      renderer.handle(ev, sim);
      // Big moments get a portrait cut-in; everything else stays in the small speech bubbles.
      if (ev.t === 'leave' && ev.npc === 'sheriff') cutIn('sheriff', 'angry', "MY HAT! That's it, I'm leaving!");
      if (ev.t === 'warn' && ev.npc === 'sheriff') { cutIn('sheriff', 'angry', 'Watch the hat, partner. Next time I walk.'); hud = true; }
      if (ev.t === 'served' && ev.trick) cutIn(ev.owner, 'surprised', "Well, I'll be! A trick shot!");
      else if (ev.t === 'served' && ev.quality === 3) cutIn(ev.owner, 'happy', NPCS[ev.owner].lines.perfect);
      if (ev.t === 'bonus' && ev.kind === 'cards') cutIn('lavinia', 'surprised', 'That ace was there when I sat down!');
      if (ev.t === 'bonus' && ev.kind === 'peanuts') cutIn('pete', 'happy', '...peanuts? Bless you, kid.');
      if (ev.t === 'slam' && !peteSlapShown && mode === 'play') { peteSlapShown = true; cutIn('pete', 'angry', '*SLAP* ...wha? Who moved the bar?'); }
      // A customer's own drink knocked over (not the sheriff walking out, which has its own cut-in).
      if ((ev.t === 'tip' || ev.t === 'smash') && ev.owner && !sim.left.has(ev.owner) && mode === 'play') cutIn(ev.owner, 'angry', ev.t === 'tip' ? 'Hey! That was MY drink!' : 'On the floor?! That was MY drink!');
      if (ev.t === 'served') { lastServed = ev.owner; if (mode === 'play' && isDaily()) journey.served(sim.servedCount, sim.level.orders.length); }
      if (ev.t === 'tip' || ev.t === 'bonus' || ev.t === 'smash' || ev.t === 'served') hud = true;
    }
    sim.events = [];
    if (hud) updateHud();
    if (sim.status !== lastStatus) {
      const prev = lastStatus;
      lastStatus = sim.status;
      updateHud();
      onStatusChange(prev);
    }
  }
  if (fast) acc = 0;
  renderer.draw(sim, aim, mode === 'replay' ? replayKind : false, slowSteps > 0 ? Math.min(1, slowSteps / EASE_STEPS) : 0);
  requestAnimationFrame(frame);
}

// Read-only handle for automated checks (frame-by-frame motion tests).
(window as unknown as { __lastOrders: object }).__lastOrders = {
  sim: () => sim,
  demo: () => demo && { shot: demo.i, fired: demo.fired, status: demo.sim.status, glasses: demo.sim.glasses?.map((g) => g.body ? [Math.round(g.body.position.x), Math.round(g.body.position.y), g.role] : null) },
};

// Start on a practice night straight away, then switch to tonight's night as soon as it arrives.
loadLevel(0);
fit();
requestAnimationFrame(frame);
void detectReddit();
fetchNight(requestedDate()).then((n) => {
  NIGHTS.unshift(n.level);
  if (n.solution) SOLUTIONS[n.level.id] = n.solution;
  dailyLoaded = true;
  if (sim.shots.length === 0 && mode === 'play') loadLevel(0); else { levelIndex++; renderNights(); }
});
