# Last Orders: design plan (v4)

A daily trick-shot game for Reddit (Devvit Web). You're the bartender at **The Copper Spur**.
Every night the regulars put in their orders, and you slide each drink down the bar so it stops
in the dotted circle in front of the right customer. It plays like curling, on a bar counter.

**Hook:** every drink stays on the bar. Served drinks, missed drinks and spills turn the
counter into a new obstacle course for the next pour, so the night is one planned sequence.

---

## Changes in v8 (playtest suggestions)
- **A perfect serve earns a glass.** Stop a drink dead centre and a spare glass joins the row
  (green glow, "+1 GLASS"). Earned glasses count like any other pour.
- **Combo: pick up the bonus on the way.** Spending a glass only on the peanuts or the cards felt
  wasteful, so a pour that earns a bonus and also serves a drink pays an extra 30¢ and the
  "Combo" badge. A bonus-only pour still counts, but it uses up a glass.
- **Every bonus can be combo'd.** The generator places the peanut bowl like a pool cut shot: a pour
  meeting it at a 25-65° cut sends the bowl at Pete's spot and the drink (by the same bounce
  formula as the physics) within 8° of an order's circle. The calendar only releases a night when
  the solver finds a combo for each bonus item on it (`findCombo`, aim in 0.25° steps). When no
  cut-shot spot exists, the bowl goes to its old place below Pete's spot (combos there usually
  need a bank). Night 2's bowl moved to 205,456: shave its left side (about -96°, any strength
  from a third up) and the whiskey carries on to the sheriff.
