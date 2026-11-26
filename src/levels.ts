// Level data for the Last Orders proof of concept.
// World units: the play area is 390 x 600. The counter is a rectangle the drinks slide on.

export type Drink = 'beer' | 'rye' | 'whiskey' | 'sarsaparilla' | 'water';
export type RailType = 'brass' | 'timber';
export type Side = 'left' | 'right' | 'top' | 'bottom';
export type NpcId = 'sheriff' | 'dutch' | 'twofist' | 'pete' | 'lavinia';

export interface RailSeg { side: Side; from: number; to: number; type: RailType }
/** A drink already standing on the bar when the night starts. */
export interface GlassDef { id: string; x: number; y: number; drink: Drink; owner: NpcId }
/** An order: slide this drink so it stops inside the dotted spot. Served in list order. */
export interface OrderDef { owner: NpcId; drink: Drink; x: number; y: number; r: number }
export interface PropDef { id: string; kind: 'hat' | 'cards'; owner: NpcId; x: number; y: number }
export interface PostDef { x: number; y: number; r: number; kind: 'tap' | 'tipjar' }
export interface PuddleDef { drink: Drink; x: number; y: number; r: number }
export interface ArmDef { owner: NpcId; y: number; reach: number; period: number }
export interface NpcDef { id: NpcId; side: 'left' | 'right'; y: number }

export interface Level {
  id: string;
  night: number;
  title: string;
  blurb: string;
  hint: string;
  pours: number; // drinks you can slide tonight, including spares for misses
  counter: { x: number; y: number; w: number; h: number };
  rails: RailSeg[]; // any stretch of edge not covered is open (no rail)
  start: { x: number; y: number };
  npcs: NpcDef[];
  orders: OrderDef[];
  glasses: GlassDef[];
  props: PropDef[];
  posts: PostDef[];
  bowl?: { x: number; y: number };
  bonus?: { x: number; y: number; r: number }; // Pete's peanut spot
  puddles: PuddleDef[];
  arm?: ArmDef;
}

export const DRINK_NAME: Record<Drink, string> = { beer: 'beer', rye: 'rye', whiskey: 'whiskey', sarsaparilla: 'sarsaparilla', water: 'water' };

export const NPCS: Record<NpcId, { name: string; short: string; hat: string; crown: string; coat: string; lines: Record<string, string> }> = {
  sheriff: {
    name: 'SHERIFF', short: 'Sheriff', hat: '#C8A46A', crown: '#A9864E', coat: '#6B4A2E',
    lines: { served: 'Much obliged.', perfect: 'Now that\'s a pour.', miss: 'I ain\'t reachin\' for that.', knocked: 'That was MY whiskey.', wet: 'You splashed the law, son.', hat: "That's it. I'm leaving." },
  },
  dutch: {
    name: 'DUTCH', short: 'Dutch', hat: '#3A3A3A', crown: '#262626', coat: '#4A5A3A',
    lines: { served: 'Now we\'re talkin\'.', perfect: 'Right in my hand!', miss: 'Closer, barkeep!', knocked: 'MY BEER!' },
  },
  twofist: {
    name: 'TWO-FIST', short: 'Two-Fist', hat: '#2E2E2E', crown: '#1E1E1E', coat: '#6A2E2E',
    lines: { served: 'One for each hand.', perfect: 'Smooth.', miss: 'My arms ain\'t that long.', knocked: 'Hey! I was drinkin\' that.' },
  },
  pete: {
    name: 'OLD PETE', short: 'Pete', hat: '#7A6A55', crown: '#665844', coat: '#4A4A5A',
    lines: { bonus: '...peanuts?', snore: 'zzz', served: 'Mm.', perfect: 'Mm!', miss: 'zzz', knocked: 'Wha—?' },
  },
  lavinia: {
    name: 'LAVINIA', short: 'Lavinia', hat: '#5B3A6B', crown: '#47295A', coat: '#7A4E5E',
    lines: { bonus: 'That ace was there when I sat down!', served: 'Charmed.', perfect: 'You have a gift.', miss: 'Darling, really.', knocked: 'How rude.' },
  },
};

const COUNTER = { x: 125, y: 20, w: 140, h: 570 };
const TOP = COUNTER.y, BOTTOM = COUNTER.y + COUNTER.h;
const LEFT = COUNTER.x, RIGHT = COUNTER.x + COUNTER.w;

