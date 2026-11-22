// Inline launch card. Reddit's inline post frame is too small for a precision game, so
// "Play" opens the game (devvit.json entrypoint "game") in Reddit's expanded view.
// Outside Reddit it simply goes to the game page.
import { requestExpandedMode } from '@devvit/web/client';
import portrait from './assets/portraits/dutch-any.webp';
import type { DailyNight } from './daily';
import type { NightStats } from './reddit';

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

void getJson<NightStats>('/api/stats').then((s) => {
  if (!s || !s.players) return;
  const clears = Math.round(s.clearRate * s.players);
  $('stats').textContent = s.players === 1
    ? (clears ? '1 bartender has served everyone tonight' : '1 bartender has tried tonight')
    : `${s.players} bartenders tonight · ${clears === 0 ? 'nobody has served everyone yet' : s.players < 10 ? `${clears} served everyone` : `${Math.round(s.clearRate * 100)}% served everyone`}`;
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
