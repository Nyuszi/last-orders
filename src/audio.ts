// Sound for Last Orders: 8-bit sound effects synthesized in code (pulse, triangle and noise
// voices, like an NES), plus a CC0 chiptune music loop (see src/assets/music/CREDITS.md).
// Players can only switch the music and the effects on or off; the sounds themselves are fixed.

import MUSIC_URL from './assets/music/lassolady_4.ogg?url';

const MUSIC_VOL = 0.05;
const SFX_VOL = 0.1;

type Wave = 'p12' | 'p25' | 'p50' | 'tri' | 'noise';
/** One synth voice. Times are in seconds from the sound's start; frequencies in Hz. */
interface V {
  w: Wave; f: number; to?: number; t?: number; d: number; v?: number; a?: number;
  /** Vibrato: [depth in Hz, rate in Hz]. */
  vib?: [number, number];
  /** Noise only: filter type (default lowpass), with f→to as the cutoff sweep. */
  filt?: BiquadFilterType; q?: number;
  /** Hold at full level for this fraction of d before the decay. */
  hold?: number;
}

/** MIDI note to Hz (60 = middle C). */
const m = (n: number) => 440 * 2 ** ((n - 69) / 12);
/** A run of notes, one every `step` seconds. null is a rest. */
function seq(notes: (number | null)[], step: number, w: Wave, o: Partial<V> = {}, t0 = 0): V[] {
  const out: V[] = [];
  notes.forEach((n, i) => { if (n !== null) out.push({ w, f: m(n), d: step * 0.95, v: 0.5, hold: 0.5, ...o, t: t0 + i * step }); });
  return out;
}

/** Every sound in the game. p (0–1) is the strength, for sounds that change with it. */
const SFX = {
  // Menus and buttons
  click: () => [{ w: 'tri', f: 900, to: 600, d: 0.05, v: 0.7 }],
  open: () => [{ w: 'tri', f: 400, to: 900, d: 0.12, v: 0.7 }],
  close: () => [{ w: 'tri', f: 900, to: 400, d: 0.12, v: 0.7 }],
  night: () => seq([72, 79, 84, 79], 0.035, 'tri', { v: 0.7 }),
  spin: () => [{ w: 'tri', f: 800, d: 0.08, v: 0.6, vib: [80, 50] }],
  spinReset: () => seq([79, 72], 0.04, 'tri', { v: 0.6 }),
  // Aiming and the beer tap
  aim: () => [{ w: 'p50', f: 3000, d: 0.006, v: 0.1 }],
  tapGrab: () => [{ w: 'tri', f: 220, to: 110, d: 0.06, v: 0.8 }],
  tapPull: (p) => [{ w: 'tri', f: 200 + 600 * p, d: 0.03, v: 0.6 }],
  tapCancel: () => seq([67, 60], 0.06, 'tri', { v: 0.6 }),
  pour: (p) => [{ w: 'p25', f: 150, to: 600 + 600 * p, d: 0.15, v: 0.3 }],
  // On the bar
  clink: () => [{ w: 'tri', f: 2093, d: 0.15, v: 0.5 }, { w: 'tri', f: 3136, d: 0.1, v: 0.3 }],
  bank: () => [{ w: 'tri', f: 1320, d: 0.25, v: 0.6 }],
  thud: () => [{ w: 'tri', f: 160, to: 50, d: 0.1, v: 0.9 }],
  spill: () => seq([72, 67, 63, 60], 0.04, 'p25', { v: 0.3 }),
  smash: () => [{ w: 'noise', f: 9000, to: 2000, d: 0.35, v: 0.6, filt: 'highpass' }, ...seq([100, 96, 103, 98], 0.03, 'p12', { v: 0.15 })],
  // Scoring
  serve: () => [...seq([83], 0.07, 'p50', { v: 0.3 }), ...seq([88], 0.3, 'p50', { v: 0.3, hold: 0.1 }, 0.07)],
  perfect: () => [{ w: 'p25', f: m(72), to: m(84), d: 0.12, v: 0.3 }, ...seq([96, 100, 103, 108, 103, 108], 0.03, 'p12', { v: 0.2 }, 0.12)],
  trick: () => seq([72, 79, 84, 91, 96], 0.05, 'p25', { v: 0.3, d: 0.03 }),
  peanuts: () => [...seq([67, 72, 67, 72], 0.05, 'p12', { v: 0.3 }), { w: 'noise', f: 3000, d: 0.05, v: 0.3, t: 0.2 }],
  cards: () => seq([81, 85, 88, 93], 0.06, 'tri', { v: 0.6 }),
  // The regulars
  warn: () => seq([64, 60, 64, 60], 0.12, 'p25', { v: 0.3 }),
  leave: () => seq([67, 65, 63, 60], 0.15, 'p25', { v: 0.3 }),
  slap: () => [{ w: 'noise', f: 1500, d: 0.08, v: 0.8 }, { w: 'tri', f: 200, to: 60, d: 0.1, v: 0.8 }],
  say: () => [0, 1].map((i): V => ({ w: 'tri', f: 250 + Math.random() * 200, d: 0.05, v: 0.5, t: i * 0.07 })),
  cutin: () => seq([72, 84], 0.03, 'tri', { v: 0.6 }),
  // End of the night
  win: () => seq([72, 76, 79, 84, 79, 84, 88, 91, 96], 0.06, 'p12', { v: 0.3 }),
  lose: () => [...seq([60, 59, 58], 0.25, 'p50', { v: 0.25 }), { w: 'p50', f: m(57), d: 0.8, v: 0.25, t: 0.75, vib: [5, 7] }],
} satisfies Record<string, (p: number) => V[]>;
export type SfxId = keyof typeof SFX;

