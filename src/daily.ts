// Tonight's night for the player. On Reddit the server hands it out; anywhere else the game
// reads the packed calendar shipped next to it. If neither has the date, a handmade night
// stands in, so there is always something to play.
import { LEVELS, type Level } from './levels';
import { dayIndex, todayKey } from './generator';
import type { Shot } from './sim';

/** The first night players see. Night numbers count from here. */
export const LAUNCH = '2026-12-01';

export interface DailyNight {
  date: string;
  level: Level;
  /** A proven way to serve everyone (used by "Show me how"). */
  solution?: Shot[];
  /** Share of simulated average players who clear it, and the night's signature twist. */
  metrics?: { clear: number; signature: string };
  /** True when no tested map was available and a handmade night stands in. */
  fallback?: boolean;
}

export function nightNumber(date: string): number {
  return Math.max(1, Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(LAUNCH + 'T00:00:00Z')) / 864e5) + 1);
}

// The scene line in tonight's intro ("3 orders tonight. <scene>"). The calendar was built with
// only 8 lines, so players saw repeats within days. The line is now picked when the night is
// served, walking through this list one step per day: no line comes back within 24 days.
// Only the text changes; the stored map, its solution and its hash are untouched.
const SCENES = [
  'The stagecoach just pulled in.', 'A cattle drive came through at noon.', 'The piano player is late again.',
  'Somebody hit a seam of silver.', 'It is too hot to argue.', 'The church social let out early.',
  'A drifter is asking about the safe.', 'The mail coach brought news from back east.', 'Somebody bet their boots.',
  'Dust has been blowing in all day.', 'The sheriff is in a mood.', 'Two cowhands are arguing about a horse.',
  'The roof is leaking over the far end.', 'A travelling preacher is eyeing the bottles.', 'It is payday at the mine.',
  'Somebody swears they saw a ghost on the ridge.', 'The fiddler brought a friend.', 'The new sign finally went up.',
  'A rainstorm drove everyone inside.', 'There is a wedding party next door.', 'Somebody owes Lavinia money.',
  'The town council meets tomorrow.', 'A photographer wants a picture of the bar.', 'Old Pete claims it is his birthday.',
];

export function sceneFor(date: string): string {
  const day = Math.floor(Date.parse(date + 'T00:00:00Z') / 864e5);
  return SCENES[((day % SCENES.length) + SCENES.length) % SCENES.length];
}

/** Swaps the scene line of a generated night's intro for the one picked for its date. */
export function withScene<T extends { blurb: string }>(level: T, date: string): T {
  const m = /^(\d+ orders? tonight\.) /.exec(level.blurb);
  return m ? { ...level, blurb: `${m[1]} ${sceneFor(date)}` } : level;
}

/** The date to play: `?date=YYYY-MM-DD` or `#YYYY-MM-DD` (for testing and previews) or today in UTC. */
export function requestedDate(): string {
  const q = new URLSearchParams(location.search).get('date') ?? location.hash.replace('#', '');
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayKey();
}

async function getJson(url: string, ms: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchNight(date: string): Promise<DailyNight> {
  const found = (await getJson(`/api/night?date=${date}`, 2500)) as DailyNight | null;
  let night: DailyNight | null = found && 'level' in found ? found : null;
  if (!night) {
    const cal = (await getJson('nights.json', 2500)) as { nights?: DailyNight[] } | null;
    const n = cal?.nights?.find((x) => x.date === date);
    if (n && !n.fallback && n.level) night = n;
  }
  if (!night) {
    const hand = LEVELS[dayIndex(date) % LEVELS.length];
    night = { date, level: { ...hand }, fallback: true };
  }
  night.level = { ...withScene(night.level, date), id: `daily-${date}`, night: nightNumber(date) };
  return night;
}
