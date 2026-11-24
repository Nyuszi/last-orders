// Draws every item sprite in the game from the same sprite data and palettes the renderer uses,
// next to a complete, copy-paste prompt for regenerating it with an image model.
// Usage: npx tsx scripts/sprite-sheet.ts
//   -> art/sprite-sheet.svg     (just the sprites)
//   -> art/sprite-prompts.html  (each sprite with its full prompt and a Copy button)
//   -> art/SPRITE_PROMPTS.md    (the same prompts as text)
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import {
  ACE, BOWL, BOWL_PAL, CARDS, GLASS, GLASS_BEER, GLASS_TIPPED, HAT, HAT_PAL, ITEM_PAL, NPC_PAL, NPC_SPRITES,
  PALM, PETE_DROP, PETE_LEAN, PETE_SLIP, TAP, TAP_PAL, TIPJAR, glassPal, type Palette, type SpriteMap,
} from '../src/sprites';
import { smoothShaded } from '../src/render';

const STYLE = 'Pixel art game sprite, seen from directly above (top-down, camera looking straight down), for a western saloon game. '
  + 'Chunky retro pixel art with a clearly visible square pixel grid: big flat pixels, a 1-pixel dark brown outline (#1a0f0a), '
  + 'at most 6 colours, no gradients, no anti-aliasing, no blur, no text, no shadow on the ground. The object fills most of the '
  + 'image and is centred. Background: one flat solid magenta colour (#FF00FF) with nothing else in it. No checkerboard, no scenery.';

// Image models can't draw truly low-res art from words alone (asked for "32×28 pixel art" they
// draw a detailed portrait). So every prompt starts from a reference: the current sprite blown up
// at its real in-game grid (art/sprite-refs/<name>-ref.png), and asks for a better version on
// exactly that grid. Characters also get their portrait, for looks and colours only.
const REF = (w: number, h: number) => `Redraw the FIRST attached image. It is a tiny ${w}×${h}-pixel game sprite shown blown up, so every pixel is a big square block. `
  + `Make a cleaner, better-looking version of it at EXACTLY the same resolution: the same ${w}×${h} grid of equal square blocks, the same size, position and angle, `
  + 'an outline exactly one block thick in dark brown (#1a0f0a). Every block is one flat colour. No detail smaller than one block, no thin lines, no smooth shading, '
  + 'no gradients, no anti-aliasing, no blur, no text, at most 8 colours. Output it blown up the same way, filling the image like the first one, '
  + 'on one flat solid magenta background (#FF00FF) with nothing else in it. Pixel art for a western saloon game.';

