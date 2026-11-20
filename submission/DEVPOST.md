# Devpost submission: copy-paste fields

Lines marked **[fill in]** need links that exist only after the app is uploaded. Lines marked **[confirm]** describe Part B features: delete them if they don't ship.

---

**Project name**
Last Orders

**Elevator pitch** (≤ 200 characters)
You're the bartender. Slide every drink down a saloon bar into the right customer's circle: bank off brass, curl with spin, dodge the sheriff's hat. A new bar every day.

**Try it out**
- Demo post: [fill in: https://www.reddit.com/r/last_orders_saloo_dev/comments/… (the subreddit must be public first)]
- App listing: https://developers.reddit.com/apps/last-orders-saloon
- Code: [fill in, optional]

**Video**: [fill in: YouTube or Vimeo link, under 1 minute]

**Built with** (tags)
devvit, devvit-web, typescript, vite, matter-js, canvas, redis, reddit

**Is this a port of an existing game?** No.

---

## About the project

### Inspiration

You know the bit in every western where the bartender slides a drink down the counter and it stops right in the cowboy's hand? I always wanted to try that. Turns out it makes a pretty good daily puzzle: one bar, a few orders, and everyone on Reddit pouring the same night.

### What it does

You run the bar at the Copper Spur. The regulars order, and you slide each drink so it stops in the circle in front of whoever ordered it.

You aim like pool: pull back and let go (or Q/E and Space on a keyboard). The line shows you the first bounce, but not where the drink ends up. Judging the slide is the whole game.

Nothing gets cleared away. Missed drinks stay on the bar and get in the way of the next pour, but you can also knock an old miss into its own circle for a trick shot. That's my favourite part.

The bar has a few personalities. Brass rails bounce, wooden ones stop the drink dead, and where there's no rail it goes on the floor. Old Pete dozes on his elbow and his arm flops across the counter every few seconds. Touch the sheriff's hat and he leaves, along with his tip. The regulars pop up with a reaction when you do something good (or stupid).

There's a new bar every day at 00:05 UTC, same for everyone. Mondays are easy, Saturdays are mean. Every map gets tested before it goes live by a fake bartender with shaky hands. If an average player can't clear it, it doesn't ship.

When you finish, the result card counts your tries, so a lucky tenth go looks like a tenth go. You can share it under the day's pinned comment without spoiling the solution, and you see how many people played and how many cleared it. Clearing nights in a row builds a streak.

In the feed the post is just a small card with a Play button. Hit it and the bar opens full height in Reddit's expanded view, because the normal post frame was way too small to aim in.

### How I built it

- Devvit Web, TypeScript and Vite for the client and the server.
- matter-js for physics, on a fixed timestep so the same pour always does the same thing. I spent a lot of time on the friction so drinks slow down like a putt instead of gliding forever or stopping suddenly.
- A hand-made canvas pixel renderer. The customers are 16-pixel sprites, upscaled and shaded.
- A map generator plus a solver and a simulated player. Each map gets hundreds of attempts at different skill levels, and only the fair ones make it into the calendar, which is built a year ahead.
- The Devvit scheduler posts each night on its own, with a watchdog in case it misses. Redis keeps the stats and streaks. Mods can swap a night for a handmade one, pause posting, or check how many days are left.
- Devvit Journeys events for starting, serving, finishing and sharing.
- The character portraits were made with an image model from my own prompts, then cleaned up and cut out by hand.

### Challenges I ran into

Getting the slide to feel right took ages. Early drinks sped up when they touched stuff, or crawled to a stop and sat there twitching. I ended up writing my own rail bounce instead of using the engine's.

"Possible" turned out not to be good enough. One early map could technically be beaten, but a normal player would manage it about 12% of the time. Now every order has to work for a slightly clumsy simulated player at least half the time.

The aim line was tricky too. Show the whole path and the game plays itself. Show nothing and it's guesswork. Stopping at the first bounce felt right.

### Accomplishments that I'm proud of

- Trick shots. A miss is never fully wasted.
- The aim line shows how drinks knock each other around, using their actual weights.
- It runs itself. Maps are tested, posted and backed up without me touching anything.

### What I learned

How hard a physics puzzle feels comes down to how much room for error you get, not whether a solution exists. Measuring that with a clumsy fake player made the daily nights fairer and more fun.

### What's next for Last Orders

- Tuning difficulty from real players' tries.
- More bars and more regulars.
- Letting the subreddit design a bar of the week.
