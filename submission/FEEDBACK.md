# Devvit feedback survey: draft answers

Everything here happened while building Last Orders. Edit it into your own words, and add or remove
anything. The Feedback Award rewards specific, actionable feedback, so concrete beats polite.

## What went well

- `devvit upload` on a fresh account walked me through the developer-account setup, created the app,
  made a playtest subreddit and installed the app in one go. Very smooth first run.
- `devvit playtest` rebuilding and re-uploading on every change, with server logs streamed in the
  same terminal, made the fix-and-refresh loop fast.
- The playtest log said exactly what was wrong when Journeys events were rejected ("requires
  permissions.journeys to be enabled in devvit.json"). That message fixed the problem in one minute.

## What was hard or confusing

1. **The inline post is too small for an action game on desktop.** On a 1080p monitor the post frame
   was about 630×460 px, which made a precision game unplayable. The answer (an inline launch card plus
   `requestExpandedMode`) works well, but I only found it by reading the `.d.ts` files. A "games:
   start from a splash screen, play in expanded mode" pattern belongs in the quickstart template and
   the docs' first page about posts.
2. **`requestExpandedMode` and `getWebViewMode` are marked `@experimental`.** For hackathon entries
   it's unclear whether depending on them is safe. A note on stability, or "safe for production",
   would help.
3. **Journeys events are dropped in playtest versions** ("not recorded for playtest app versions").
   Since Journeys are a judging bonus, I'd love a way to see them during playtest, even only in the
   CLI, to check the instrumentation before the final upload.
4. **App name collisions.** `last-orders` was taken. The web form said so, but the CLI had already
   started. Checking the name from `devvit.json` before the browser step would save a round trip.
5. **Node version.** The current template's TypeScript needs Node 22+, but the CLI ran on Node 20
   until the build failed with an unrelated-looking `ERR_UNKNOWN_FILE_EXTENSION`. A Node version check
   in `devvit` itself would make this obvious.
6. **Playtest subreddits are created private**, but the hackathon requires a public one for judging.
   A reminder in the CLI's output, or an option to create it public, would prevent last-minute
   surprises.
7. **Reddit markdown in `submitComment`.** Multi-line text loses its line breaks (single newlines are
   merged). Obvious in hindsight, but a note in the `submitComment` docs would help anyone posting
   formatted game results.

## Feature requests

- An official "daily game" template: one post per UTC day, a pinned results thread, streaks, and a
  moderator override, since most entries rebuild the same thing.
- `devvit logs` filters for scheduler runs, to confirm a cron job fired without waiting for the next
  run.
