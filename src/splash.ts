// Inline launch card. Reddit's inline post frame is too small for a precision game, so
// "Play" opens the game (devvit.json entrypoint "game") in Reddit's expanded view.
// Outside Reddit it simply goes to the game page.
import { requestExpandedMode } from '@devvit/web/client';
import portrait from './assets/portraits/dutch-any.webp';
import type { DailyNight } from './daily';

const $ = (id: string) => document.getElementById(id)!;
($('who') as HTMLImageElement).src = portrait;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

void getJson<DailyNight>('/api/night').then((n) => {
  if (!n?.level) return;
  $('night').textContent = `NIGHT ${n.level.night} · ${n.level.title.toUpperCase()}`;
  if (n.level.blurb) $('blurb').textContent = n.level.blurb;
});

function play(e: MouseEvent) {
  try {
    requestExpandedMode(e, 'game');
  } catch {
    location.href = 'index.html';
  }
}
// The whole card is the button, so a tap anywhere starts the game.
$('splash').addEventListener('click', play);