/** `target`: the size the sprite is drawn at in the game when it differs from its map (customers are drawn twice as big). */
type Entry = { file: string; name: string; note: string; map: SpriteMap; pal: Palette; scale?: number; prompt: string; attach?: string; character?: boolean; target?: [number, number] };
const sections: { title: string; tip?: string; items: Entry[] }[] = [
  {
    title: 'On the bar',
    items: [
      { file: 'hat.png', name: "Sheriff's hat", note: "don't touch", map: HAT, pal: HAT_PAL,
        prompt: "The sheriff's cowboy hat lying on a bar counter, seen from above: an oval tan brim (#d8b47a) around a darker crown with a dent in the middle, and a thin dark brown hat band with a small gold buckle. Wider than it is tall." },
      { file: 'peanuts.png', name: 'Peanut bowl', note: 'bonus: push it to Pete', map: BOWL, pal: BOWL_PAL,
        prompt: 'A round wooden bowl full of roasted peanuts in their shells, seen from above: dark wooden rim, light tan peanuts inside with a few darker shell lines. Slightly wider than tall.' },
      { file: 'cards.png', name: "Lavinia's cards", note: 'bonus: knock them', map: CARDS, pal: ITEM_PAL,
        prompt: 'A small fanned-out stack of playing cards lying on a bar counter, seen from above: four or five white cards with red and black suit marks, slightly spread like a fan.' },
      { file: 'ace.png', name: 'Hidden ace', note: 'shows when the cards are hit', map: ACE, pal: ITEM_PAL,
        prompt: 'A single ace of spades playing card seen from above: white card, one large black spade in the middle. Very simple, bold shape.' },
      { file: 'tap.png', name: 'Beer tap', note: 'spills a drink', map: TAP, pal: TAP_PAL,
        prompt: 'A brass beer tap fixed to a bar counter, seen from directly above: a round shiny brass base, a steel spout, and a black handle with a red ring pointing up. Round overall.' },
      { file: 'tipjar.png', name: 'Tip jar', note: 'spills a drink', map: TIPJAR, pal: ITEM_PAL,
        prompt: 'A glass tip jar on a bar counter, seen from above: a round clear glass rim with a few gold coins and a folded green banknote visible inside.' },
    ],
  },
  {
    title: 'Drinks',
    tip: 'Make the beer first, then attach it for the others so every glass has the same size and shape.',
    items: [
      { file: 'beer.png', name: 'Beer', note: 'mug', map: GLASS_BEER, pal: glassPal('beer'),
        prompt: 'A beer mug seen from directly above: round glass rim, golden beer (#e8b24a) with a white foam head, a small handle sticking out to the right, one white highlight pixel on the rim.' },
      { file: 'whiskey.png', name: 'Whiskey', note: 'glass', map: GLASS, pal: glassPal('whiskey'), attach: 'beer.png',
        prompt: 'A short whiskey glass seen from directly above, the same size and style as the attached beer: round clear glass rim, amber whiskey (#c77b2e) inside, one white highlight pixel on the rim. No handle.' },
      { file: 'rye.png', name: 'Rye', note: 'glass', map: GLASS, pal: glassPal('rye'), attach: 'beer.png',
        prompt: 'A short whiskey glass seen from directly above, the same size and style as the attached beer: round clear glass rim, reddish-brown rye whiskey (#b5652c) inside, one white highlight pixel on the rim. No handle.' },
      { file: 'sarsaparilla.png', name: 'Sarsaparilla', note: 'glass', map: GLASS, pal: glassPal('sarsaparilla'), attach: 'beer.png',
        prompt: 'A short glass seen from directly above, the same size and style as the attached beer: round clear glass rim, very dark brown sarsaparilla (#5a2c17) with a little tan foam at the edge, one white highlight pixel on the rim. No handle.' },
      { file: 'water.png', name: 'Water', note: 'glass', map: GLASS, pal: glassPal('water'), attach: 'beer.png',
        prompt: 'A short glass seen from directly above, the same size and style as the attached beer: round clear glass rim, pale blue water (#bfe0ea) inside, one white highlight pixel on the rim. No handle.' },
      { file: 'tipped.png', name: 'Knocked over', note: 'spilled glass', map: GLASS_TIPPED, pal: glassPal('whiskey'), attach: 'whiskey.png',
        prompt: 'The attached whiskey glass knocked over on its side on a bar counter, seen from above: the glass lying sideways with its open end to the right, a small splash of amber whiskey spilling out of the open end.' },
    ],
  },
  {
    title: "Old Pete's arm",
    tip: 'Make "Leaning" first, then attach it for "Slipping" and "Slap" so he stays the same. The game shows these three in turn as his arm moves.',
    items: [
      { file: 'pete-lean.png', name: 'Leaning', note: 'asleep on his elbow', map: PETE_LEAN, pal: NPC_PAL.pete, attach: 'pete-any.webp (portrait)', character: true, target: [32, 28],
        prompt: 'Old Pete from the portrait, asleep: eyes closed, head drooping, leaning on one bent elbow. A droopy brown slouch hat, bushy white eyebrows, long white beard, worn grey coat. His elbow rests near the bottom edge.' },
      { file: 'pete-slip.png', name: 'Slipping', note: 'elbow slides', map: PETE_SLIP, pal: NPC_PAL.pete, attach: 'pete-lean.png', character: true, target: [32, 28],
        prompt: 'The same old man as the second image, same size and angle, still half asleep: his elbow is slipping, the bent arm sliding forward toward the bottom edge, shoulders tilted, eyes opening in surprise.' },
      { file: 'pete-slap.png', name: 'Slap', note: 'arm across the bar', map: PETE_DROP, pal: NPC_PAL.pete, attach: 'pete-lean.png', character: true, target: [32, 28],
        prompt: 'The same old man as the second image, same size and angle, jolted awake: his arm flung straight out forward across the bottom edge, open hand slapping down, mouth open.' },
      { file: 'pete-palm.png', name: 'Palm', note: 'hand on the bar', map: PALM, pal: NPC_PAL.pete, target: [14, 14],
        prompt: "An old man's open hand seen from directly above, palm down on a bar counter, fingers spread, pale skin (#e2b48c). Simple bold shape." },
    ],
  },
  {
    title: 'Customers',
    tip: "Attach each customer's portrait (src/assets/portraits/<name>-any.webp, or sheriff-happy.webp). Each is drawn 32×28 in the game, rotated so the hands face the counter.",
    items: [
      { file: 'npc-sheriff.png', name: 'Sheriff', note: '', map: NPC_SPRITES.sheriff, pal: NPC_PAL.sheriff, scale: 6, attach: 'sheriff-happy.webp (portrait)', character: true, target: [32, 28],
        prompt: 'The sheriff from the portrait, but WITHOUT his hat (the first image still shows the old hat: replace it with short wavy brown hair; his hat lies on the bar in front of him). Short wavy brown hair, a thick brown walrus mustache, a stern face, brown leather vest over a white shirt, a red neckerchief, a silver star on the chest, both hands resting near the bottom edge.' },
      { file: 'npc-dutch.png', name: 'Dutch', note: '', map: NPC_SPRITES.dutch, pal: NPC_PAL.dutch, scale: 6, attach: 'dutch-any.webp (portrait)', character: true, target: [32, 28],
        prompt: 'Dutch from the attached portrait: a cheerful stocky man with rosy cheeks, a black bowler hat with a dark red band, a big ginger handlebar mustache, an olive-green coat over a mustard-yellow vest, both hands near the bottom edge.' },
      { file: 'npc-lavinia.png', name: 'Lavinia', note: '', map: NPC_SPRITES.lavinia, pal: NPC_PAL.lavinia, scale: 6, attach: 'lavinia-any.webp (portrait)', character: true, target: [32, 28],
        prompt: 'Miss Lavinia from the attached portrait: an elegant woman with a sly smile, a small purple hat with a pink feather, long dark curly hair, a mauve high-collared dress with a gold brooch, a small fan of cards in her hands near the bottom edge.' },
      { file: 'npc-twofist.png', name: 'Two-Fist', note: '', map: NPC_SPRITES.twofist, pal: NPC_PAL.twofist, scale: 6, attach: 'twofist-any.webp (portrait)', character: true, target: [32, 28],
        prompt: 'Two-Fist from the attached portrait: a lean gambler with dark stubble and a scar through one eyebrow, a black flat-brimmed hat with a red band, a black bandana, a dark red coat, a glass of rye in each hand near the bottom edge.' },
      { file: 'npc-pete.png', name: 'Pete', note: '', map: NPC_SPRITES.pete, pal: NPC_PAL.pete, scale: 6, attach: 'pete-any.webp (portrait)', character: true, target: [32, 28],
        prompt: 'Old Pete from the attached portrait: a sleepy old man with half-closed eyes, a droopy brown slouch hat, bushy white eyebrows, a long white beard, a worn grey coat, arms folded near the bottom edge.' },
    ],
  },
];

