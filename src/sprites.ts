// Pixel sprites in the "high angle" style: a camera above the bar, hard dark outlines,
// one shade and one highlight per material. '.' is transparent. Maps are drawn
// with the bar at the BOTTOM (hands toward the bar) and rotated for each side.
import type { Drink, NpcId } from './levels';

export type SpriteMap = string[];
export type Palette = Record<string, string>;

const OUTLINE = '#1a0f0a';

// ---------------- customers ----------------
export const NPC_SPRITES: Record<NpcId, SpriteMap> = {
  // The sheriff's hat is on the bar, so we see his hair, eyes and mustache.
  sheriff: [
    '................',
    '......kkkk......',
    '....kkRRRRkk....',
    '...kRRrRRRRRk...',
    '..kRRRRrRRRRRk..',
    '..kRrRRRRRrRRk..',
    '..kRRRRRRRRRRk..',
    '..ksSRRRRRRSsk..',
    '...kSSkSSkSSk...',
    '.kckksRRRRskkck.',
    'kcCCkkkSSkkkCCck',
    'kcCCCAAkkAACCGck',
    'kcCCCCAAAACCCCck',
    'kSSkCCCCCCCCkSSk',
  ],
  dutch: [
    '................',
    '.....kkkkkk.....',
    '....khHHHHhk....',
    '...khHOOOOHhk...',
    '...kHOOOoOOHk...',
    '...kHOOOOOOHk...',
    '...knnnnnnnnk...',
    '..khHHHHHHHHhk..',
    '.kckkkkkkkkkkck.',
    'kcCCkRRRRRRkCCck',
    'kcCCkkSSSSkkCCck',
    'kcAAAWWWWWWAAAck',
    'kSSkAAAGAAAAkSSk',
  ],
  lavinia: [
    '..........aA....',
    '.........aAa....',
    '.....kkkkAkk....',
    '....kHHHHHHHk...',
    '...kHHOOOOOHHk..',
    '...kHOOoOOOOHk..',
    '...knnnnnnnnnk..',
    '..kRRHHHHHHHRRk.',
    '.kRRRkkkkkkkRRRk',
    '.kRRkSSSSSSkRRk.',
    'kcRkksSAASskkRck',
    'kcCCkkSSSSkkCCck',
    'kcCCCWWGGWWCCCck',
    'kSSkCCCCCCCCkSSk',
  ],
  twofist: [
    '................',
    '.....kkkkkk.....',
    '...kkhhhhhhkk...',
    '..khHHHHHHHHhk..',
    '.khHHkkkkkkHHhk.',
    '.khHkOOOOOOkHhk.',
    '.khHkOOoOOOkHhk.',
    '.khHknnnnnnkHhk.',
    '.khHHkkkkkkHHhk.',
    '..khhHHHHHHhhk..',
    '.kckkkkkkkkkkck.',
    'kcCCkrRRRRrkCCck',
    'kcCCCkkSSkkCCCck',
    'kSSkCCCAACCCkSSk',
  ],
  // Asleep: the slouch hat droops forward over his face. His right arm is drawn
  // separately because it swings out across the bar.
  pete: [
    '................',
    '....kkkkkkk.....',
    '..kkhHHHHHHkk...',
    '.khHHHHOOOHHhk..',
    '.khHHOOoOOOHHhk.',
    '.khHHOOOOOOHHhk.',
    '.khHHnnnnnnHHhk.',
    '..khHHHHHHHHhk..',
    '...kkhhhhhhkk...',
    '.kckkkRRRRkkkck.',
    'kcCCkRRRRRRkCCck',
    'kcCCCkkkkkkCCCck',
    'kcCCCCCCCCCCCCck',
    'kSSkCCCCCCCCkcck',
  ],
};

export const NPC_PAL: Record<NpcId, Palette> = {
  sheriff: { H: '#d8b47a', h: '#a9864e', n: '#4a2c17', O: '#c39a5c', o: '#7d5f34', S: '#e2b48c', s: '#b98a68', R: '#6b4628', r: '#4a2f1a', C: '#6b4a2e', c: '#4a3220', W: '#e8dcc6', A: '#a8322a', a: '#6e1f16' },
  dutch: { H: '#3a3a3a', h: '#222222', n: '#7a2a2a', O: '#4a4a4a', o: '#1e1e1e', S: '#eab894', s: '#c08e6c', R: '#c0703a', r: '#8a4a22', C: '#4a5a3a', c: '#334026', W: '#efe6d6', A: '#c49a3c', a: '#7a5e24' },
  lavinia: { H: '#6a3f7d', h: '#43285a', n: '#e58bb5', O: '#7d4f92', o: '#2f1a3c', S: '#f2cbb0', s: '#c99c80', R: '#2a1a1a', r: '#140c0c', C: '#8a4e66', c: '#5e3446', W: '#f4e4ec', A: '#e58bb5', a: '#b0607e' },
  twofist: { H: '#2e2e2e', h: '#1a1a1a', n: '#8a2a2a', O: '#3a3a3a', o: '#111111', S: '#d9a27a', s: '#a87656', R: '#3a2a20', r: '#241810', C: '#7a2e2a', c: '#521e1c', W: '#e8dcc6', A: '#c9b9a0', a: '#8a7a64' },
  pete: { H: '#7a6a55', h: '#5a4c3a', n: '#3a3026', O: '#8a7a62', o: '#4a3e2e', S: '#e2b48c', s: '#b98a68', R: '#e8e4dc', r: '#b8b2a8', C: '#4a4a5a', c: '#33333f', W: '#e8dcc6', A: '#8a8a9a', a: '#5a5a6a' },
};
for (const p of Object.values(NPC_PAL)) { p.k = OUTLINE; p.G = '#f2b53a'; }