export const LEVELS: Level[] = [
  {
    id: 'n1', night: 1, title: 'A quiet Monday',
    blurb: 'Two orders. Slide each drink into the dotted circle.',
    hint: 'Touch the bar to aim, then pull the beer tap down and let go. Stop the drink inside the glowing circle.',
    pours: 4,
    counter: COUNTER,
    rails: [
      { side: 'left', from: TOP, to: BOTTOM, type: 'brass' },
      { side: 'right', from: TOP, to: BOTTOM, type: 'brass' },
      { side: 'top', from: LEFT, to: RIGHT, type: 'brass' },
      { side: 'bottom', from: LEFT, to: RIGHT, type: 'timber' },
    ],
    start: { x: 195, y: 550 },
    npcs: [
      { id: 'dutch', side: 'left', y: 120 },
      { id: 'sheriff', side: 'left', y: 340 },
      { id: 'pete', side: 'right', y: 250 },
    ],
    orders: [
      { owner: 'sheriff', drink: 'whiskey', x: 158, y: 334, r: 19 },
      { owner: 'dutch', drink: 'beer', x: 166, y: 124, r: 19 },
    ],
    glasses: [],
    props: [{ id: 'sheriff-hat', kind: 'hat', owner: 'sheriff', x: 148, y: 288 }],
    posts: [],
    puddles: [],
  },
  {
    id: 'n2', night: 2, title: 'Two drifters',
    blurb: 'Dutch and Two-Fist want drinks. The sheriff is watching.',
    hint: 'Gold rails bounce. Dark timber stops you dead. No rail? It falls off.',
    pours: 5,
    counter: COUNTER,
    rails: [
      { side: 'left', from: TOP, to: 330, type: 'brass' },
      { side: 'left', from: 330, to: BOTTOM, type: 'timber' },
      { side: 'right', from: TOP, to: 190, type: 'brass' },
      { side: 'right', from: 290, to: BOTTOM, type: 'brass' },
      { side: 'top', from: LEFT, to: RIGHT, type: 'timber' },
      { side: 'bottom', from: LEFT, to: RIGHT, type: 'timber' },
    ],
    start: { x: 195, y: 550 },
    npcs: [
      { id: 'dutch', side: 'left', y: 90 },
      { id: 'twofist', side: 'right', y: 130 },
      { id: 'sheriff', side: 'left', y: 300 },
      { id: 'pete', side: 'right', y: 420 },
    ],
    orders: [
      { owner: 'sheriff', drink: 'whiskey', x: 158, y: 304, r: 19 },
      { owner: 'twofist', drink: 'rye', x: 234, y: 134, r: 19 },
      { owner: 'dutch', drink: 'beer', x: 160, y: 94, r: 19 },
    ],
    glasses: [{ id: 'pete-water', x: 242, y: 404, drink: 'water', owner: 'pete' }],
    props: [{ id: 'sheriff-hat', kind: 'hat', owner: 'sheriff', x: 146, y: 264 }],
    posts: [{ x: 195, y: 250, r: 11, kind: 'tap' }],
    bowl: { x: 205, y: 456 }, // shave its left side: it rolls into Pete's spot and the whiskey carries on to the sheriff (a combo)
    bonus: { x: 242, y: 440, r: 18 },
    puddles: [{ drink: 'sarsaparilla', x: 200, y: 180, r: 27 }],
  },
  {
    id: 'n3', night: 3, title: 'Pete\'s clock',
    blurb: 'Old Pete dozes on his elbow. When it slips, his arm slaps across the bar.',
    hint: 'Time your slide between slaps. Lavinia\'s card deck hides a secret.',
    pours: 5,
    counter: COUNTER,
    rails: [
      { side: 'left', from: TOP, to: BOTTOM, type: 'brass' },
      { side: 'right', from: TOP, to: 380, type: 'brass' },
      { side: 'right', from: 470, to: BOTTOM, type: 'brass' },
      { side: 'top', from: LEFT, to: RIGHT, type: 'brass' },
      { side: 'bottom', from: LEFT, to: RIGHT, type: 'timber' },
    ],
    start: { x: 195, y: 550 },
    npcs: [
      { id: 'twofist', side: 'left', y: 100 },
      { id: 'dutch', side: 'right', y: 70 },
      { id: 'lavinia', side: 'left', y: 200 },
      { id: 'pete', side: 'right', y: 300 },
      { id: 'sheriff', side: 'right', y: 455 },
    ],
    orders: [
      { owner: 'sheriff', drink: 'whiskey', x: 234, y: 450, r: 19 },
      { owner: 'lavinia', drink: 'sarsaparilla', x: 158, y: 184, r: 19 },
      { owner: 'dutch', drink: 'beer', x: 232, y: 76, r: 21 },
    ],
    glasses: [{ id: 'twofist-rye', x: 158, y: 104, drink: 'rye', owner: 'twofist' }],
    props: [
      { id: 'lavinia-cards', kind: 'cards', owner: 'lavinia', x: 150, y: 226 },
      { id: 'sheriff-hat', kind: 'hat', owner: 'sheriff', x: 240, y: 494 },
    ],
    posts: [{ x: 200, y: 140, r: 12, kind: 'tipjar' }],
    bowl: { x: 196, y: 380 },
    bonus: { x: 244, y: 330, r: 18 },
    puddles: [{ drink: 'whiskey', x: 186, y: 248, r: 33 }],
    arm: { owner: 'pete', y: 300, reach: 80, period: 150 },
  },
];