const size = (it: Entry) => it.target ?? [it.map[0].length, it.map.length];
const refName = (it: Entry) => it.file.replace(/\.png$/, '-ref.png');
/** What to attach: the reference first; characters also get their portrait (or first pose) second. */
const attachments = (it: Entry) => [`${refName(it)} (first)`, ...(it.character && it.attach ? [`${it.attach} (second)`] : [])].join(' + ');
const full = (it: Entry) => `${REF(size(it)[0], size(it)[1])} ${it.character ? "Use the SECOND attached image only for the character's look and colours, not its size or detail. " : ''}${it.prompt}`;
void STYLE; // kept for reference: the old words-only style block

// ---- Reference images: the current sprite blown up on its in-game grid, on magenta ----
function crc32(buf: Buffer) {
  let crc = 0xffffffff;
  for (const b of buf) { let c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w: number, h: number, px: (x: number, y: number) => [number, number, number]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 3 + 1) + 1 + x * 3);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function writeRef(it: Entry) {
  const [w, h] = size(it), mw = it.map[0].length, mh = it.map.length;
  const BLOCK = Math.max(8, Math.floor(512 / Math.max(w, h))), M = 2; // 2 blocks of magenta around it
  const W2 = (w + 2 * M) * BLOCK, H2 = (h + 2 * M) * BLOCK;
  // Characters are drawn in the game with the renderer's EPX upscale and shading: use exactly that.
  const shaded = it.character ? smoothShaded(it.map, it.pal) : null;
  const buf = png(W2, H2, (x, y) => {
    const gx = Math.floor(x / BLOCK) - M, gy = Math.floor(y / BLOCK) - M;
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return [255, 0, 255];
    if (shaded) { const c = shaded[gy]?.[gx]; return c ? hex(c) : [255, 0, 255]; }
    const ch = it.map[Math.floor((gy * mh) / h)][Math.floor((gx * mw) / w)];
    return ch === '.' ? [255, 0, 255] : hex(it.pal[ch] ?? '#ff00ff');
  });
  writeFileSync(new URL(`../art/sprite-refs/${refName(it)}`, import.meta.url), buf);
}
mkdirSync(new URL('../art/sprite-refs/', import.meta.url), { recursive: true });
for (const sec of sections) for (const it of sec.items) writeRef(it);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** One sprite as SVG rects. */
function spriteSvg(it: Entry, sc: number) {
  const w = it.map[0].length * sc, h = it.map.length * sc;
  const rects: string[] = [];
  it.map.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.') rects.push(`<rect x="${c * sc}" y="${r * sc}" width="${sc}" height="${sc}" fill="${it.pal[ch] ?? '#ff00ff'}"/>`);
  }));
  return { w, h, body: rects.join('') };
}