// ---------------- things on the bar ----------------
/** The sheriff's cattleman hat from above: curled brim, creased crown, band, star. */
export const HAT: SpriteMap = [
  '...kkkkkk...',
  '.kkhHHHHhkk.',
  'khHHkkkkHHhk',
  'khHkBBGBkHhk',
  'khHkCCdCkHhk',
  'khHkBBBBkHhk',
  'khHHkkkkHHhk',
  '.kkhhhhhhkk.',
  '...kkkkkk...',
];
export const HAT_PAL: Palette = { k: '#3b2614', H: '#d8b47a', h: '#a9864e', C: '#c39a5c', d: '#7d5f34', B: '#4a2c17', G: '#f2b53a' };

/** A glass seen from above at an angle: rim, drink, and a sliver of the glass side. */
export const GLASS: SpriteMap = [
  '.kkkkkk.',
  'kgwDDDDk',
  'kDDDDDDk',
  'kDDDDDdk',
  'kgDDDDdk',
  '.kggggk.',
  '..kkkk..',
];
export const GLASS_BEER: SpriteMap = [
  '.kkkkkk.',
  'kFwFFFFk',
  'kFFFFFfk',
  'kDDDDDdk',
  'kgDDDDdk',
  '.kggggk.',
  '..kkkk..',
];
/** A glass lying on its side, mouth to the right, drink running out. */
export const GLASS_TIPPED: SpriteMap = [
  '.kkkkkkk.',
  'kgggggDDk',
  'kgwgggDDD',
  'kgggggDDk',
  '.kkkkkkk.',
];

const DRINK_PAL: Record<Drink, { D: string; d: string }> = {
  beer: { D: '#e8b24a', d: '#b98a2e' },
  rye: { D: '#b5652c', d: '#86461c' },
  whiskey: { D: '#c77b2e', d: '#93561c' },
  sarsaparilla: { D: '#5a2c17', d: '#3a1a0c' },
  water: { D: '#bfe0ea', d: '#8fb6c2' },
};
export function glassPal(drink: Drink): Palette {
  return { k: OUTLINE, g: '#a9bcbc', w: '#ffffff', F: '#f6ebd3', f: '#d9c9a6', ...DRINK_PAL[drink] };
}

/** Beer tap: brass base, steel stem, black-and-red handle sticking up. */
export const TAP: SpriteMap = [
  '...kkkkk...',
  '..kNNNNNk..',
  '...kNNNk...',
  '...kkMkk...',
  '.kkYYMYYkk.',
  'kYYyYYYYyYk',
  'kYwYYYYYYYk',
  'kYYYYYYYyYk',
  'kyYYYYYYyyk',
  '.kkyyyyykk.',
  '...kkkkk...',
];
/** Tip jar: a glass jar half full of coins. */
export const TIPJAR: SpriteMap = [
  '...kkkkkk...',
  '..kgggwggk..',
  '.kgPPPPPPgk.',
  'kgPYYPPYYPgk',
  'kgPYyPYyYPgk',
  'kgPPYYYPPPgk',
  'kgPYYPYYyPgk',
  '.kgPPPPPPgk.',
  '..kggggggk..',
  '...kkkkkk...',
];
/** Peanut bowl: turned wooden bowl heaped with peanuts. */
export const BOWL: SpriteMap = [
  '....kkkkk....',
  '..kkLLLLLkk..',
  '.kLlPPpPPlLk.',
  'kLlPpPPPpPlLk',
  'kLPPPpPPPpPLk',
  'kLlPPPpPPPlLk',
  'kLLlPpPPPlLLk',
  '.kLLlllllLLk.',
  '.kkLLLLLLLkk.',
  '...kkkkkkk...',
];
/** Lavinia's deck: three cards fanned, red pips. */
export const CARDS: SpriteMap = [
  '...kkkkk...',
  '.kkWWWWWk..',
  'kWkWRWWWkk.',
  'kWkWWWWWkWk',
  'kWkWWRWWkWk',
  'kWkWWWWWkWk',
  'kWkWWWRWkWk',
  'kkkWWWWWkWk',
  '..kkkkkkkkk',
];
/** The ace that falls out when the deck is knocked. */
export const ACE: SpriteMap = [
  'kkkkkk',
  'kRWWWk',
  'kWRRWk',
  'kWRRWk',
  'kWWWRk',
  'kkkkkk',
];
export const ITEM_PAL: Palette = {
  k: OUTLINE, w: '#ffffff', g: '#a9bcbc', P: '#d6e6ea',
  Y: '#d9a441', y: '#9a6c1f', M: '#8a9aa2', N: '#1f1414',
  L: '#8a5631', l: '#5e3a1f', p: '#c59a5a',
  W: '#f7f1e4', R: '#b3261e',
};
// Peanuts use P too; give the bowl its own pale tan.
export const BOWL_PAL: Palette = { ...ITEM_PAL, P: '#e3c08a' };
// The tap's handle is black with a red ring.
export const TAP_PAL: Palette = { ...ITEM_PAL, N: '#2a1a1a' };

