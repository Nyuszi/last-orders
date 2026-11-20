// Everything that only works inside Reddit: tonight's community stats, sharing to the
// comments and Devvit Journeys events. Outside Reddit (a plain web page) all of it quietly
// switches off and the game plays the same.
import { telemetry } from '@devvit/analytics/client/reddit';

export interface NightStats { players: number; clearRate: number; avgTries: number; tries: number[]; streak: number; best: number }

let reddit = false;
export const onReddit = () => reddit;

async function call<T>(url: string, body?: unknown): Promise<T | null> {
  try {
    const r = await fetch(url, body === undefined ? { headers: { Accept: 'application/json' } } : {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Finds out whether the game is running in a Reddit post (its server answers). */
export async function detectReddit(): Promise<boolean> {
  reddit = !!(await call<NightStats>('/api/stats'));
  if (reddit) void safe(() => telemetry.appReady());
  return reddit;
}

async function safe(f: () => Promise<unknown>) {
  try { await f(); } catch { /* telemetry is best-effort */ }
}

// Journeys: a journey is one try at tonight's night.
export const journey = {
  start: () => reddit && void safe(() => telemetry.startJourney()),
  served: (served: number, total: number) => reddit && void safe(() => telemetry.progress({ progress: Math.min(1, served / total), action: 'order_served' })),
  end: (won: boolean, tips: number) => reddit && void safe(() => telemetry.endJourney({ complete: won, game: { win: won, score: tips } })),
  share: () => reddit && void safe(() => telemetry.interaction({ action: 'share_result' })),
};

export function reportResult(r: { tries: number; won: boolean; pours: number; tips: number; help: boolean }): Promise<NightStats | null> {
  return reddit ? call<NightStats>('/api/result', r) : Promise.resolve(null);
}

export async function shareResult(text: string): Promise<boolean> {
  return !!(await call<{ ok: boolean }>('/api/share', { text }))?.ok;
}
