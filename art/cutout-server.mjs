// Portrait cut-out tool that needs no Python: `node art/cutout-server.mjs`, then open
// http://localhost:5199. Every image in art/new/ is keyed off its flat magenta background in
// the browser (same rules as art/cutout.py), scaled to 300 px tall and saved as
// src/assets/portraits/<name>.webp, plus a preview PNG on the saloon floor colour in art/new/out/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ART = path.dirname(fileURLToPath(import.meta.url));
const NEW = path.join(ART, 'new');
const OUT = path.join(ART, 'new', 'out');
const PORTRAITS = path.join(ART, '..', 'src', 'assets', 'portraits');
const TYPES = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const safe = (n) => /^[a-z]+-(angry|happy|surprised|sly|any)$/.test(n);

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') return send(res, 200, 'text/html', fs.readFileSync(path.join(ART, 'cutout.html')));
  if (url.pathname === '/list') {
    const files = fs.readdirSync(NEW).filter((f) => TYPES[path.extname(f).toLowerCase()] && safe(path.parse(f).name));
    return send(res, 200, 'application/json', JSON.stringify(files));
  }
  if (url.pathname.startsWith('/img/')) {
    const f = path.basename(decodeURIComponent(url.pathname.slice(5)));
    const p = path.join(NEW, f);
    if (!fs.existsSync(p)) return send(res, 404, 'text/plain', 'no');
    return send(res, 200, TYPES[path.extname(f).toLowerCase()] ?? 'application/octet-stream', fs.readFileSync(p));
  }
  // Gallery patching (art/gallery-fix.html): read gallery images and portraits, write gallery images.
  if (url.pathname === '/gallery-fix') return send(res, 200, 'text/html', fs.readFileSync(path.join(ART, 'gallery-fix.html')));
  if (url.pathname.startsWith('/asset/')) {
    const rel = decodeURIComponent(url.pathname.slice(7));
    const roots = ['submission/gallery/', 'src/assets/portraits/', 'art/new/out/'];
    if (!roots.some((r) => rel.startsWith(r)) || rel.includes('..')) return send(res, 403, 'text/plain', 'no');
    const p = path.join(ART, '..', rel);
    if (!fs.existsSync(p)) return send(res, 404, 'text/plain', 'no');
    return send(res, 200, TYPES[path.extname(p).toLowerCase()] ?? 'application/octet-stream', fs.readFileSync(p));
  }
  if (req.method === 'POST' && url.pathname === '/save-gallery') {
    const name = url.searchParams.get('name') ?? '';
    if (!/^\d-[a-z]+$/.test(name)) return send(res, 400, 'text/plain', 'bad name');
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const dst = path.join(ART, '..', 'submission', 'gallery', `${name}.png`);
      const backup = path.join(OUT, `${name}-OLD.png`);
      fs.mkdirSync(OUT, { recursive: true });
      if (!fs.existsSync(backup)) fs.copyFileSync(dst, backup);
      fs.writeFileSync(dst, Buffer.concat(chunks));
      console.log('saved', path.relative(path.join(ART, '..'), dst));
      send(res, 200, 'text/plain', 'ok');
    });
    return;
  }
  // Game sprites baked in a browser page (e.g. art/sprite-preview.html on the vite server):
  // POST the PNG as base64 text to /save-sprite?name=anim-dutch-drink-1 -> src/assets/sprites/<name>.png
  if (req.method === 'POST' && url.pathname === '/save-sprite') {
    const name = url.searchParams.get('name') ?? '';
    if (!/^(npc|anim|pete|item)-[a-z0-9-]+$/.test(name)) return send(res, 400, 'text/plain', 'bad name');
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const dst = path.join(ART, '..', 'src', 'assets', 'sprites', `${name}.png`);
      fs.writeFileSync(dst, Buffer.from(Buffer.concat(chunks).toString('ascii'), 'base64'));
      console.log('saved', path.relative(path.join(ART, '..'), dst));
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      res.end('ok');
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/save') {
    const name = url.searchParams.get('name') ?? '', kind = url.searchParams.get('kind');
    if (!safe(name) || !['webp', 'preview'].includes(kind)) return send(res, 400, 'text/plain', 'bad name');
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.mkdirSync(OUT, { recursive: true });
      const dst = kind === 'webp' ? path.join(PORTRAITS, `${name}.webp`) : path.join(OUT, `${name}-preview.png`);
      fs.writeFileSync(dst, Buffer.concat(chunks));
      console.log('saved', path.relative(path.join(ART, '..'), dst));
      send(res, 200, 'text/plain', 'ok');
    });
    return;
  }
  send(res, 404, 'text/plain', 'not found');
}).listen(5199, () => console.log('cut-out tool on http://localhost:5199'));

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type });
  res.end(body);
}