// ---- 1. The plain sheet (SVG) ----
{
  const S = 10, CELL_W = 190, PAD = 24, COLS = 6;
  let y = PAD;
  const parts: string[] = [`<text x="${PAD}" y="${y + 22}" font-family="monospace" font-size="24" font-weight="700" fill="#f6dc8f">LAST ORDERS · SPRITES</text>`];
  y += 46;
  for (const sec of sections) {
    parts.push(`<text x="${PAD}" y="${y + 16}" font-family="monospace" font-size="14" font-weight="700" fill="#f2b53a">${esc(sec.title.toUpperCase())}</text>`);
    y += 28;
    const rowH = Math.max(...sec.items.map((it) => it.map.length * (it.scale ?? S))) + 56;
    sec.items.forEach((it, i) => {
      const sc = it.scale ?? S, sp = spriteSvg(it, sc);
      const x0 = PAD + (i % COLS) * CELL_W, y0 = y + Math.floor(i / COLS) * rowH;
      parts.push(`<rect x="${x0 + 4}" y="${y0}" width="${CELL_W - 8}" height="${rowH - 8}" fill="#2e1c12" stroke="#5a3a24" stroke-width="2"/>`);
      parts.push(`<g transform="translate(${x0 + (CELL_W - sp.w) / 2},${y0 + 8 + (rowH - 56 - sp.h) / 2})">${sp.body}</g>`);
      parts.push(`<text x="${x0 + CELL_W / 2}" y="${y0 + rowH - 30}" text-anchor="middle" font-family="monospace" font-size="13" font-weight="700" fill="#f3e6cc">${esc(it.name)}</text>`);
      if (it.note) parts.push(`<text x="${x0 + CELL_W / 2}" y="${y0 + rowH - 14}" text-anchor="middle" font-family="monospace" font-size="10" fill="#cdb894">${esc(it.note)}</text>`);
    });
    y += Math.ceil(sec.items.length / COLS) * rowH + 18;
  }
  const width = PAD * 2 + COLS * CELL_W;
  writeFileSync(new URL('../art/sprite-sheet.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y + PAD}" viewBox="0 0 ${width} ${y + PAD}" shape-rendering="crispEdges">
<rect width="100%" height="100%" fill="#1d110b"/>
${parts.join('\n')}
</svg>`);
}

// ---- 2. The prompt page (HTML): each sprite with its full prompt and a Copy button ----
{
  const cards = sections.map((sec) => `
  <h2>${esc(sec.title)}</h2>${sec.tip ? `\n  <p class="tip">${esc(sec.tip)}</p>` : ''}
  <div class="grid">${sec.items.map((it) => {
    const sp = spriteSvg(it, it.scale ?? 8);
    return `
    <article>
      <div class="art"><svg width="${sp.w}" height="${sp.h}" viewBox="0 0 ${sp.w} ${sp.h}" shape-rendering="crispEdges">${sp.body}</svg></div>
      <div class="meta"><h3>${esc(it.name)}</h3><p class="file">Save as <b>${esc(it.file)}</b> · game size ${size(it)[0]}×${size(it)[1]} px · attach <b>${esc(attachments(it))}</b></p></div>
      <textarea readonly rows="7">${esc(full(it))}</textarea>
      <button type="button">Copy prompt</button>
    </article>`;
  }).join('')}
  </div>`).join('');
  writeFileSync(new URL('../art/sprite-prompts.html', import.meta.url), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sprite prompts</title>
<style>
  body { margin: 0; padding: 20px; background: #1d110b; color: #f3e6cc; font: 14px/1.4 system-ui, sans-serif; }
  h1 { margin: 0 0 6px; color: #f6dc8f; font: 700 22px monospace; }
  .intro { margin: 0 0 18px; color: #cdb894; max-width: 820px; }
  h2 { margin: 22px 0 4px; color: #f2b53a; font: 700 15px monospace; text-transform: uppercase; }
  .tip { margin: 0 0 10px; color: #cdb894; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
  article { display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; padding: 12px; background: #2e1c12; border: 2px solid #5a3a24; }
  .art { display: grid; place-items: center; min-width: 110px; min-height: 90px; background: #1a0f0a; border: 2px solid #5a3a24; }
  .meta h3 { margin: 0; font: 700 14px monospace; color: #f3e6cc; }
  .file { margin: 4px 0 0; font-size: 12px; color: #cdb894; }
  textarea { grid-column: 1 / -1; width: 100%; box-sizing: border-box; resize: vertical; padding: 8px; background: #1a0f0a; color: #f3e6cc;
    border: 1px solid #5a3a24; font: 12px/1.4 ui-monospace, monospace; }
  button { grid-column: 1 / -1; justify-self: start; padding: 6px 14px; background: #d9a441; color: #1a0f0a; border: 2px solid #1a0f0a; font: 700 12px monospace; cursor: pointer; }
  button.done { background: #6dbb4a; }
</style></head>
<body>
<h1>LAST ORDERS · SPRITE PROMPTS</h1>
<p class="intro">Each card shows the sprite as it is in the game now, and a complete prompt to regenerate it: copy, paste into Gemini (or any image model), one image per prompt. Attach what the card says when it names a file. Send the results back one per message, or save them in <b>art/new-sprites/</b> with the file name shown.</p>
${cards}
<script>
document.querySelectorAll('article button').forEach((b) => b.addEventListener('click', async () => {
  const t = b.parentElement.querySelector('textarea');
  try { await navigator.clipboard.writeText(t.value); } catch { t.select(); document.execCommand('copy'); }
  b.textContent = 'Copied'; b.classList.add('done');
  setTimeout(() => { b.textContent = 'Copy prompt'; b.classList.remove('done'); }, 1500);
}));
</script>
</body></html>`);
}

// ---- 3. The same prompts as Markdown ----
{
  const md = [`# Item sprites: copy-paste prompts`, '',
    'Generated by `npx tsx scripts/sprite-sheet.ts`. Easier to use: open `art/sprite-prompts.html` (each sprite with its prompt and a Copy button).', '',
    'One image per prompt. Where it says "Attach", add that image to the chat first. Send the results back one per message, or save them in `art/new-sprites/` with the file name shown.', '',
    ...sections.flatMap((sec) => [`## ${sec.title}`, '', ...(sec.tip ? [sec.tip, ''] : []),
      ...sec.items.flatMap((it) => [`### ${it.file} (${it.name}, shrinks to ${size(it)[0]}×${size(it)[1]} px)`, '',
        `Attach: ${attachments(it)}`, '', '```', full(it), '```', ''])])];
  writeFileSync(new URL('../art/SPRITE_PROMPTS.md', import.meta.url), md.join('\n'));
}
console.log('wrote art/sprite-sheet.svg, art/sprite-prompts.html, art/SPRITE_PROMPTS.md');