// ---------------- Settings: music and effects on/off (this device only) ----------------
const KEY = 'lo-sound-on';
let on = { music: true, sfx: true };
try { on = { ...on, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { /* storage unavailable */ }
function save() { try { localStorage.setItem(KEY, JSON.stringify(on)); } catch { /* private mode */ } }

// ---------------- The synth ----------------
let ctx: AudioContext | null = null;
let master: GainNode;
const waves: Partial<Record<Wave, PeriodicWave>> = {};
let noiseBuf: AudioBuffer;

function pulse(c: AudioContext, duty: number) {
  const N = 48, re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
  return c.createPeriodicWave(re, im);
}
/** NES-style noise from a 15-bit shift register. */
function noise(c: AudioContext) {
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
  let reg = 1, hold = 0, val = 1;
  for (let i = 0; i < d.length; i++) {
    if (hold-- <= 0) { hold = 2; const bit = (reg ^ (reg >> 1)) & 1; reg = (reg >> 1) | (bit << 14); val = reg & 1 ? 1 : -1; }
    d[i] = val;
  }
  return b;
}
function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = SFX_VOL;
  master.connect(ctx.destination);
  waves.p12 = pulse(ctx, 0.125); waves.p25 = pulse(ctx, 0.25); waves.p50 = pulse(ctx, 0.5);
  noiseBuf = noise(ctx);
  return ctx;
}

function voice(c: AudioContext, v: V, at: number) {
  const t = at + (v.t ?? 0), end = t + v.d, a = v.a ?? 0.004, vol = v.v ?? 0.5;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.setValueAtTime(vol, t + a + v.d * (v.hold ?? 0));
  g.gain.exponentialRampToValueAtTime(0.001, end);
  g.connect(master);
  let src: AudioScheduledSourceNode;
  if (v.w === 'noise') {
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = v.filt ?? 'lowpass';
    f.Q.value = v.q ?? 0.7;
    f.frequency.setValueAtTime(v.f, t);
    if (v.to) f.frequency.exponentialRampToValueAtTime(v.to, end);
    s.connect(f).connect(g);
    src = s;
  } else {
    const o = c.createOscillator();
    if (v.w === 'tri') o.type = 'triangle';
    else o.setPeriodicWave(waves[v.w]!);
    o.frequency.setValueAtTime(v.f, t);
    if (v.to) o.frequency.exponentialRampToValueAtTime(v.to, end);
    if (v.vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = v.vib[1]; lg.gain.value = v.vib[0];
      l.connect(lg).connect(o.frequency);
      l.start(t); l.stop(end + 0.02);
    }
    o.connect(g);
    src = o;
  }
  src.start(t);
  src.stop(end + 0.02);
}

const lastPlayed: Partial<Record<SfxId, number>> = {};
/** Play a sound effect. p (0–1) is the strength, for sounds that change with it. */
export function sfx(id: SfxId, p = 0) {
  if (!on.sfx) return;
  const c = ensure();
  if (!c || c.state !== 'running') return;
  // The same sound piling up in one frame (a pile-up of glasses) plays once.
  const now = c.currentTime;
  if (now - (lastPlayed[id] ?? -1) < 0.045) return;
  lastPlayed[id] = now;
  for (const v of SFX[id](Math.max(0, Math.min(1, p)))) voice(c, v, now + 0.005);
}

// ---------------- Music ----------------
let track: HTMLAudioElement | null = null;
function syncMusic() {
  if (!unlocked || !on.music || document.hidden) { track?.pause(); return; }
  if (!track) {
    track = new Audio(MUSIC_URL);
    track.loop = true;
    track.volume = MUSIC_VOL;
  }
  if (track.paused) track.play().catch(() => { /* not allowed yet: tries again on the next tap */ });
}

// Browsers only start sound after the first tap or key press.
let unlocked = false;
function unlock() {
  const c = ensure();
  if (c && c.state !== 'running') void c.resume();
  unlocked = true;
  syncMusic();
}
addEventListener('pointerdown', unlock, { capture: true });
addEventListener('keydown', unlock, { capture: true });
// Pause when the post is scrolled away or the app is in the background.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) void ctx?.suspend(); else if (unlocked) void ctx?.resume();
  syncMusic();
});

// ---------------- The sound menu: music on/off, effects on/off ----------------
export function mountSoundPanel(panel: HTMLElement, toggle: HTMLElement) {
  const sync = () => {
    toggle.classList.toggle('muted', !on.music && !on.sfx);
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    for (const k of ['music', 'sfx'] as const) {
      panel.querySelectorAll<HTMLButtonElement>(`[data-snd="${k}"]`).forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.val === 'on') === on[k])));
    }
  };
  panel.innerHTML = `
    <div class="snd-row"><span class="snd-label">Music</span><div class="snd-opts">
      <button type="button" data-snd="music" data-val="on">On</button><button type="button" data-snd="music" data-val="off">Off</button></div></div>
    <div class="snd-row"><span class="snd-label">Effects</span><div class="snd-opts">
      <button type="button" data-snd="sfx" data-val="on">On</button><button type="button" data-snd="sfx" data-val="off">Off</button></div></div>`;
  panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-snd]');
    if (!b) return;
    on[b.dataset.snd as 'music' | 'sfx'] = b.dataset.val === 'on';
    save(); syncMusic(); sync();
  });
  const show = (open: boolean) => { panel.hidden = !open; sync(); };
  toggle.addEventListener('click', () => show(panel.hidden === true));
  // A tap anywhere else closes the menu.
  addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !panel.contains(e.target as Node) && !toggle.contains(e.target as Node)) show(false);
  }, { capture: true });
  sync();
}
