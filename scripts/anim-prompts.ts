// Reference pictures and copy-paste prompts for customer animations (Pete eating peanuts,
// the others drinking), in the same style as the approved Gemini sprites.
// Usage: npx tsx scripts/anim-prompts.ts
//   -> art/anim-refs/<file>-ref.png  (the current game sprite three times on its 32×28 grid, on magenta)
//   -> art/anim-prompts.html         (each animation with its reference, prompt and a Copy button)
//   -> art/ANIM_PROMPTS.md           (the same prompts as text)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

type Anim = { file: string; name: string; base: string; note: string; frames: [string, string, string]; extra?: string };

const ANIMS: Anim[] = [
  {
    file: 'anim-pete-peanuts.png', name: 'Old Pete eats peanuts', base: 'npc-pete-drop.png',
    note: 'Plays when the peanut bowl reaches Pete.',
    extra: 'He is awake and happy now, not surprised: eyes open or closed with pleasure, a small smile under the beard.',
    frames: [
      'he reaches one hand forward to the bottom edge and picks up a single peanut in its shell, eyes wide and pleased',
      'he holds the peanut up to his mouth with both hands and cracks it open, eyes shut, smiling',
      'he munches happily with puffed-out cheeks, eyes shut, a few tiny tan shell crumbs falling onto his beard',
    ],
  },
  {
    file: 'anim-sheriff-drink.png', name: 'Sheriff drinks whiskey', base: 'npc-sheriff.png',
    note: 'Plays when his whiskey reaches him.',
    frames: [
      'he picks up a short glass of amber whiskey (#c77b2e) from the bottom edge with one hand, still stern',
      'he tips the glass up to his mouth under the mustache and drinks, eyes half closed',
      'he lowers the empty glass back toward the bottom edge and gives a small satisfied nod, mustache raised by a faint smile',
    ],
  },
  {
    file: 'anim-dutch-drink.png', name: 'Dutch drinks beer', base: 'npc-dutch.png',
    note: 'Plays when his beer reaches him.',
    frames: [
      'he grabs a glass beer mug of golden beer (#e8b24a) with a white foam head from the bottom edge by its handle, grinning',
      'he tips the mug up to his mouth and gulps, eyes shut, rosy cheeks puffed',
      'he lowers the empty mug, a white foam moustache on his ginger mustache, laughing with his eyes closed',
    ],
  },
  {
    file: 'anim-lavinia-drink.png', name: 'Lavinia drinks sarsaparilla', base: 'npc-lavinia.png',
    note: 'Plays when her sarsaparilla reaches her.',
    frames: [
      'she lifts a short glass of very dark brown sarsaparilla (#5a2c17) from the bottom edge, little finger raised, sly smile',
      'she takes a dainty sip from the glass, eyes closed',
      'she lowers the glass to the bottom edge and gives a sly, satisfied smile with one eyebrow raised',
    ],
  },
  {
    file: 'anim-twofist-drink.png', name: 'Two-Fist drinks rye', base: 'npc-twofist.png',
    note: 'Plays when his rye reaches him.',
    frames: [
      'he holds a short glass of reddish-brown rye (#b5652c) in each hand near the bottom edge, smirking',
      'he knocks back the glass in one hand, head tipped, the other glass still held near the bottom edge',
      'he slams the empty glass back down at the bottom edge and lifts the full one, grinning',
    ],
  },
];

const RULES = 'An outline exactly one block thick in dark brown (#1a0f0a) around the whole shape. Every block is one flat colour. No detail smaller than one block, no thin lines, no smooth shading, '
  + 'no gradients, no anti-aliasing, no blur, no text, at most 10 colours.';

const prompt = (a: Anim) => [
  'Redraw the attached image as a 3-frame pixel-art animation strip for a western saloon game.',
  'The attached image shows the same tiny game sprite three times side by side, each on an EXACT grid of 32 blocks wide by 28 blocks tall, shown blown up so every pixel is a big square block.',
  'Keep exactly that layout: three frames side by side, each the same 32 by 28 block grid, the same size, position, angle and colours as the attached sprite, separated by thin dark vertical lines.',
  "The character stays exactly the same in all three frames, viewed from a steep top-down angle looking down at the character's head, shoulders, and hands reaching forward toward the bottom edge, with no desk, table, or legs shown.",
  ...(a.extra ? [a.extra] : []),
  `Frame 1 (left): ${a.frames[0]}.`,
  `Frame 2 (middle): ${a.frames[1]}.`,
  `Frame 3 (right): ${a.frames[2]}.`,
  'Only the face, arms, hands and what they hold change between frames.',
  RULES,
  'No motion lines, sparkles, exclamation marks, impact stars or other effects: only the character. Output it blown up, filling the image, on one flat solid magenta background (#FF00FF) with nothing else in it.',
].join(' ');

