# Putting Last Orders on Reddit (on your PC)

Everything up to the Reddit login is done and tested in the cloud. These steps need your computer because the Devvit login opens your browser. Commands are for PowerShell on Windows; they're the same on a Mac.

## 1. Once

1. Install **Node.js 24 LTS** from nodejs.org. Check it with:
   ```
   node -v
   ```
2. Unzip `last-orders-backup.zip` to a normal folder, e.g. `C:\Users\<you>\code\last-orders`. Avoid a hidden folder or OneDrive.
3. In that folder:
   ```
   npm install
   npm test
   npm run build
   ```
   The tests should say `fail 0`. The build makes `dist/client` (the game) and `dist/server` (the Reddit server).
4. Log in to Reddit's developer tools. This opens your browser:
   ```
   npx devvit login
   ```
5. On Reddit, create the **demo subreddit**. It must be **public** with **fewer than 200 members** (hackathon rule), e.g. r/LastOrdersSaloon.

## 2. Upload and playtest (no publishing!)

```
npx devvit upload
```
The first upload creates the app. If the name `last-orders` is taken, change `"name"` in `devvit.json` (e.g. `last-orders-saloon`) and run it again. Your app link is then `https://developers.reddit.com/apps/<name>`, which goes on the Devpost form.

```
npx devvit playtest r/<your-subreddit>
```
This installs the app in your subreddit and reloads it when files change. Installing it posts tonight's night automatically. If no post appears, open the subreddit's **mod menu → "Last Orders: post tonight's night"**.

**Don't run `devvit publish`.** The hackathon asks apps to stay unpublished until it's over.

## 3. What to check in the subreddit

- [ ] The post opens straight into tonight's night; the header says `NIGHT N · <name>`
- [ ] Finish a night. The result card shows "Tonight: N bartenders · X% served everyone"
- [ ] **Share in comments** adds your result under the pinned "Share your night here" comment. Until the app is approved, Reddit posts it from the app account, not yours.
- [ ] Mod menu: *swap tonight for a handmade night* (run twice to undo), *pause / resume daily posts*, *calendar status*
- [ ] The next day at 00:05 UTC a new post appears by itself
- [ ] Try it logged out, and on your phone in the Reddit app

## 4. Letting Claude do it instead

Add the unzipped folder in the Claude desktop app under **Settings → Claude Code → Remote Control** and say "go". Or open Claude Code in that folder and say "follow SETUP.md and PLAN.md".
