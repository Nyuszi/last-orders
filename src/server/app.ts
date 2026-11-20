// The Last Orders server on Reddit: serves tonight's night, keeps stats and streaks,
// posts a new night every day and gives moderators a few safety switches.
import express from 'express';
import { context, reddit, redis } from '@devvit/web/server';
import { createTelemetryRouter } from '@devvit/analytics/server/reddit';
import { todayKey } from '../generator';
import { nightNumber } from '../daily';
import { CALENDAR_END, daysLeft, key, nightFor } from './nights';

export const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(createTelemetryRouter());

const DAY_S = 86400;
const KEEP_S = 30 * DAY_S; // per-player data is kept for 30 days, as the Devvit rules recommend

/** The date this post is for (set when the post is made), or today in UTC. */
function postDate(): string {
  const d = (context.postData as { date?: string } | undefined)?.date;
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayKey();
}

// ---------------- Player endpoints ----------------

app.get('/api/night', async (_req, res) => {
  res.json(await nightFor(postDate()));
});

interface ResultReq { tries: number; won: boolean; pours: number; tips: number; help: boolean }

/** Called once per finished night attempt. Counts players, clears, tries and streaks. */
app.post('/api/result', async (req, res) => {
  const date = postDate();
  const user = context.userId;
  const r = req.body as ResultReq;
  const tries = Math.max(1, Math.min(99, Math.floor(Number(r.tries) || 1)));
  const stats = `stats:${date}`;
  if (user) {
    const first = await redis.hSetNX(`played:${date}`, user, '1');
    if (first) await redis.hIncrBy(stats, 'players', 1);
    await redis.expire(`played:${date}`, KEEP_S);
    if (r.won && !r.help && (await redis.hSetNX(`cleared:${date}`, user, String(tries)))) {
      await redis.hIncrBy(stats, 'clears', 1);
      await redis.hIncrBy(stats, `tries${Math.min(tries, 7)}`, 1);
      await redis.hIncrBy(stats, 'triesSum', tries);
      // Streak: nights cleared in a row (by UTC date).
      const s = await redis.hGetAll(`streak:${user}`);
      const yesterday = new Date(Date.parse(date + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
      const count = s.last === yesterday ? Number(s.count ?? 0) + 1 : s.last === date ? Number(s.count ?? 1) : 1;
      await redis.hSet(`streak:${user}`, { last: date, count: String(count), best: String(Math.max(count, Number(s.best ?? 0))) });
      await redis.expire(`streak:${user}`, KEEP_S);
    }
    await redis.expire(`cleared:${date}`, KEEP_S);
  }
  res.json(await statsFor(date, user));
});

async function statsFor(date: string, user?: string) {
  const s = await redis.hGetAll(`stats:${date}`);
  const players = Number(s.players ?? 0), clears = Number(s.clears ?? 0);
  const streak = user ? await redis.hGetAll(`streak:${user}`) : {};
  return {
    date,
    players,
    clearRate: players ? clears / players : 0,
    avgTries: clears ? Number(s.triesSum ?? 0) / clears : 0,
    tries: [1, 2, 3, 4, 5, 6, 7].map((t) => Number(s[`tries${t}`] ?? 0)),
    streak: streak.last === date || streak.last === new Date(Date.parse(date + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10) ? Number(streak.count ?? 0) : 0,
    best: Number(streak.best ?? 0),
  };
}

app.get('/api/stats', async (_req, res) => {
  res.json(await statsFor(postDate(), context.userId));
});

/** "Share my result": the player's own spoiler-free summary, as a reply to the night's pinned comment. */
app.post('/api/share', async (req, res) => {
  const text = String((req.body as { text?: string }).text ?? '').slice(0, 600);
  // Only the game's own share format is accepted, so this can't be used to post arbitrary text.
  if (!/^LAST ORDERS · Night \d+/.test(text)) { res.status(400).json({ error: 'not a Last Orders result' }); return; }
  const date = postDate();
  const parent = (await redis.get(`pin:${date}`)) ?? context.postId;
  if (!parent) { res.status(400).json({ error: 'no post' }); return; }
  // Reddit markdown joins single newlines into one line; two trailing spaces force a line break.
  const body = text.split('\n').map((l) => l.trimEnd()).join('  \n');
  const comment = await reddit.submitComment({ id: parent as `t1_${string}` | `t3_${string}`, text: body, runAs: 'USER' });
  res.json({ ok: true, id: comment.id });
});

// ---------------- Daily post ----------------

/** Posts the night for `date` once. Safe to call again: the second call does nothing. */
async function postNight(date: string): Promise<string | null> {
  if (await redis.get(key.paused)) return null;
  const fresh = await redis.set(key.posted(date), new Date().toISOString(), { nx: true });
  if (!fresh) return (await redis.get(key.post(date))) ?? null;
  try {
    const night = await nightFor(date);
    const post = await reddit.submitCustomPost({
      subredditName: context.subredditName!,
      title: `Last Orders · Night ${nightNumber(date)} · ${night.level.title}`,
      entry: 'default',
      postData: { date },
    });
    await redis.set(key.post(date), post.id);
    try {
      const pin = await reddit.submitComment({ id: post.id, text: `**Share your night here.** Finish the night, then tap *Share* on the result card. No spoilers, just your pours and tries.`, runAs: 'APP' });
      await pin.distinguish(true);
      await redis.set(`pin:${date}`, pin.id);
    } catch (e) {
      console.error('could not pin the share comment', e);
    }
    return post.id;
  } catch (e) {
    await redis.del(key.posted(date)); // let the watchdog try again
    throw e;
  }
}

app.post('/internal/scheduler/daily-post', async (_req, res) => {
  await postNight(todayKey());
  res.json({ status: 'ok' });
});

/** Hourly: if today's post is missing (a failed or skipped run), make it now. */
app.post('/internal/scheduler/watchdog', async (_req, res) => {
  const date = todayKey();
  if (!(await redis.get(key.post(date)))) await postNight(date);
  res.json({ status: 'ok' });
});

app.post('/internal/on/app/install', async (_req, res) => {
  await postNight(todayKey());
  res.json({ status: 'ok' });
});

// ---------------- Moderator menu ----------------

const toast = (text: string, appearance: 'success' | 'neutral' = 'success') => ({ showToast: { text, appearance } });

app.post('/internal/menu/post-tonight', async (_req, res) => {
  const date = todayKey();
  const id = await postNight(date);
  const url = id ? `https://www.reddit.com/r/${context.subredditName}/comments/${id.replace('t3_', '')}` : undefined;
  res.json(id ? { ...toast(`Night ${nightNumber(date)} is up.`), navigateTo: url } : toast('Posting is paused. Use "Resume daily posts" first.', 'neutral'));
});

app.post('/internal/menu/replace-tonight', async (_req, res) => {
  const date = postDate();
  const on = (await redis.get(key.override(date))) === 'fallback';
  if (on) await redis.del(key.override(date)); else await redis.set(key.override(date), 'fallback');
  res.json(toast(on ? `Night ${nightNumber(date)} is back to the generated map.` : `Night ${nightNumber(date)} now uses a handmade night. Players' tries carry on.`));
});

app.post('/internal/menu/toggle-pause', async (_req, res) => {
  const paused = !!(await redis.get(key.paused));
  if (paused) await redis.del(key.paused); else await redis.set(key.paused, '1');
  res.json(toast(paused ? 'Daily posts resumed.' : 'Daily posts paused. Nothing new is posted until you resume.'));
});

app.post('/internal/menu/calendar-status', async (_req, res) => {
  const left = daysLeft(todayKey());
  res.json(toast(left < 60 ? `Only ${left} days of tested nights left (to ${CALENDAR_END}). Time to build more.` : `${left} days of tested nights ready (to ${CALENDAR_END}).`, left < 60 ? 'neutral' : 'success'));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'server error' });
});