// ---------------- helpers ----------------
/** Rotate a map 90° clockwise (bar side moves from bottom to left). */
export function rotateCW(map: SpriteMap): SpriteMap {
  const h = map.length, w = map[0].length;
  const out: string[] = [];
  for (let c = 0; c < w; c++) {
    let row = '';
    for (let r = h - 1; r >= 0; r--) row += map[r][c];
    out.push(row);
  }
  return out;
}
/** Rotate a map 90° counter-clockwise (bar side moves from bottom to right). */
export function rotateCCW(map: SpriteMap): SpriteMap {
  const h = map.length, w = map[0].length;
  const out: string[] = [];
  for (let c = w - 1; c >= 0; c--) {
    let row = '';
    for (let r = 0; r < h; r++) row += map[r][c];
    out.push(row);
  }
  return out;
}
export function mirrorX(map: SpriteMap): SpriteMap {
  return map.map((r) => [...r].reverse().join(''));
}

// ---------------- Old Pete's poses (bar at the bottom, like the others) ----------------
/** Leaning on his elbow, chin in hand, asleep. */
export const PETE_LEAN: SpriteMap = [
  '....kkkkkkk.....',
  '..kkhHHHHHHkk...',
  '.khHHHOOOoOHhk..',
  '.khHHOOOoOOOHhk.',
  '.khHHnnnnnnHHhk.',
  '..khhhhhhhhhhk..',
  '..kSkkkSSkkkSk..',
  '.kSSkRRRRRRkk...',
  '.kSskRRRRRRkck..',
  '.kSSkkRRRRkkCck.',
  '.kcWkcCCCCCCCCck',
  '.kcCkcCCCCCCCCck',
  '.kcCkkCCCCCCcSSk',
  '.kcckkkkkkkkkSSk',
];
/** The elbow slides out from under him. */
export const PETE_SLIP: SpriteMap = [
  '....kkkkkkk.....',
  '..kkhHHHHHHkk...',
  '.khHHHOOOoOHhk..',
  '.khHHOOOoOOOHhk.',
  '.khHHnnnnnnHHhk.',
  '..khhhhhhhhhhk..',
  '...kkkkSSkkkSk..',
  '..kkRRRRRRRkk...',
  '.kSSkRRRRRkck...',
  'kSSskkRRRkkCck..',
  'kSSkcCCCCCCCCck.',
  '.kkcCCCCCCCCCCck',
  '..kcCCCCCCCcSSk.',
  '..kkkkkkkkkkSSk.',
];
/** Head dropped, arm gone out across the bar (the arm itself is drawn separately). */
export const PETE_DROP: SpriteMap = [
  '................',
  '....kkkkkkk.....',
  '..kkhHHHHHHkk...',
  '.khHHHOOOoOHhk..',
  '.khHHOOOoOOOHhk.',
  '.khHHnnnnnnHHhk.',
  '..khhhhhhhhhhk..',
  '...kkkRRRRkkk...',
  '..kcckRRRRkcck..',
  '.kcCCkkkkkkCCck.',
  '.kcCCCCCCCCCCck.',
  '.kcCkCCCCCCCcSSk',
  '.kcCkkkkkkkkkSSk',
  '.kcCk...........',
];
/** Pete's open palm, flat on the bar (pointing up; rotated per side). */
export const PALM: SpriteMap = [
  '.kkkkk.',
  'kSSSSSk',
  'ksSSSSk',
  'kSSSSSk',
  'ksSsSSk',
  'kSSSSSk',
  '.kkkkk.',
];
