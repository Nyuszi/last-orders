# Automated back-testing of generated levels: simulated players, solution-space metrics and difficulty estimation (applied to Last Orders)

Research note on method and sources: several primary-source hosts could not be fetched from this session (DNS blocked: cdn.aaai.org, arxiv.org, mc-stan.org, avehtari.github.io, drdavepoolinfo.com, mintlify.com). Findings from those papers come from search-result abstracts and snippets, not full texts, and are marked as such where it matters. To make up for it, I ran two small **local experiments on the real Last Orders code** (`src/sim.ts`, `src/solver.ts`, `src/generator.ts`, node v22.23.5, 4 vCPU container). The scripts are at `/tmp/claude-0/-home-user/7e602fb7-4005-5c36-bff2-7c6154e07169/scratchpad/bench.ts` and `/tmp/claude-0/-home-user/7e602fb7-4005-5c36-bff2-7c6154e07169/scratchpad/metrics.ts`. The scratchpad is temporary, so copy them into `scripts/` to keep them. Their results are cited as "Local experiment".

## 1. Simulated-player / agent approaches (noisy-input agents, Monte Carlo, personas, MCTS/RL, Angry Birds agents)

### Takeaway
For a one-shot-per-turn, continuous-input, deterministic physics game like Last Orders, the best-supported and cheapest approach is a **noisy-execution agent**: take an intended shot, add Gaussian error to angle, power and spin, simulate, and repeat with Monte Carlo. Isaksen et al. did this for Flappy Bird, it underlies curling and pool AI with "execution uncertainty", and Gelman/Broadie's golf putting models are the analytic version of it. Learned agents (CNN, DRL, MCTS) such as King's and Rovio's exist because match-3 has huge discrete state spaces and long move sequences. Last Orders has neither, so a solo dev does not need them.