// ---- minimal PNG read (8-bit RGBA, non-interlaced: what the game sprites are) and write ----
function readPng(path: URL) {
  const buf = readFileSync(path);
  let pos = 8, w = 0, h = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[9] !== 6) throw new Error(`${path}: expected 8-bit RGBA`); }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0;
      out[y * stride + x] = (line[x] + pred) & 0xff;
    }
  }
  return { w, h, px: (x: number, y: number) => [...out.subarray(y * stride + x * 4, y * stride + x * 4 + 4)] as [number, number, number, number] };
}
function crc32(buf: Buffer) {
  let crc = 0xffffffff;
  for (const b of buf) { let c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, body: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePng(w: number, h: number, px: (x: number, y: number) => [number, number, number]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 3 + 1) + 1 + x * 3);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Reference: three copies of the sprite, each 32×28 blocks of 20 px with 2 blocks of magenta round it, 4 px dark lines between.
const BLOCK = 20, M = 2, LINE = 4;
function strip(base: string) {
  const s = readPng(new URL(`../src/assets/sprites/${base}`, import.meta.url));
  const PW = (s.w + 2 * M) * BLOCK, PH = (s.h + 2 * M) * BLOCK, W = 3 * PW + 2 * LINE;
  return writePng(W, PH, (x, y) => {
    const panel = Math.floor(x / (PW + LINE)), lx = x - panel * (PW + LINE);
    if (lx >= PW) return [26, 15, 10];
    const gx = Math.floor(lx / BLOCK) - M, gy = Math.floor(y / BLOCK) - M;
    if (gx < 0 || gy < 0 || gx >= s.w || gy >= s.h) return [255, 0, 255];
    const [r, g, b, a] = s.px(gx, gy);
    return a < 128 ? [255, 0, 255] : [r, g, b];
  });
}

mkdirSync(new URL('../art/anim-refs/', import.meta.url), { recursive: true });
const refs = new Map<string, Buffer>();
for (const a of ANIMS) {
  const buf = strip(a.base);
  refs.set(a.file, buf);
  writeFileSync(new URL(`../art/anim-refs/${a.file.replace(/\.png$/, '-ref.png')}`, import.meta.url), buf);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cards = ANIMS.map((a) => `
  <article>
    <h3>${esc(a.name)}</h3>
    <p class="file">${esc(a.note)} Save the result as <b>art/new-sprites/${esc(a.file)}</b>. Attach the reference below.</p>
    <figure class="art"><img src="data:image/png;base64,${refs.get(a.file)!.toString('base64')}" alt="${esc(a.name)} reference"><figcaption>Reference (current sprite ×3): right-click › Copy image, paste into Gemini</figcaption></figure>
    <textarea readonly rows="9">${esc(prompt(a))}</textarea>
    <button type="button">Copy prompt</button>
  </article>`).join('');

writeFileSync(new URL('../art/anim-prompts.html', import.meta.url), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Animation prompts</title>
<style>
  body { margin: 0; padding: 20px; background: #1d110b; color: #f3e6cc; font: 14px/1.4 system-ui, sans-serif; }
  h1 { margin: 0 0 6px; color: #f6dc8f; font: 700 22px monospace; }
  .intro { margin: 0 0 18px; color: #cdb894; max-width: 820px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
  article { display: grid; gap: 8px; padding: 12px; background: #2e1c12; border: 2px solid #5a3a24; }
  h3 { margin: 0; font: 700 14px monospace; color: #f2b53a; }
  .file { margin: 0; font-size: 12px; color: #cdb894; }
  .art { margin: 0; }
  .art img { display: block; width: 100%; height: auto; image-rendering: pixelated; border: 2px solid #5a3a24; }
  .art figcaption { margin-top: 3px; font-size: 11px; color: #cdb894; }
  textarea { width: 100%; box-sizing: border-box; resize: vertical; padding: 8px; background: #1a0f0a; color: #f3e6cc; border: 1px solid #5a3a24; font: 12px/1.4 ui-monospace, monospace; }
  button { justify-self: start; padding: 6px 14px; background: #d9a441; color: #1a0f0a; border: 2px solid #1a0f0a; font: 700 12px monospace; cursor: pointer; }
  button.done { background: #6dbb4a; }
</style></head>
<body>
<h1>LAST ORDERS · ANIMATION PROMPTS</h1>
<p class="intro">One card per animation. Copy the reference picture into Gemini, then copy the prompt, one animation per chat. Each result is a strip of 3 frames on the same 32×28 grid as the game sprite. Send the result back, or save it in <b>art/new-sprites/</b> with the name shown.</p>
<div class="grid">${cards}
</div>
<script>
document.querySelectorAll('article button').forEach((b) => b.addEventListener('click', async () => {
  const t = b.parentElement.querySelector('textarea');
  try { await navigator.clipboard.writeText(t.value); } catch { t.select(); document.execCommand('copy'); }
  b.textContent = 'Copied'; b.classList.add('done');
  setTimeout(() => { b.textContent = 'Copy prompt'; b.classList.remove('done'); }, 1500);
}));
</script>
</body></html>`);

writeFileSync(new URL('../art/ANIM_PROMPTS.md', import.meta.url), [
  '# Animation prompts', '',
  'Generated by `npx tsx scripts/anim-prompts.ts`. Easier to use: open `art/anim-prompts.html`.', '',
  'Attach the reference (`art/anim-refs/<file>-ref.png`), paste the prompt, one animation per chat.', '',
  ...ANIMS.flatMap((a) => [`## ${a.name}`, '', `${a.note} Save as \`art/new-sprites/${a.file}\`. Attach \`art/anim-refs/${a.file.replace(/\.png$/, '-ref.png')}\`.`, '', '```', prompt(a), '```', '']),
].join('\n'));
console.log('wrote art/anim-refs/*, art/anim-prompts.html, art/ANIM_PROMPTS.md');
