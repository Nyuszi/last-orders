// Usage: node scripts/sheet.cjs 2026-12-09 7   (needs `npm run build` and a running `npx vite preview --port 4173`)
// One image of a week of nights with their stats, to look over before they go live.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [start, days = '7'] = process.argv.slice(2);
const cal = JSON.parse(fs.readFileSync(path.join(__dirname, '../calendar/nights.json'), 'utf8'));
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const cards = [];
  for (let d = 0; d < Number(days); d++) {
    const date = new Date(Date.parse(start + 'T00:00:00Z') + d * 864e5).toISOString().slice(0, 10);
    await p.goto(`http://localhost:4173/?date=${date}`);
    await p.waitForFunction(() => document.querySelector('#nights .today'), null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(600);
    const box = await p.locator('#board').boundingBox();
    const img = (await p.screenshot({ clip: box })).toString('base64');
    const n = cal.nights.find((x) => x.date === date);
    const v = n && !n.fallback ? n.versions[n.pick] : null;
    const m = v && v.metrics;
    const stats = m ? `${v.level.title} · ${v.level.orders.length} orders · average player clears ${(m.clear * 100).toFixed(0)}% · ${m.pours.toFixed(1)} pours · banks ${m.banks} · straight shot fails ${m.naiveFails}` : 'Handmade fallback night';
    const per = m ? m.orders.map((o, i) => `#${i + 1} ${(o.expert * 100).toFixed(0)}/${(o.average * 100).toFixed(0)}/${(o.novice * 100).toFixed(0)}%`).join('  ') : '';
    cards.push({ date, day: DAY[new Date(date + 'T00:00:00Z').getUTCDay()], img, stats, per, versions: n && n.versions ? n.versions.length : 0 });
  }
  const html = `<html><head><style>
    body{margin:0;background:#1d130d;color:#f1e4cc;font:14px system-ui;display:grid;grid-template-columns:repeat(${Math.min(7, cards.length)},300px);gap:14px;padding:16px}
    .c{display:grid;gap:6px;align-content:start} img{width:300px;border:2px solid #4f3824} h3{margin:0;font:700 16px system-ui;color:#e2b45a}
    p{margin:0;font-size:12px;line-height:1.35;color:#d9c7a8} .s{color:#b89f80}</style></head><body>
    ${cards.map((c) => `<div class="c"><h3>${c.day} ${c.date}</h3><img src="data:image/png;base64,${c.img}"><p>${c.stats}</p><p class="s">Per order expert/average/novice: ${c.per}</p><p class="s">${c.versions} tested version(s) stored</p></div>`).join('')}
  </body></html>`;
  const q = await b.newPage({ viewport: { width: 32 + cards.length * 314, height: 900 }, deviceScaleFactor: 1 });
  await q.setContent(html);
  await q.waitForTimeout(300);
  const out = path.join(__dirname, `../calendar/sheet-${start}.png`);
  await q.screenshot({ path: out, fullPage: true });
  console.log(out);
  await b.close();
})();