### Cited Findings
- Isaksen, Gopstein and Nealen (FDG 2015) "Exploring Game Space Using Survival Analysis": score stands in for lifetime, so survival analysis applies to simple action games. A companion AIIDE 2015 paper (Isaksen and Nealen) uses **Monte-Carlo simulation, hazard functions and survival analysis** to show how difficulty changes quantitatively through a level. Changing parameters such as bird speed, gravity, pipe width and pipe spacing changes difficulty a lot. — [bibtex FDG-2015](https://bibtex.github.io/FDG-2015-IsaksenGN.html); [AIIDE 2015 "Comparing Player Skill, Game Variants, and Learning Rates Using Survival Analysis"](https://ojs.aaai.org/index.php/AIIDE/article/view/12846); [Technical.ly coverage](https://technical.ly/brooklyn/2016/08/30/nyu-game-center-flappy-bird-case-study/)
- The IEEE Transactions on Games (2018) version reports data from over 106 million play sessions of a Flappy Bird variant, while the AIIDE paper cites over 175 million. The counts differ between versions. (Search snippet, full text not fetched.) — [AIIDE 2015](https://ojs.aaai.org/index.php/AIIDE/article/view/12846); [bohrium summary of the ToG paper](https://www.bohrium.com/paper-details/exploring-game-space-of-minimal-action-games-via-parameter-tuning-and-survival-analysis/813103233525350402-2638)
- Curling AI treats shots as continuous actions with **execution uncertainty**. Yee, Lisý and Bowling's KR-UCT (IJCAI 2016) uses the execution-noise model as a kernel, so simulations of one shot inform estimates for nearby shots. — [IJCAI 2016 KR-UCT](https://ijcai.org/proceedings/2016/104)
- Ahmad et al. define a curling hammer shot's expected value as a probability-weighted average of noise-free outcomes, weighted by how likely each executed shot is given the intended one. In other words, value is the intended shot convolved with the noise distribution. — [IJCAI 2016 hammer shots](https://ijcai.org/proceedings/2016/86); [Ahmad MSc thesis](https://era.library.ualberta.ca/files/c2n49t197f/Ahmad_Zaheen_F_201701_MSc.pdf)
- CueTip (a pool assistant) models execution error as zero-mean Gaussian noise on each shot parameter and scores shots by both expected payoff and variance. — [arXiv 2501.18291](https://arxiv.org/pdf/2501.18291)
- Procedural personas (Holmgård et al.) are MCTS-controlled agents that differ only in the utility weights they place on game affordances (five personas in MiniDungeons 2). They serve as archetypal player models for automated playtesting and as critics in dungeon generation. Persona play closely matched human playstyles. — [AIIDE 2015 MCTS for persona-based player modeling](https://ojs.aaai.org/index.php/AIIDE/article/view/12849); [Automated playtesting with procedural personas through MCTS with evolved heuristics](https://antoniosliapis.com/papers/automated_playtesting_with_procedural_personas_through_mcts_with_evolved_heuristics.pdf); [Personas as critics for dungeon generation](https://mail.antoniosliapis.com/papers/procedural_personas_as_critics_for_dungeon_generation.pdf); [Holmgård PhD thesis](https://en.itu.dk:443/-/media/EN/Research/PhD-Programme/PhD-defences/2015/Holmgard2015_Procedural_Personas_for_Player_Decision_Modeling_and_Procedural_Content_Generation-1-pdf.pdf)
- King: Poromaa's 2017 KTH thesis "Crushing Candy Crush" used an MCTS bot to predict average human success rate. Gudmundsson et al. (CIG 2018, "Human-Like Playtesting with Deep Learning") then trained a CNN on player moves from Candy Crush Saga and Soda Saga. They report that it **raises correlation with average level difficulty compared with MCTS and needs only a fraction of the compute**. — [Poromaa thesis record](https://openaccess.library.uitm.edu.my/Record/ndltd-UPSALLA1-oai-DiVA.org-kth-206595); [Gudmundsson et al. 2018 PDF](https://www.Gwern.net/doc/reinforcement-learning/imitation-learning/2018-gudmundsson.pdf)
- A secondary blog says King's approach could estimate a new level's difficulty in under a minute, compared with about 7 days of human playtesting per 15-level episode. — [koaning.io Playtesting Candy Crush](https://koaning.io/posts/playtesting)
- A Politecnico di Milano thesis (supervised by Gudmundsson) modeled player cohorts with CNNs and found that **simulating different strategies predicts level difficulty, measured as player success rate, more accurately**. — [Anghileri 2018 thesis](https://www.politesi.polimi.it/retrieve/a81cb05c-d584-616b-e053-1605fe0a889a/2018_07_Anghileri.pdf)
- Rovio/Aalto (Roohi et al., CHI PLAY 2020) used DRL agents plus a simulated player population with skill, persistence and boredom to predict pass rate and churn for 168 levels of Angry Birds Dream Blast (95,266 players; churn means 7 days without play). DRL predictions were "not yet entirely humanlike", especially for levels with very low pass rates. The 2021 follow-up found that **DRL-enhanced MCTS beats both DRL and vanilla MCTS on the hardest levels**. — [arXiv 2008.12937](https://arxiv.org/abs/2008.12937); [Aalto repository](https://aaltodoc.aalto.fi/items/b0db38e3-90ef-4d01-ac5a-2c8d401d448f); [arXiv 2107.12061](https://arxiv.org/abs/2107.12061v1)
- Kristensen et al. trained a PPO agent and correlated its move counts with player completion rate in a mobile puzzle game. (Search snippet.) — [Statistical Modelling of Level Difficulty in Puzzle Games, related-work summary](https://arxiv.org/html/2107.03305v2)
- Angry Birds: the AIBirds agent competition runs on Box2D physics. Its rounds of 8 unseen levels are designed to defeat brute-force shooting. An early poor shot can make a level unsolvable, and humans still outscored the best agents as of 2019. — [arXiv 1910.01806](https://arxiv.org/pdf/1910.01806); [i-programmer](https://i-programmer.info/news/105/13165.html); [The New Stack](https://thenewstack.io/why-cant-ai-beat-humans-at-angry-birds/)
- The Angry Birds Level Generation Competition (IEEE CIG, since 2016) judged generated levels with AI and human players on how many solved each level and how fast. Levels had to be stable under gravity, and entries were penalised when their levels were too similar to each other. — [DiGRA paper](https://digra.org/?p=146812); [call for participation](https://groups.google.com/g/racingcompetition/c/sXXTjLFFm2I); [Science Birds 2023, stability as quality](https://arxiv.org/pdf/2303.15662v3.pdf)
- BamBirds runs an evaluation framework that assigns difficulty ratings to levels and compares agent versions by which levels each solved. — [BamBirds evaluation](https://bambirds.sme.uni-bamberg.de/evaluation)
- Local experiment: a noisy agent was built in about 20 lines of TypeScript on the existing `replay()` (intended shot = solver shot; angle error sd 1°; power error sd 4% relative). It estimated P(serve order 1) at 1.00, 0.98 and 0.82 on the 2026-11-21, 11-22 and 11-23 maps, from 400 samples each, at 0.16 to 0.36 ms per sample. — Local experiment (`bench.ts`)

### Inferences
- **Recommended agent ladder for Last Orders**, cheapest first:
  1. **Noisy executor of the solver's plan.** For each order, take the solver's shot and sample noisy versions to get p_i.
  2. **Noisy executor of a region centre.** Aim at the centroid of the largest feasible cluster in (angle, power, spin) space, not at the solver's first hit (see Q2). Humans aim at "the middle of what works", and the greedy solver returns an arbitrary edge point.
  3. **Full-night rollout agent.** Play the whole night with noise. After each pour the agent re-plans from the new board state with a small budget (cheap solver call), because misses leave stray glasses and puddles that change later shots. This is the only agent that captures "a miss ruins the night", the physics-game analogue of Angry Birds' "early poor shot makes the level unsolvable".
  4. **Personas**, done Holmgård-style but cheaply: different noise sigmas (skill tiers), different shot preferences (direct only, or banks and spin allowed), and risk appetite (pick the safest shot vs. the highest-scoring one). Personas share one simulator and differ only in parameters.
- MCTS, DRL and CNN playtesters are unnecessary. In Last Orders each turn's decision space is only 3 continuous dimensions plus a wait time, and nights are 2 to 5 pours. The curling and pool literature, which is the closest analogue (continuous shot parameters plus execution noise), uses sampling under a noise model rather than learned policies.
- "Persona = noise sigma tier" makes difficulty a curve rather than one number. Report p(clear) for novice, average and expert sigma, the way Isaksen et al. compare skill levels with survival curves.

### Gaps
- I could not read Isaksen et al.'s full papers (aaai.org blocked), so the exact noise parameters they used for human timing precision are not recorded here.
- I found no published GDC or industry talk with specific numbers from Ubisoft La Forge, EA SEED, Unity or Supercell on physics-game playtesting. The searches surfaced only King and Rovio academic work.
- Poromaa's numeric MCTS-vs-human correlation results could not be retrieved.

## 2. Solution-space metrics (feasible-region size, tolerance windows, solution families, required precision) and how to compute them cheaply

### Takeaway
The most informative per-map numbers are **(a) success probability under a stated noise model**, **(b) tolerance windows (margin for error) in angle and power around the best aim point**, and **(c) the number and size of distinct solution clusters**. The pool and golf literature defines difficulty almost entirely as margin for error. The local experiment found that the current robustness check (2 of 4 variations at ±0.6° and ±0.02 power) accepted a shot sitting on the edge of its feasible region, which a density or noise metric would catch.

### Cited Findings
- Alciatore's pool analyses define difficulty as **margin for error**, which shrinks as cut angle, cue-ball-to-object-ball distance and object-ball-to-pocket distance grow. For a straight shot, difficulty is directly related to the **product of the two distances**. A straight shot is about 97% easier than a 60° cut. A carom allows about 1.5° of cue-ball error and is almost 10 times easier than the equivalent cut. A slow 30° cut over 54 units needs aim to about 0.07°. Slower speed gives a much larger margin. (Snippets from his technical proofs and columns.) — [TP 3.4](https://billiards.colostate.edu:443/technical_proofs/TP_3-4.pdf); [Dr. Dave FAQ: margin for error vs cut angle](https://drdavepoolinfo.com/faq/cut/margin-for-error/); [Billiards Digest Apr 2019 (speed)](https://billiards.colostate.edu:443/bd_articles/2019/april19.pdf)
- In Gelman and Nolan's golf model, a putt drops only if the angular error is within the angle the hole subtends, **arcsin((R−r)/x)**. With normal angular error σ, P(success) = 2Φ(arcsin((R−r)/x)/σ) − 1, and this fits pro data much better than logistic regression with one fewer parameter. — [Gelman & Nolan 2002, Teaching Statistics](https://zendy.io/title/10.1111/1467-9639.00097); [Bayesian Workflow, arXiv 2011.01808](https://arxiv.org/pdf/2011.01808)
- KR-UCT's key trick is that nearby actions share information through the noise kernel, which makes continuous-action evaluation under execution noise efficient. — [IJCAI 2016](https://ijcai.org/proceedings/2016/104)
- Local experiment, 1-D tolerance windows (walking outward in 0.1° and 1%-power steps from the solver's shot until the first failure) plus Monte Carlo success at three noise levels. All runs used 300 samples per noise level, and each order took 926 to 1,049 sims and 0.14 to 1.2 s on one core:

  | Map / order | Angle window | Power window | p at σ=(0.5°, 3%) | p at (1°, 6%) | p at (2°, 10%) |
  |---|---|---|---|---|---|
  | 11-22 #1 | −5.4/+5.4° | −8/+11% | 1.00 | 0.88 | 0.62 |
  | 11-22 #2 | −0.2/+4.1° | −14/+1% | 0.61 | 0.53 | 0.40 |
  | 11-22 #3 | **−0.9/+0.3°** | **−0/+10%** | 0.71 | 0.39 | **0.12** |
  | 11-22 #4 | −6.0/+6.0° | −12/+15% | 1.00 | 0.98 | 0.84 |
  | 11-23 #1 | −1.7/+3.3° | −5/+7% | 0.95 | 0.63 | 0.32 |
  | 11-23 #2 | −2.4/+2.4° | −3/+5% | 0.86 | 0.50 | 0.23 |

  — Local experiment (`metrics.ts`)
- Local experiment: on 11-22 order 3 the solver's shot fails at −1% power, so it sits on the edge of the feasible region. It still passed the existing robustness rule, because the −0.6°/+0.02 tests landed inside the window. The 1-D windows are often **asymmetric** (for example −0.2/+4.1°), so the solver's point is not centred. — Local experiment (`metrics.ts`); robustness rule in `/home/user/last-orders/src/solver.ts`

### Inferences
- **Metrics to compute per order, then aggregate per night:**
  - `p_i(σ)`: P(serve order i) under a Gaussian noise model at 2 to 3 skill tiers. Use relative power noise, which matches the release-velocity finding in Q3. This is the primary metric.
  - Angle and power tolerance windows, measured around the cluster centre, not the solver's point. Also report the **centre offset** (how far the solver's point is from the centre).
  - `area_i`: feasible area in (angle, power) at each discrete spin value, from grid counts × cell area. Normalise by the "direct shot" area of an empty bar at the same distance so maps of different geometry are comparable. That normalised value is a "precision demand" index, like the golf hole angle.
  - `k_i`: the number of distinct solution families (connected components on the grid; label them direct, bank-left, bank-right, spin-curve, or knock-on). More families means more expressive, less "one true shot". A good daily map probably wants at least 2, with one obvious and one clever.
  - `p_night(σ)`: from full-night noisy rollouts with re-planning, not the product of p_i, because misses change the board. The product is a quick upper-bound proxy only when misses don't block.
  - Pour slack: pours allowed minus the minimum pours needed (the solver already gives the minimum). Combined with p_i this gives P(clear within budget); see Q3.
- **Cheap computation recipe (coarse to fine):**
  1. Coarse grid per spin value, for example 1° × 0.025 power over the plausible cone, like the existing sweep (about 120 × 32 × 3 ≈ 11.5k sims).
  2. Mark successful cells and run connected-component labelling to get clusters.
  3. Refine only boundary cells (adaptive sampling or bisection along rays from the cluster centre) to measure windows.
  4. Run Monte Carlo noise samples only at each cluster centre. A Wilson 95% CI of ±0.05 needs about 300 to 400 samples; ±0.1 needs about 100.
  5. Stop early with sequential testing: if after 50 samples p is clearly above 0.9 or below 0.1, stop.
- Reusing evaluations across nearby actions (the KR-UCT idea) works naturally here. The coarse grid is a lookup table, so the probability under noise for any aim point can be estimated by **convolving the success grid with the Gaussian kernel**, with no new sims. That turns about 10k grid sims into a full p(aim) map, whose maximum is the "best human aim" and its value.
- Replace the 2-of-4 robustness rule with "the cluster containing the solution has p ≥ threshold at σ_avg". Alternatively keep the rule but evaluate it at the **cluster centre**, and add a minimum window (for example at least ±1° and ±4% power).

### Gaps
- There is no published human-calibrated threshold for "fair" tolerance windows in drag-to-shoot games. It has to come from Last Orders' own telemetry (Q4).
- Spin is discrete in the solver (−1, −0.5, 0, 0.5, 1). How players actually pick spin (continuous or discrete in the UI), and its noise, needs checking against `src/main.ts`; I did not research spin-input noise.

## 3. Difficulty estimation: from success probability under noise to expected tries; human motor-noise data; golf, pool and curling models

### Takeaway
Map p (per pour, or per whole night) to expected tries with a geometric model, **E[tries] = 1/p**, or better a **negative-binomial "attempts" model** (Kristensen et al.) that allows heterogeneous players. The sigma values must be **fitted from Last Orders' own telemetry**, because I found no published angular-error data for touch or mouse drag-to-shoot. Golf gives the best template: one fitted angular σ (Gelman: about 1.5° for pros under the angle-only model) plus a distance or power error term.

### Cited Findings
- Golf putting: the angle-only model fit gives σ = 1.53° (SE 0.02) for pro putting data. Broadie (2018) and Gelman (2019) extended it to two parameters, **angle error plus log-distance (relative) error**, fitted to 1.25 million pro putts. A longer putt admits less angular error and so has a lower success rate. — [Bayesian Workflow, arXiv 2011.01808](https://arxiv.org/pdf/2011.01808); [PyMC putting workflow](https://molab.marimo.io/github/pymc-devs/pymc-examples/blob/main/examples/case_studies/putting_workflow.ipynb); [Stan golf case study](https://mc-stan.org/learn-stan/case-studies/golf.html)
- Tour make rates by distance are reported inconsistently by secondary sources: about 77% from 5 ft and 50% from 8 ft (golf.com, citing Broadie); about 40% from 10 ft; about 7% from 30 ft (forum, citing *Every Shot Counts*); and another summary claiming near 100% inside 3 to 5 ft, which **contradicts** the 77% figure. — [golf.com, Broadie](https://golf.com/instruction/putting/mark-broade-uphill-putts-strategy/); [ScienceInsights](https://scienceinsights.org/how-well-do-professional-golfers-putt-by-distance/); [TheSandTrap forum](https://thesandtrap.com/forums/topic/94714-how-many-30-foot-putts-with-poll/?page=2)
- Strokes-gained putting (Broadie) uses ShotLink data, and the PGA Tour adopted it in May 2011. The Tour's version uses **putt distance as the only measure of putt difficulty**; Broadie's later work adds slope and break. — [Broadie, Assessing golfer performance (Columbia)](https://business.columbia.edu/sites/default/files-efs/pubfiles/4996/assessing_golfer_performance.full.pdf); [golf.com](https://golf.com/?p=14537910)
- Pool difficulty scales with cut angle and with the product of the cue-ball-to-object-ball and object-ball-to-pocket distances; see Q2. — [TP 3.4](https://billiards.colostate.edu:443/technical_proofs/TP_3-4.pdf)
- Human motor noise: a study of releasing a virtual object with a mouse found a **linear relationship between target release velocity and the SD of release velocity**, which supports relative (multiplicative) power noise. The study was 1-D. — [as cited in arXiv 2302.03103](https://arxiv.org/pdf/2302.03103)
- Touchscreen endpoint variability is modelled by Huang et al.'s 2D Ternary-Gaussian model (finger-touch ambiguity plus movement speed) for a game-like moving-target task. Wobbrock's group formalised touch metrics, including angle variability and angle deviation. — [arXiv 2302.03103](https://arxiv.org/pdf/2302.03103); [arXiv 2101.05244](https://arxiv.org/pdf/2101.05244); [Wobbrock ASSETS'22](https://faculty.washington.edu/wobbrock/pubs/assets-22.01.pdf)
- Kristensen, Valdivia and Burelli model the distribution of attempts and actions in a level with a **negative binomial**, using data from Lily's Garden (Tactile Games). They note that completion rate is the usual difficulty measure, the multiplicative inverse of attempts-to-complete. — [arXiv 2107.03305](https://arxiv.org/html/2107.03305v2); [ITU Pure](https://pure.itu.dk/en/publications/statistical-modelling-of-level-difficulty-in-puzzle-games/)
- Rovio's model feeds AI-predicted difficulty into a simulated population with skill, persistence and boredom to predict pass and churn rates; see Q1. — [arXiv 2008.12937](https://arxiv.org/abs/2008.12937)
- Local experiment: E[tries] = 1/p per order ranged from 1.0 to 8.6 across noise tiers for the same map (table in Q2). Map 11-22 is easy at σ = 0.5° but has one order at p = 0.12 under σ = 2°. — Local experiment (`metrics.ts`)

### Inferences
- **Per-night model:** a "try" in Last Orders is presumably one night attempt with B pours; check this against `NightProgress.tries` in `src/main.ts`. Simulate the full night M times per skill tier with the re-planning noisy agent, record whether it clears and how many pours it used, and set p_night = clear fraction.
  - If each try is independent, E[tries] = 1/p_night. P(solve within k tries) = 1 − (1 − p_night)^k is the number to compare with the game's daily limit.
  - Learning across tries breaks independence. Model it as σ shrinking per try (σ_k = σ_0·λ^k), the analogue of Isaksen's learning-rate comparison.
- **Golf-style fit for Last Orders:** P(serve) = P(|angle error| < half-window_angle) × P(|log power error| < window_power), with σ_angle and σ_logpower fitted from telemetry (Q4). That is the analytic shortcut when the windows from Q2 are roughly rectangular. Monte Carlo handles the general case.
- **Starting sigmas before telemetry:** use 3 tiers bracketing the local experiment (0.5°/3%, 1°/6%, 2°/10%). Choose them so the release-day player median falls in the middle, then refit. The golf pro σ of about 1.5° is a sanity anchor; touch input is likely noisier and mouse less noisy, but no source confirms this.
- **Features for a regression fallback:** distance to target, required bank count, whether spin is needed, number of blockers near the line (the pool distance-product analogue), target circle radius, minimum window, and number of clusters. These can explain why a map is hard and act as generator constraints.

### Gaps
- **I found no published angular-error SD for drag-to-shoot or slingshot input on touch or mouse.** This is the biggest data gap, and it must be filled from Last Orders' own logs (Q4).
- Curling-specific numeric execution-noise values were not found; the curling papers use the noise models generically.
- The exact Broadie/Gelman two-parameter constants could not be read (mc-stan.org and avehtari.github.io blocked). From memory, the case study uses a distance tolerance and an "overshoot" term, but those numbers are not verified here.

## 4. Calibration from telemetry: Elo/Glicko puzzle ratings, IRT, Bayesian updating, Wordle-style reporting, and feedback into the generator

### Takeaway
Treat each night attempt as a game between player and map (the Lichess puzzle approach, Glicko-2), or fit a **1PL Rasch/IRT model** offline. Research comparing Elo, Glicko and IRT found **Bayesian 1PL IRT most accurate when items or matches are few**, which fits a daily game with one map per day. Then **regress the fitted map difficulty on the simulated metrics** (p under noise, windows, clusters) to calibrate the noise model. The generator can then target a difficulty band before release.

### Cited Findings
- Lichess rates puzzles with Glicko-2: each solve attempt is a rated game between solver and puzzle. If the user fails, the puzzle gains rating; if the user solves it, the puzzle loses rating. The update size depends on the ratings and on the Glicko-2 deviation, and a "?" marks a deviation above 110. Only rated solves count. (Forum posts and community docs, not official specs.) — [Lichess forum: puzzle rating question](https://lichess.org/forum/general-chess-discussion/puzzle-rating-question); [Lichess forum: rating formula](https://lichess.org/forum/lichess-feedback/what-is-the-mathematic-formula-to-calculate-the-rating-in-lichess); [Lichess forum: question mark](https://lichess.org/forum/lichess-feedback/whats-the-meaning-of-the-question-mark?page=5)
- The Rasch (1PL IRT) model sets P(success) as a logistic function of (ability − difficulty). — [Columbia Rasch modeling](https://www.publichealth.columbia.edu/research/population-health-methods/rasch-modeling)
- A comparison of Elo, Glicko, IRT and Bayesian IRT found that with **small numbers of items or matches**, Bayesian 1PL IRT gave the most accurate skill estimates on both educational and gaming data. — [core.ac.uk comparison](https://core.ac.uk/download/215464524.pdf)
- A UPV thesis applied Rasch to video game difficulty. It works when the game is strongly unidimensional and items don't misfit badly. Learning-analytics work warns that games are interactive, dynamic and multidimensional, which can break psychometric assumptions. — [UPV RiuNet](https://riunet.upv.es:443/handle/10251/143530?show=full); [Penn learning analytics](https://learninganalytics.upenn.edu/ryanbaker/ruiperez.pdf)
- Regan et al. extended Rasch-style modelling to individual chess move decisions, which multiplies sample size and factors out opponent quality. — [Buffalo paper](https://cse.buffalo.edu/faculty/regan/papers/pdf/ReBiNF13.pdf)
- Negative-binomial attempts modelling (Kristensen et al.) goes beyond plain completion rate by modelling the whole distribution of attempts. — [arXiv 2107.03305](https://arxiv.org/html/2107.03305v2)
- Wordle reporting: WordleBot reports a daily average score for each puzzle from a sample of players (one example day sampled 1,778,346 players). The all-time average is about 3.97, the hardest puzzle was PARER at an average of 6.3, and the monthly averages range from 3.65 (Dec 2023) to 4.22 (Jul 2025). Puzzle #1214 averaged 5.9 with a 56% solve rate. Search summaries say NYT counts a failure as **7.5 guesses** in averages; I could not confirm which article carries that claim. — [TechRadar](https://www.techradar.com/computing/websites-apps/last-month-was-officially-wordles-toughest-month-ever-but-it-could-get-harder-still-heres-why); [Tom's Guide 2024](https://www.tomsguide.com/gaming/the-10-most-difficult-wordles-of-the-year); [Tom's Guide 2025](https://www.tomsguide.com/gaming/the-10-hardest-wordles-of-2025-these-are-the-puzzles-that-wrecked-streaks); [NZ Herald, 515 million Wordles](https://nzherald.co.nz/lifestyle/seven-things-we-learned-analysing-515-million-wordles/WK53JGWSRREBTBS5CSR2RNUEME)

### Inferences
- **What to log:** for every pour, log map id, order index, the full input (angle, power, spin, wait tick), the outcome, and the intended target if inferable. The sim is deterministic, so inputs alone allow server-side replay. Also log per night: tries, cleared or not, pours used, and help used.
- **Fitting human noise directly** is the best calibration step. On a successful pour, or a near miss, find the nearest cluster centre from Q2 and take the residual (actual − centre). The spread of residuals across many players is an empirical σ_angle and σ_power, split by device (touch vs. mouse). This fills the main gap in Q3.
- **Per-map difficulty:** fit a Bayesian 1PL model, logit P(clear try t) = θ_player − b_map (+ a learning term per try), with a weak prior on b_map. Use the simulator's predicted difficulty as the **prior mean** for b_map: b_map ~ N(α + β·logit(p_sim), τ²). The fitted α, β, τ show how well the simulator predicts players. Refit weekly in a small script (TypeScript Newton/IRLS or a one-off Python/Stan run).
- **Online alternative:** run Glicko-2 per map and per player, Lichess-style. Each map faces thousands of players in its one day, so its rating converges fast. Its value is mostly for comparing maps across days.
- **Public reporting, Wordle-style:** post the daily "average tries" and "clear rate", with a fixed convention for failures (for example, failure counts as B+1 tries, mirroring NYT's 7.5 on a 6-guess game).
- **Feedback into the generator:** once β is fitted, the generator can (1) reject candidates outside a target p_night band for the day of week (for example easy Monday, hard weekend, a NYT-crossword-style ramp), (2) rank accepted candidates by closeness to the target, and (3) use the feature regression from Q3 to explain outliers and adjust generation priors. Re-check about monthly: if realised clear rate diverges from predicted, refit σ.

### Gaps
- Lichess's exact Glicko-2 parameters for puzzles (initial rating, RD, volatility τ) could not be fetched; the lila source code is the authoritative reference.
- No source found on how Chess.com computes puzzle ratings.
- I found no source on a daily physics game calibrating a simulator against telemetry; this pipeline is synthesised from the puzzle and match-3 literature.

## 5. Performance: how many headless matter-js simulations are feasible in Node/TypeScript, and speed-up tricks

### Takeaway
On the real Last Orders sim, **one pour costs about 0.16 to 0.4 ms (1.8 to 4.8 µs per 1/60 s step), or about 2,600 to 5,400 pours per second per core**. Pours later in a night cost more because the prefix pours are replayed. A full per-map analysis (about 10k grid sims plus about 1k Monte Carlo sims per order, plus about 200 full-night rollouts per skill tier) fits in roughly 10 to 60 s on one core. That is cheap enough for every candidate in nightly CI. The bigger cost today is the generator itself: up to 22 s for one date, because candidates are rejected.

### Cited Findings
- No published headless-Node benchmark for matter-js `Engine.update` was found. matter-js docs say more position/velocity iterations and smaller timesteps raise quality at a performance cost. v0.15.0 claimed up to about 30% faster than v0.14.2. — [matter-js Engine docs](https://brm.io/matter-js/docs/classes/Engine.html); [matter-js release notes mirror](https://code.fosterhangdaan.com/foster/liabru-matter-js/raw/commit/07927162fc508011c3f677bdf00bf0b153cbe3e6/RELEASE.md)
- A third-party claim that matter.js slows down past about 500 moving bodies has no methodology, and an older benchmark called matter.js one of the slower JS engines. Both are weak sources; Last Orders uses only 5 to 12 bodies. — [learnwithhasan](https://learnwithhasan.com/js-libraries/matter-js/); [dev.to webworker physics](https://dev.to/jerzakm/running-js-physics-in-a-webworker-part-1-proof-of-concept-ibj)
- Local benchmark (node v22.23.5, matter-js ^0.20, positionIterations 10, velocityIterations 8), first pour of the solver's plan:

  | Map | Bodies | Steps | Time per pour | Time per step | Pours/s/core |
  |---|---|---|---|---|---|
  | 2026-11-21 | 10 | 68 | 0.22 ms | 3.2 µs | ≈4,650 |
  | 2026-11-22 | 12 | 79 | 0.38 ms | 4.8 µs | ≈2,640 |
  | 2026-11-23 | 5 | 101 | 0.18 ms | 1.8 µs | ≈5,400 |

  Generating these maps took 22,223 ms, 7,122 ms and 4 ms respectively. — Local experiment (`bench.ts`)
- Local experiment: with prefix replay, per-sim cost rose from about 0.3 ms for order 1 to about 1.1 ms for order 4 on 2026-11-22. That is about 1,000 sims in 0.3 s for order 1 and 1.17 s for order 4. — Local experiment (`metrics.ts`)

### Inferences
- **Budget per candidate map**, with about 3k sims/s/core as a conservative rate:
  - Coarse grid of about 11.5k sims per order × 4 orders: about 15 to 30 s with prefix replay.
  - Monte Carlo of 300 samples × 3 tiers × 4 orders: about 3.6k sims, roughly 2 s.
  - Full-night rollouts with re-planning, 200 per tier × 3 tiers: dominated by re-planning. With a 300-sim re-plan budget per pour that is about 600 nights × 4 pours × 300 sims ≈ 720k sims, about 4 minutes on one core and about 1 minute on 4 workers.

  Run them as `worker_threads`, one per core; the 4 vCPUs here give about a 4× speed-up, since the work is independent. A 365-day lookahead batch is feasible overnight.
- **Tricks, by payoff:**
  1. **Prefix snapshotting.** Replay the prefix once, then clone the state rather than replaying for every candidate. matter-js has no built-in clone, so either rebuild a Sim from a serialisable state (positions, velocities, angles, puddles, tick, orders) or keep the current replay but cache `base` per prefix. Replay costs only about 0.2 to 0.4 ms per prior pour, so this is a 2 to 4× win on late orders, not a must.
  2. **Early termination** inside `playShot`: stop when the pour can no longer reach the target circle (for example its stopping distance from `stopDistance(speed)` along the current heading can't reach the circle and no bodies are moving towards it), or when a fail state triggers (sheriff hat, off the bar). The game already stops after 8 quiet steps or 1,500 steps.
  3. **Coarse to fine.** Grid, then boundary refinement, then Monte Carlo at cluster centres only. Plus kernel convolution on the grid (Q2) to get p(aim) without new sims.
  4. **Sequential stopping** for Monte Carlo (Wilson interval), and common random numbers (the same noise draws for every map), which reduces variance when comparing maps.
  5. **Cache by (map hash, prefix hash, shot)** in a Map, because the sim is deterministic. Solver, robustness and metrics passes often re-test the same shots.
  6. Reduce iterations (for example positionIterations 6) **only for screening**, then re-verify finalists at production settings. A different setting can change outcomes, so the final verdict must use the exact production sim.
- **Determinism caveat:** fixed 1/60 s steps make Node and browser agree only if the floating-point paths match. Math.sin, cos and atan2 can differ in the last bits across JS engines. Back-testing on Node is safe for difficulty statistics, but server-side score verification should replay with the same engine family.

### Gaps
- No external benchmark exists for matter-js in Node, so the only numbers are the local ones above, from a small shared container; dedicated hardware is likely faster.
- I did not measure worker_threads scaling or the cost of a full re-planning rollout. Those figures are estimates extrapolated from the measured per-sim cost.
