# Last Orders

A daily trick-shot game for Reddit. You're the bartender at the Copper Spur saloon. Every night the regulars put in their orders, and you slide each drink down the bar so it stops in the dotted circle in front of the customer who ordered it.

It plays like curling or pool on a bar counter: bank drinks off the brass rails, curl them with spin, and knock a missed glass into its circle with your next pour for a trick shot. Every drink stays on the bar, so each miss changes the table for the next pour.

A new night opens every day at 00:05 UTC. Everyone on Reddit gets the same bar, the same orders and the same hazards, so you can compare results in the comments.

## How to play

1. **Aim.** Drag back anywhere on the bar, like pulling a pool cue. The guideline shows where the drink goes until it first hits something, including how it bounces off rails, drinks and the peanut bowl. It doesn't show how far the drink will slide.
2. **Set the strength.** The further you pull, the harder the pour. The bar on the left shows it.
3. **Add spin (optional).** Tap the glass in the corner where you want to hit it. Left of centre curves left, right curves right.
4. **Let go to pour.** The drink has to come to rest inside the right customer's circle. Dead centre is a perfect pour and earns a bigger tip.

On a keyboard: **Q** / **E** to aim (hold **Shift** for fine aim), hold **Space** to pull back and release to pour.

Tap or hover over anything on the bar to see what it is.

## What's on the bar

- **Brass rails** bounce drinks back. **Timber rails** stop them dead. Open edges let a drink fall off and smash.
- **Posts and taps** don't move. Hit one hard and the drink spills.
- **The peanut bowl** slides when hit. Knock it into Old Pete's spot for a bonus.
- **The sheriff's hat** (red ring): touch it and the sheriff walks out, cancels his orders and takes his tips.
- **Old Pete's arm**: he dozes on his elbow, and every few seconds his arm slaps across the bar. Time your pour between slaps.
- **Spills** stay on the bar as puddles that slow drinks down.

## A night's result

When the night ends you get a result card with your tips, badges (Perfect pour, Bank pour, Trick shot) and how many tries it took ("First try", "Took 3 tries"). Stuck? **Show me how** plays a step-by-step lesson, and the night is then marked "Used help". Press **Space** or **Play again** to retry instantly.

Share your result in the comments with the **Share** button. It posts a spoiler-free summary as you.

## The week

The bar changes every day. Monday is the gentlest night and Saturday the toughest; Sunday is a showpiece. Each night has one signature twist (bank shots, the slapping arm, the peanut bowl…). Every map is generated ahead of time and tested by a simulated bartender who pours each order hundreds of times with human-sized wobble. A night only goes live if an average player can clear it.

## For moderators

- **Replace tonight's night**: swaps today's map for a handmade fallback on the same post.
- **Pause posting**: stops the daily post until switched back on.
- **Calendar status**: shows how many days of tested maps are left.

## Built with

Devvit Web, TypeScript, Vite, matter-js (deterministic fixed-step physics), Canvas pixel rendering, Redis (stats, streaks, overrides) and the Devvit scheduler (daily posts).
