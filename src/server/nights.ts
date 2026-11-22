// Which night to serve for a date, in priority order:
//   1. a moderator override ("replace tonight with a handmade night")
//   2. the tested calendar shipped inside the app (the version picked for that date)
//   3. a handmade night, so there is always something to play
import { redis } from '@devvit/web/server';
import calendar from '../../calendar/server.json';
import { LEVELS } from '../levels';
import { dayIndex } from '../generator';
import { nightNumber, withScene, type DailyNight } from '../daily';
import type { Level } from '../levels';
import type { Shot } from '../sim';

interface Version { level: Level; solution: Shot[]; metrics: { clear: number; signature: string }; hash: string }
interface CalendarNight { date: string; fallback?: boolean; pick?: number; versions?: Version[] }
const NIGHTS = new Map<string, CalendarNight>((calendar as { nights: CalendarNight[] }).nights.map((n) => [n.date, n]));
export const CALENDAR_END: string = (calendar as { to: string }).to;

export const key = {
  override: (date: string) => `override:${date}`,
  posted: (date: string) => `posted:${date}`,
  post: (date: string) => `post:${date}`,
  paused: 'paused',
};

function handmade(date: string): DailyNight {
  const hand = LEVELS[dayIndex(date) % LEVELS.length];
  return { date, level: { ...hand }, fallback: true };
}

export async function nightFor(date: string): Promise<DailyNight> {
  let night: DailyNight;
  const override = await redis.get(key.override(date));
  const n = NIGHTS.get(date);
  if (override === 'fallback' || !n || n.fallback || !n.versions?.length) night = handmade(date);
  else {
    const v = n.versions[n.pick ?? 0];
    night = { date, level: v.level, solution: v.solution, metrics: { clear: v.metrics.clear, signature: v.metrics.signature } };
  }
  night.level = { ...withScene(night.level, date), id: `daily-${date}`, night: nightNumber(date) };
  return night;
}

/** How many days from `date` on have a tested night waiting. */
export function daysLeft(date: string): number {
  let n = 0;
  // Before the calendar starts (launch day), count from its first date instead of finding nothing.
  const first = (calendar as { nights: CalendarNight[] }).nights[0]?.date;
  const from = first && date < first ? first : date;
  for (let t = Date.parse(from + 'T00:00:00Z'); ; t += 864e5) {
    const d = new Date(t).toISOString().slice(0, 10);
    const c = NIGHTS.get(d);
    if (!c) return n;
    if (!c.fallback) n++;
  }
}