- **Round hitboxes; the aim line is exact.** Playtest: the line showed a thin cut on the bowl that
  missed, and its bounce stubs were up to 50° off. Matter.js built circles as 10-13 sided polygons,
  noticed contacts up to a step (12.5 units) late, and pushed along a polygon face. Now:
  - round things (drinks, the bowl, cards, the hat, taps) are 40-sided bodies;
  - a hit between two round things is resolved by hand like a pool break: time is wound back to
    the moment the true circles touch, both bounce along the line of centres there, and the rest
    of the step plays forward (`roundHit`);
  - a graze that happens between two steps still counts (`sweptHits`);
  - the aim line finds the first touch exactly, draws the ghost glass where the circles touch, and
    its stubs use the same formula (and the brass cushion's 80% bounce, grip and spin english).
  Measured: every hit the line shows happens, and the object and drink leave within 0.5° of the
  stubs (`tests/physics.test.ts`). The line is still straight, so heavy spin curves away from it.

## Changes in v7
- **Drinks bounce off each other like pool balls** (same mass, 0.9 bounce, same sliding friction).
  A missed drink stays on the bar as something to bank off. Only a real slam (impact over 7.5) spills.
- **Trick shots:** any drink resting in its own customer's circle is served, so you can knock an
  old miss into place with the next pour. That earns +25¢ and the "Trick shot" badge (🎱 in the share
  text). A served drink knocked out of its circle reopens the order ("Hey! I had that!").
- **Guideline for hits, pool-style:** when the line meets something that moves (peanut bowl, a drink,
  the cards) an amber line shows where it will be pushed (along the line of centres), and a cream line
  shows where your drink glances off (at right angles, shorter for a fuller hit). Taps and the tip jar
  don't move, so they show a bounce stub like a rail.
- **Danger looks different from targets:** the sheriff's hat has a double red pulsing ring and a
  warning sign; the "Hands off the hat" label is red.
- **Customers: smoothed and shaded.** The 16px art is doubled with EPX and lit from the top-left.
- **Power bar is back**, the bartender's arm lines up with the shot, and hints sit at the top of the bar.

## Changes in v6: feel tuned after pool and putting
- **Rolling, not crawling.** Pool balls and golf putts slow at a nearly steady rate (rolling
  friction barely changes with speed). The drink now loses about the same speed every moment,
  with only a touch of drag, so it keeps its pace across the bar and then settles.
- **Pull maps to distance in a straight line**, like a putting stroke: half the pull, about
  half the distance. (Speed is the square root of the pull, because with steady friction the
  distance grows with speed squared.)
- **Cushion bounces by hand.** The physics engine treated glancing hits as resting contact, so
  drinks clung to the rail and slid along it. Rail hits now mirror the incoming angle, keep
  80% of the speed into the rail (brass) or 12% (timber), with a little grip along the rail,
  so bounces come out slightly flatter, like a real cushion.
- **Spin works like pool english**: a slight curve on the wood (a quarter of before), and most
  of the effect at the brass rail, where it widens or narrows the bounce. The rail uses up
  60% of the spin.
- **Pool-style guideline**: a dotted line to the first thing the drink would touch, a ghost
  glass where it touches, and a short stub for the bounce or for where a hit object would go.
  It never depends on power, so it shows direction but not where the drink stops.
- **Show me how is a lesson**: before each pour the bar pauses, the guideline appears, the
  spin glass is set, the hand pulls back to the right strength, and a card spells out
  "Pour 1 of 3 · Sheriff's whiskey / Aim / Pull 55% (medium) / Spin Right 40%". Then the pour
  plays in slow motion.
- Sticky sarsaparilla is now 2.5x friction (was 6x), and night 2's peanut bowl moved so it no
  longer blocks the straight pour to Two-Fist.

## Changes in v5
- **High-angle pixel art** for the whole cast and every item, with dark outlines and one shade and one highlight per material.
- **Customers at double pixel size** so they read clearly next to the bar. Customers on the same side sit at least 72 units apart (the generator and its checks enforce it).
- **Old Pete leans on his elbow** asleep. When it slips his arm slaps across the bar: "SLAP!", the bar shakes, then "Hm?" as he props back up. The physics of the arm are unchanged.
- **Slow start aiming:** no aim line, no landing spot, no power bar. While you drag only the bartender's hand pulls back. After release the first half second plays at quarter speed with a direction arrow riding ahead of the drink, then full speed. Only the clock slows; the simulation is identical, so replays and server checks still match.
- **Cartoon CRASH** when a drink falls off the bar: star burst, "CRASH!", chunky shards that bounce, a puff of dust, then broken glass and a puddle stay on the floor.
- **Show me how:** after a night you didn't finish, watch a proven solution. The night is then marked "Used help" on screen, on the result card and in the share text.

## Changes in v4
- **Pixel-art look.** The bar is drawn into a 195 x 300 pixel image with hard edges and scaled up
  so every pixel stays square. Pixel fonts: Silkscreen for labels, Pixelify Sans for reading text.
- **Power bar** beside the bar fills from green to amber to red while you drag, and shows the percentage.
- **Spin glass:** tap the glass where you want to hit it. Left of centre curves left, right of centre
  curves right, and the distance from centre sets how much (0-100%). There's a dead zone in the middle
  so "no spin" is easy to pick, and a Centre button.
- **Daily map generator** (section 9b). Same map for everyone on the same UTC date, and a map is only
  released after the solver proves it can be finished.

## Changes in v3
- **You serve drinks instead of knocking them over.** Each order has a dotted circle in front of its
  customer. Slide the drink so it stops inside the circle. Closer to the centre earns a bigger tip.
- Orders come in a fixed sequence, so the night's designer controls which served drinks get in
  the way of later pours.
- A missed drink stays where it stopped. Knock over a drink you already served and that customer
  wants a new one.

## Changes in v2 (kept)
- Timber rails instead of leather. Gold bounces, dark timber stops dead, no rail means the drink falls off.
- The peanut bowl is a bonus shot: push it into Pete's spot.
- Characters have props and reactions (the sheriff's hat, Lavinia's cards, Pete's swinging arm).

---

## 1. The pour
- **Drag back anywhere and release.** The pull's direction is the aim and its length is the power.
- **Spin, chosen before the pour:** Left / None / Right. The drink curves gently, and more as it slows.
- Each night lists its **orders** and gives a few spare **pours** for misses
  (for example 3 orders and 5 pours).
- Each pour is just **(tick, angle, power, spin)**, so replays, server checks and the best-pour
  replay are tiny.

## 2. What happens to a pour
| Result | When | Effect |
|---|---|---|
| **Served** | It stops inside its order's circle | The customer thanks you. Tip: 10¢, 25¢ or 50¢ by accuracy, plus 15¢ if it banked off brass |
| **Perfect** | It stops within 4 units of the centre | Biggest tip and the Perfect pour badge |
| **Miss** | It stops outside the circle | The glass stays on the bar as an obstacle, and the order is still open |
| **Spill** | It slams into a glass, post or arm too hard | It tips over and leaves a puddle. The order is still open |
| **Smash** | It slides off a stretch with no rail | Lost, and someone shouts "Butterfingers!" |

Knocking over a drink that's already standing (one you served, or one a customer already had)
spills it. If it was one you served, that order reopens.

## 3. Edges
| Edge | Look | Behavior |
|---|---|---|
| **Brass rail** | Shiny gold | Bouncy. Bank pours earn extra tip |
| **Timber rail** | Dark rough planks | Dead: dull thud, almost no bounce |
| **No rail** | Worn edge with a dashed red warning | The drink slides off and smashes |

## 4. Things on the bar
| Kind | Examples | Behavior |
|---|---|---|
| Fixed | Beer tap, tip jar | Round, bouncy posts. Hit them hard and your drink spills |
| Heavy and movable | **Peanut bowl** | Push it into Pete's spot for a bonus |
| Standing drinks | Customers' drinks, your served and missed pours | Obstacles that spill when hit |
| Alive | Old Pete's arm | Sweeps out on a fixed snore rhythm, so time the release |
| NPC props | Sheriff's hat, Lavinia's card deck | Owner reacts (see section 6) |

## 5. Spills
A tipped drink splashes a **fan-shaped puddle in the direction it was moving or hit**, and it stays.
Beer and whiskey are slick (drinks slide further), and sarsaparilla is sticky (drinks stop fast).
A puddle across your lane changes how hard you need to push.

## 6. The cast
| NPC | Orders | Prop or quirk | Reactions |
|---|---|---|---|
| **The Sheriff** | Whiskey | **His hat is on the bar.** Knock it or splash it and the night ends | "Much obliged." / "Mind. The. Hat." |
| **Dutch** | Beer | Loud | "Right in my hand!" / "Closer, barkeep!" |
| **Two-Fist** | Rye | Sometimes orders two | "My arms ain't that long." |
| **Old Pete** | Water | Asleep, and his arm sweeps the bar when he snores. **Peanut spot** for a bonus | "...peanuts?" |
| **Miss Lavinia** | Sarsaparilla | **Card deck:** hit it to expose her cheating, for a bonus | "That ace was there when I sat down!" |

## 7. Scoring and the result card
- **To finish the night:** serve every order before you run out of pours, without touching the sheriff's hat.
- **Score:** tips (cents) from accuracy and bank pours.
- **Badges:** Perfect pour · Bank pour · No wasted pours · Clean bar · Peanuts for Pete · Cheat exposed.
- **Result card:** outcome, tips, badges, share text, replay, and a button that opens the comments.

Example share text:
```
LAST ORDERS · Night 3
⭐🍺▫️🍺  Served 3/3 · Tips 85¢
Bank pour · Cheat exposed
```

## 8. Daily content and story
- A one-line scene every night, a weekly difficulty arc (easy Monday through a Sunday rush), and a recurring cast.
- **The whole community shapes the story:** tomorrow's scene depends on how the subreddit did
  (for example, if the saloon earned a lot in tips, it can afford a piano player).
- **Reddit-y features:** the top comment names Sunday's new customer and their order, players submit
  orders and characters, "Bartender of the Night" gets flair and a replay, and flair ranks rise with your streak.

## 9. Technical plan
- **Simulation:** `matter-js` with no gravity (top-down) and a fixed 1/60 s step, shared by client and server.
- **Client:** a lightweight canvas renderer.
- **Server (Devvit Web):** Redis keys `night:{date}`, `scores:{date}` (tips), `user:{id}`, `best:{date}`.
  The scheduler posts each night. The server reruns submitted pours to check scores.
- **Level tooling:** `npm run solve` finds a pour for each order in turn, proving a night can be
  finished and showing how forgiving each order is.
- **Analytics (Devvit Journeys):** night start, each pour and its result, bonus, finished, shared.

## 9b. Daily map generator
- **Seed:** the UTC date (`2026-11-21`), hashed into a small deterministic random generator.
  Everyone's day flips at midnight UTC, and the same date always gives the same map.
- **Difficulty by weekday:** Monday has 2 orders and plain brass rails. Later in the week adds
  timber stretches, gaps with no rail, posts, puddles, drinks already standing, Pete's swinging arm,
  and up to 4 orders on the weekend.
- **Never impossible:** each candidate first passes structure checks (everything on the counter,
  nothing overlapping, start lane clear, the sheriff's hat placed). Then the solver must find a pour
  for every order where small aiming errors still work. If it can't, the next variation of the
  same date is tried (up to 20). If none pass, a handmade night is released instead, and the
  tests prove those are possible too.
- **Proven solution:** each released map comes with a working list of pours, kept on the server
  (useful later for a "show me how" replay).
- **In Devvit:** the scheduler generates tomorrow's map once and stores the level JSON in Redis, so
  every player loads exactly the same data.
- **Not wired into the game yet.** Preview any date with `npm run daily -- 2026-11-21`.
- **Tests:** `npm test` covers same-date determinism, variety between dates, structure, weekday
  difficulty, the solver refusing an impossible map, the handmade fallback, and two weeks of
  released maps that each replay to a finished night.

## 10. Schedule (deadline Dec 8)
| Days | Goal | Status |
|---|---|---|
| 1–6 | Core pour, rails, spills, orders, props, bonuses, result card | **Proof of concept built** |
| 7–9 | Move into a Devvit Web template: daily post, Redis, streaks, flair, server check | Next |
| 10–12 | Art pass, sound, a satisfying slide and spill | |
| 13–14 | Tutorial night, Journeys events, best-pour replay | Replay done in the proof of concept |
| 15–16 | About 30 nights, the weekly arc, the community story line | |
| 17–18 | Playtest in your subreddit, tune difficulty with the solver | |
| 19 | Demo post with past nights, Devpost write-up and video | |
