# PCG methods for minigolf, golf, pool/billiards, curling-like and physics-puzzle levels (applied to "Last Orders")

Research notes, 2026-11-20. Method note: WebFetch could not reach several primary hosts from this session (gamedeveloper.com, cdn.aaai.org, users.cecs.anu.edu.au all failed DNS through the session's network allowlist). Most findings below therefore come from search-result abstracts and excerpts of the primary papers and pages, not full-text reads. Where details depend on a full text I could not open, they are listed under Gaps.

## Q1. What PCG families exist, and how have they been applied to golf and physics puzzles?

### Takeaway
Every family that has worked on physics puzzles pairs a generator (constructive, grammar or evolutionary) with an agent that plays the level in the real physics engine. The research generators for Cut the Rope and Angry Birds are grammatical evolution or search plus simulation. ASP/SAT and WFC suit discrete grid puzzles, not continuous physics. PCGML and LLMs are weak here because there is no training data and their output is not guaranteed playable.

### Cited Findings

**Framework and taxonomy**
- The canonical survey of search-based PCG is Togelius, Yannakakis, Stanley and Browne, "Search-Based Procedural Content Generation: A Taxonomy and Survey", IEEE TCIAIG vol. 3 no. 3, pp. 172–186, 2011. It sorts methods by what content is generated, how the content is represented, and how its quality or fitness is evaluated. — [UCF STARS record](https://stars.library.ucf.edu/scopus2010/2825/); [Semantic Scholar](https://www.semanticscholar.org/paper/Search-Based-Procedural-Content-Generation:-A-and-Togelius-Yannakakis/3288d7575f451d2e95f57cefc9566691ff272f1c)
- A newer survey of search-based PCG (arXiv 2311.04710, 2023) covers work after 2011. — [arXiv 2311.04710](https://arxiv.org/pdf/2311.04710)

**Template, chunk and grammar assembly**
- Spelunky (Derek Yu) builds each level as a 4x4 grid of 16 rooms. A path is first drawn from the entrance at the top to the exit at the bottom. Each room is then chosen from a template set, and which set depends on where the room sits on that path. — [Make Games, "The Full Spelunky on Spelunky"](https://makegames.tumblr.com/post/4061040007/the-full-spelunky-on-spelunky)
- Room templates contain randomized "chunks" for variation. One source-code analysis reports 6 to 12 templates per room type, each with obstacles, trap spots and gold spots placed by probability. — [Make Games](https://makegames.tumblr.com/post/4061040007/the-full-spelunky-on-spelunky); [Rooms and Obstacles analysis](https://takenapeveryday.wordpress.com/2014/01/04/rooms-and-obstacles/)
- Yu says destructible terrain and climbing tools smooth over problems caused by randomized layout. Anything off the guaranteed path can be messy. — [Make Games](https://makegames.tumblr.com/post/4061040007/the-full-spelunky-on-spelunky)
- Ropossum, the Cut the Rope generator, uses grammatical evolution: a grammar defines the level space and evolution searches over it. — [AIIDE 2013 paper page](https://ojs.aaai.org/index.php/AIIDE/article/view/12690); [ITU record](https://pure.itu.dk/en/publications/evolving-playable-content-for-cut-the-rope-through-a-simulation-b/)

**Constructive generate-and-test**
- The puttputt HTML5 mini-golf project uses a seeded generator. It carves corridors and rooms, then keeps each hazard only if the hole can still be reached from the tee. It validates every level as solvable, estimates par, and the same seed always gives the same level. — [GitHub PR, adamfoxdev/puttputt](https://github.com/adamfoxdev/puttputt/pull/1)
- Astro Golf, a 2019 gravity-golf game inspired by Desert Golfing, makes every level hole-in-one-able. Its developer tested a huge number of levels offline. They placed non-overlapping circles by rejection sampling, which became inefficient for dense levels. — [Show HN thread](https://news.ycombinator.com/item?id=21136364)

**Search-based (evolutionary) PCG**
- Stephenson and Renz (CIG 2016) note that earlier Angry Birds generators produced columns of single objects or small predefined structures, recombined by simple genetic algorithms to maximize stability. They argue this cannot produce anything more complex than an array of columns. — [ANU record, CIG 2016](https://researchportalplus.anu.edu.au/en/publications/procedural-generation-of-complex-stable-structures-for-angry-bird/)
- In their AIIDE 2016 generator, levels are built from self-contained structures placed across the level. The authors say the physics constraints of these games make level generation hard and make level quality hard to evaluate. — [ANU AIIDE16 PDF (search excerpt)](https://users.cecs.anu.edu.au/~jrenz/papers/stephenson-renz-aiide16.pdf)
- Their CIG 2017 extension adds bird-type selection, more structure diversity, terrain variation, difficulty estimation from agent performance, stability and solvability verification, and material selection. The authors report it "can generate a wide range of 2D levels that are both stable and solvable." — [ANU record, CIG 2017](https://researchportalplus.anu.edu.au/en/publications/generating-varied-stable-and-solvable-levels-for-angry-birds-styl/)
- "A Progressive Approach to Content Generation" (M. Shaker, N. Shaker, Togelius, Abou-Zleikha, EvoApplications 2015, pp. 381–393) works in two stages. First, search evolves game-independent timelines, the rhythm of when events happen. Second, a fast constructive step turns each timeline into a level so it can be evaluated. It was applied to Cut the Rope. The motivation was that simulation-based fitness with an agent playing the level is very slow. — [Springer chapter](https://link.springer.com/chapter/10.1007/978-3-319-16549-3_31); [AAU PDF (search excerpt)](https://vbn.aau.dk/ws/files/226436304/progressive.pdf)

**Quality-diversity (MAP-Elites and constrained variants)**
- Constrained MAP-Elites keeps two populations per archive cell, one feasible and one infeasible. It combines MAP-Elites with the FI-2Pop feasible-infeasible idea. In Mech-Elites (GVG-AI), "feasible" means an agent can win the level. — [Mech-Elites, arXiv 2002.04733](https://arxiv.org/pdf/2002.04733)
- Mech-Elites filled a little more than 10% of archive cells with elites for some games and slightly under 10% for others. — [arXiv 2002.04733](https://arxiv.org/pdf/2002.04733)
- Talakat (bullet hell, Khalifa et al.) uses a feasible-infeasible MAP-Elites variant. Fitness comes from simulation with a best-first-search agent. — [Khalifa, "Intentional Computational Level Design", arXiv 1904.08972](https://arxiv.org/pdf/1904.08972)
- Gravina et al., "Procedural Content Generation through Quality Diversity" (2019), is the overview position paper on QD for PCG. — [arXiv 1907.04053](https://arxiv.org/pdf/1907.04053)
- An open-source FI-MAP-Elites implementation for room-based level generation exists. — [GitHub konsfik/FI-MAP-Elites](https://github.com/konsfik/FI-MAP-Elites)
- The search found no QD study that uses a rigid-body physics simulation as its feasibility test. — (negative search result; see Gaps)

**Constraint solving (ASP / SAT / SMT)**
- Smith and Mateas (IEEE TCIAIG 2011), "Answer Set Programming for Procedural Content Generation: A Design Space Approach", use ASP to declare a generative space separately from the general-purpose solver that enumerates it. — [ResearchGate](https://www.researchgate.net/publication/224240207_Answer_Set_Programming_for_Procedural_Content_Generation_A_Design_Space_Approach)
- Variations Forever (CIG 2010) used ASP, not evolution, to search for viable mini-game rulesets. — [ResearchGate](https://www.researchgate.net/publication/224180078_Variations_Forever_Flexibly_generating_rulesets_from_a_sculptable_design_space_of_mini-games)
- "Quantifying over Play: Constraining Undesirable Solutions in Puzzle Design" (FDG 2013) used ASP to generate Refraction puzzles free of unintended shortcut solutions. — [FDG 2013 PDF](https://users.soe.ucsc.edu/~amsmith/papers/fdg2013_shortcuts.pdf)
- Horswill's "Answer Set Programming for PCG: the Good, the Bad, and the Ugly" is a practitioner critique of ASP for PCG. — [CEUR-WS Vol-3217](https://ceur-ws.org/Vol-3217/paper19.pdf)
- SAT Modulo Monotonic Theories (Bayless et al.) extends SAT with graph and reachability constraints, which can express connectivity in level generation. — [arXiv 1406.0043](https://arxiv.org/html/1406.0043.pdf)

**Wave Function Collapse**
- WFC is a constraint-satisfaction algorithm. Each step collapses one cell and then propagates the change to its neighbours. Gumin's reference implementation does not backtrack; on a contradiction (a cell left with zero possible tiles) it restarts from scratch. — [Boris the Brave, "WFC Explained"](https://www.boristhebrave.com/2020/04/13/wave-function-collapse-explained/)
- In one reimplementation, about 1 in 10 runs hit a contradiction (N=3, maze sample, 40x40). With backtracking added, all 30 test seeds succeeded on the first try. — [GitHub, plain-JS WFC](https://github.com/MohammadHossinzehi/wave-function-collapse)
- "WaveFunctionCollapse: Content Generation via Constraint Solving and Machine Learning" frames WFC as constraint solving. The search result did not show its authors; it is generally attributed to Karth and Smith, but I could not confirm that here. — [eScholarship PDF](https://www.escholarship.org/content/qt1fb9k44q/qt1fb9k44q_noSplash_1c5dcf5090d4595f7605b2653c89b245.pdf?t=qwpcsb)
- "Generating Paths with WFC" (arXiv 1808.04317) adds path and connectivity constraints to WFC. — [arXiv 1808.04317](https://arxiv.org/pdf/1808.04317)

**PCGML**
- Summerville et al., "Procedural Content Generation via Machine Learning (PCGML)" (IEEE Transactions on Games, 2018), defines PCGML as generating content with models trained on existing content. It lists learning from small datasets and lack of training data as open problems, and notes that most game content has strict structural constraints for playability. — [arXiv 1702.00539](https://arxiv.org/pdf/1702.00539)
- The survey also names repair, critique and content analysis as good uses of PCGML. — [arXiv 1702.00539](https://arxiv.org/pdf/1702.00539)
- Generate-then-repair methods have been developed to fix solvability failures in generated levels; see "Guided Game Level Repair via Explainable AI" (2024). — [arXiv 2410.23101](https://arxiv.org/pdf/2410.23101)

**LLM-based generation (physics game)**
- ChatGPT4PCG (IEEE CoG 2023) had entrants write prompts that make ChatGPT output Science Birds (Angry Birds clone) structures shaped like capital letters. Entries were scored on generation time, physical stability, intended solvability or unsolvability, and accidental solvability. Science Birds was chosen because gravity makes stability the main quality measure. — [arXiv 2303.15662](https://arxiv.org/pdf/2303.15662)
- ChatGPT4PCG 2 (CoG 2024) added a diversity score to discourage repetitive levels. — [arXiv 2403.02610](https://arxiv.org/html/2403.02610)

### Inferences
- For a top-down slide game with a few object types and an existing seeded generator plus solver, the families split into three tiers:
  - **Directly usable now:** constructive generate-and-test (already in place), template/chunk assembly, and reverse generation (see Q3).
  - **Usable as an offline tool:** search-based or MAP-Elites over the generator's parameters. It could pre-compute a year's calendar of maps, or tune the parameter ranges for each weekday tier.
  - **Poor fit:** ASP/SAT/WFC, since friction physics is continuous and constraint solvers cannot model matter-js trajectories. LLM/PCGML, since there is no corpus, playability is not guaranteed, and LLM output is non-deterministic across clients.
- Ropossum is the closest academic analogue: grammar plus evolution plus a playing agent inside the physics engine. Its successor's lesson ("simulation fitness is too slow; use a fast constructive step guided by a timeline") argues for keeping the generator cheap and spending the simulation budget on validation, not optimization.
- The Spelunky pattern (guarantee the critical path first, then decorate around it) maps onto Last Orders. Fix a solution-shot corridor for each target, then add posts, rails and glasses only where they do not cut that corridor, or where they create a deliberate bank-shot route.
- The puttputt pattern ("keep a hazard only if the goal is still reachable") is an incremental version of generate-and-test. Re-run the solver after each obstacle is added and roll back any that break solvability. Rejections become cheaper because they are local.

### Gaps
- Exact grammar, mutation and population parameters of Ropossum, and the playable-level percentages reported, could not be read; the full text on cdn.aaai.org was unreachable.
- I found no published application of ASP, WFC or QD specifically to minigolf, curling or billiards level layout.

## Q2. Concrete game examples

### Takeaway
Commercial golf and physics-puzzle games with public generation details are rare. Desert Golfing is the main procedural reference: one seed for everyone, with human-staged constraints, and originally no guard against impossible holes. Most well-known golf puzzle games (Golf Peaks, What the Golf) are handmade with solvers or tools on the side. The Angry Birds and Cut the Rope research lines are the best-documented physics-puzzle generators. Daily-seed games (Spelunky, Wordle) show the "same content for everyone" pattern: a shared seed, or a pre-built list.

### Cited Findings

**Desert Golfing / Desert Golfing 2 / Golf On Mars (Justin Smith, Captain Games)**
- Every hole is procedurally generated, but "with human orchestrated constraints that slowly introduce new gameplay aspects, as well as environmental features and color palette changes." — [Wikipedia](https://www.wikipedia.com/wiki/Desert_Golfing)
- Reverse Shot describes it as an algorithm working "within certain parameters", plus "clearly, human orchestration". — [Reverse Shot](https://reverseshot.org/features/1927/desert_golfing)
- Smith framed procedural generation as a survival technique: how many golf holes could he design by hand? — [Game Developer, "7 questions for Desert Golfing creator Justin Smith" (via search snippet)](https://www.gamedeveloper.com/design/7-questions-for-i-desert-golfing-i-creator-justin-smith)
- Smith reportedly built no safeguard against generating an impossible hole at first; a later update prevented impossible holes. Community attention gathered around hole 19,491 as a possible "end". — [TouchArcade, "Is hole 19491 the end of Desert Golfing?" (2016-03-02)](https://toucharcade.com/2016/03/02/is-hole-19491-the-end-of-desert-golfing/); [Medium, Alec Thomson](https://medium.com/@alecthomson/the-end-of-desert-golfing-and-other-stories-from-mysterious-canadian-justin-smith-5179952261ac)
- In the sequel and in Golf On Mars, every hole is procedurally generated, but all players use the same seed and so play the same holes. — [TouchArcade, Golf On Mars (2020-06-19)](https://toucharcade.com/2020/06/19/golf-on-mars/)
- Someone stitched 10,000 Desert Golfing holes into one video, showing the terrain's continuity and variety. — [Pocket Gamer](https://www.pocketgamer.com/desert-golfing/someone-stitched-together-10-000-holes-in-desert-golfing-and-made-a-video)

**Golf Peaks (Afterburn, 2018)**
- Golf Peaks is a handmade grid puzzle-golf game. Level design is credited to Kamila Rusiecka. — [Afterburn press sheet](https://afterburn.games/press/sheet.php?p=golf_peaks)
- A fan-written solver completes its levels. The first worlds were solved from hand-written level files; later the Afterburn team sent the source level files. The solver models three move types: roll, chip, and chip-then-roll. — [GitHub nchlswhttkr/golf-peaks](https://github.com/nchlswhttkr/golf-peaks)
- The official devlog is mainly patch notes, for example v3.62 (Nov 6, 2025) with a Unity upgrade, and has no generation content. — [itch.io devlog](https://afterburn.itch.io/golf-peaks/devlog)

**Other golf indies**
- itch.io has a tag cluster of procedural golf games, including "Procedural Golf" and "MiniestGolf". — [itch.io golf+procedural tag](https://itch.io/games/tag-golf/tag-procedural); [Procedural Golf](https://cicolas.itch.io/procedural-golf)
- Astro Golf (Show HN, 2019) guaranteed that every level can be holed in one, verified offline. — [HN](https://news.ycombinator.com/item?id=21136364)
- The puttputt HTML5 project combines a seeded generator, hazard reachability checks and par estimation. — [GitHub PR](https://github.com/adamfoxdev/puttputt/pull/1)

**Cut the Rope / Ropossum (Shaker, Shaker, Togelius)**
- The AIIDE 2013 paper treats automatic playability checking as the key step. Cut the Rope has continuous time and state, which makes exhaustive search and reactive agents inefficient. A Prolog-based deliberative agent proposes all "sensible" moves in each state, which shrinks the space enough for depth-first search to find solutions. The same agent tests playability inside Ropossum, a grammatical-evolution generator. — [AIIDE 2013](https://ojs.aaai.org/index.php/AIIDE/article/view/12690); [ITU record](https://pure.itu.dk/en/publications/evolving-playable-content-for-cut-the-rope-through-a-simulation-b/)
- Ropossum is also an authoring tool that combines automatic design of complete solvable levels, designer input, automatic playability checks, and optimization of designs based on playability. — [ITU record, Ropossum tool](https://pure.itu.dk/en/publications/ropossum-an-authoring-tool-for-designing-optimizing-and-solving-c/); [Ropossum framework page](https://mohammadshaker.com/projects-2/ropossum-framework/)
- Games by Angelina's "Saturday Paper: Guaranteed Candy" (Nov 2013) is a popular write-up of the paper. — [gamesbyangelina.org](http://www.gamesbyangelina.org/2013/11/the-saturday-paper-guaranteed-candy/)

**Angry Birds: Stephenson & Renz, AIBIRDS level generation competition**
- AIBIRDS level generation competition winners: 2017, Matthew Stephenson's generator, with Funny Quotes (Ritsumeikan, 2016 champion) second. 2018 (CIG Maastricht), Stephenson's "Iratus Aves", which won fun, creativity and difficulty, with MelodyGen second. 2019 (CoG), MelodyGen by Ceren Kocaogullar. Judges scored fun, creativity/aesthetics and difficulty balance. — [AIBIRDS 2017 results](http://aibirds.org/level-generation-competition/2017-results.html); [2018 results](https://aibirds.org/other-events/level-generation-competition/2018-results.html); [2019 results](http://aibirds.org/level-generation-competition/results.html)
- A paper on the 2017 competition describes the format. — [ResearchGate](https://www.researchgate.net/publication/326363789_The_2017_AIBIRDS_Level_Generation_Competition)
- Later work on "Deceptive Level Generation for Angry Birds" (2021) deliberately generates levels that mislead naive agents. — [arXiv 2106.01639](https://arxiv.org/pdf/2106.01639)
- A sketch-to-structure follow-up (Stephenson, Ge, Zhang, Renz et al., TOG 2019) generates stable structures from human sketches. — [ANU TOG19 PDF (search excerpt)](https://users.cecs.anu.edu.au/~jrenz/papers/stephenson-et-al-tog19.pdf)

**Pool / billiards shot search (useful as solver patterns, not level generators)**
- PickPocket (M. Smith, AAAI 2006 and AIJ 2007) frames shot selection as expectimax search. Each candidate shot is simulated 200 times in a physics engine (poolfiz) with random perturbations to its parameters, modelling execution error, to estimate a success probability. — [AAAI 2006](https://cdn.aaai.org/AAAI/2006/AAAI06-156.pdf); [U Alberta PDF](http://webdocs.cs.ualberta.ca/~jonathan/PREVIOUS/Grad/Papers/pickpocket.pdf); [Artificial Intelligence 171 (2007)](https://www.sciencedirect.com/science/article/pii/S000437020700077X/pdf?md5=233c1c4c04e320f6539a8b8ebbfdccb0&pid=1-s2.0-S000437020700077X-main.pdf)
- Leckie and Greenspan distinguish two kinds of shot generation (as reported in AIJ 2007). Shot discovery searches cue parameters directly. Shot specification first picks a desired final position, then uses sampling and optimization to find a shot that reaches it. — [AIJ 2007](https://www.sciencedirect.com/science/article/pii/S000437020700077X/pdf?md5=233c1c4c04e320f6539a8b8ebbfdccb0&pid=1-s2.0-S000437020700077X-main.pdf)
- Poolimmersion uses Monte Carlo shot generation plus simulated annealing. After accepting a shot it tests noisy variants, aiming to find odd trick shots a deterministic search would miss. — [ResearchGate](https://www.researchgate.net/publication/321402249_Poolimmersion_A_realistic_physically-based_billiards_simulation)
- A three-cushion carom thesis (van Balen, U Twente) discretizes the shot parameters, simulates every combination with an event-based physics model, and keeps the results that meet the cushion-count rule. — [U Twente thesis](https://essay.utwente.nl/fileshare/file/59134/scriptie_J_van_Balen.pdf)
- An open-source Rust billiards engine includes programmatic solvers and shot-diagram generation. — [GitHub jmqd/billiards](https://github.com/jmqd/billiards)

**Daily shared-seed games**
- Spelunky HD's daily challenge uses a constant seed, so the daily cave is identical for every player. Spelunky 2 also gives everyone the same seed and a single attempt. A Steam thread disputes whether some contents (pots, crates) also vary. — [Spelunky wiki, Daily Challenge (HD)](https://spelunky.fandom.com/wiki/Daily_Challenge_Mode_(HD)); [Steam discussion](https://steamcommunity.com/app/239350/discussions/0/616187203875830097/); [PlayStation Blog, 2013-11-20](https://blog.eu.playstation.com/2013/11/20/daily-challenges-now-available-in-spelunky-on-ps3-and-ps-vita/)
- Wordle's answers were a pre-curated list of 2,315 words in the client code, used in a fixed order. The NYT later removed six words (to 2,309) and has since added words. — [Bernoff analysis](https://bernoff.com/blog/wordle-revised-mathematical-analysis-of-the-first-guess); [Georgia Tech paper](https://mshort9.math.gatech.edu/papers/wordlewisely.pdf); [Beebom](https://beebom.com/puzzle/unused-wordle-words/)
- Since November 2022 an NYT editor, Tracy Bennett, has curated Wordle's word selection. — [The Basis Point](https://thebasispoint.com/when-does-wordle-end-nyt-editor-tracy-bennett-answers-details-her-dream-job/)
- An itch.io indie ball game devlog describes adding daily challenges. — [raulf.itch.io devlog](https://raulf.itch.io/ball/devlog/932608/daily-challenges)

### Inferences
- Desert Golfing is the right public precedent for a daily physics map. It shows that a shared seed plus staged human constraints produces a "same for everyone" social experience. Its early lack of an impossibility guard (later patched) shows why Last Orders' solver gate matters.
- The Wordle model (a pre-curated, pre-validated list) is a strong option for a hackathon. Run the seeded generator offline for every date from launch to well past the judging window, run the solver and robustness checks at high budget, have a human skim or veto, and ship a frozen JSON calendar keyed by UTC date. Runtime generation from the seed stays as a fallback for dates past the list. This avoids heavy solver work on the client and makes "same map for everyone" depend on a lookup rather than on floating-point reproduction across browsers.
- PickPocket's "simulate each shot N times with perturbed inputs" is the established way to measure robustness, and it matches Last Orders' existing robustness check. The fraction of perturbed shots that still score can be reported as a difficulty number for each target.
- The shot-specification paradigm (pick the final resting point, then search for the shot that gets there) is effectively reverse generation applied to shots. Choose where the drink should stop (the target circle), then search angle, power and spin. It can be used to place targets where a known shot ends up (see Q3).

### Gaps
- No public technical detail was found on generation in Golf With Your Friends, Golf It!, Walkabout Mini Golf, What the Golf or Super Battle Golf. As far as the searches show, their courses are handmade or user-built in editors, but I could not confirm procedural modes from primary sources.
- I did not verify how Slay the Spire's Daily Climb seed works; searches returned nothing on it.
- I found no technical write-up of Tiny Wings' terrain generation.
- Desert Golfing's actual terrain algorithm (e.g. how the heightmap is built, how parameters ramp) is not public in the sources found; the primary interview page was unreachable.

## Q3. How do generators guarantee solvability and avoid degenerate maps with physics?

### Takeaway
There are three proven strategies:
- Simulation in the loop: an agent or solver plays the level in the actual engine.
- Reverse or solution-first construction: build the level around a known solution.
- Constructive guarantees: guarantee a critical path first, then decorate.

Physics generators use simulation every time, because "theoretically fine" layouts break in the engine. Quality (non-trivial, no shortcut solutions, robust to small errors) needs checks beyond plain solvability.

### Cited Findings
- Pereira et al. note that structures that are theoretically stable can collapse when simulated in an engine, which is why Stephenson and Renz evaluate stability by simulation. — [Pereira et al. 2016 PDF](https://webdocs.cs.ualberta.ca/~santanad/papers/2016/pereiraTFL16.pdf)
- Stephenson and Renz (CIG 2017) add explicit stability and solvability verification, and estimate difficulty from agent performance. — [ANU record](https://researchportalplus.anu.edu.au/en/publications/generating-varied-stable-and-solvable-levels-for-angry-birds-styl/)
- For Cut the Rope, the agent prunes continuous action spaces down to "sensible moves" so that DFS becomes tractable. Playability is the evolution's hard filter. — [AIIDE 2013](https://ojs.aaai.org/index.php/AIIDE/article/view/12690)
- Simulation-based fitness is "very time-demanding". The progressive approach moves search to a cheap abstract representation (timelines) and uses a fast constructive mapping. — [Springer, EvoApplications 2015](https://link.springer.com/chapter/10.1007/978-3-319-16549-3_31)
- Taylor and Parberry (2011) generate Sokoban levels backwards from the goal state. The result is guaranteed solvable, and generation is fast enough for offline use on a regular PC. — [Taylor & Parberry tech report](https://ianparberry.com/techreports/LARC-2011-01.pdf); [Semantic Scholar](https://www.semanticscholar.org/paper/Procedural-Generation-of-Sokoban-Levels-Taylor-Parberry/702b8c6205a1f8b65dd5515807c792454b4ea7a2)
- Reverse Sokoban generators put every crate on a goal, then "pull" crates away, the reverse of a push. They choose one of the deepest positions found, preferring solutions that keep switching between crates. One generator uses three phases: topology, target and player placement, reverse play. — [abagames, "Automatic Level Generation for Puzzle Games"](https://abagames.github.io/joys-of-small-game-development-en/procedural/puzzle_level.html); [gym-sokoban](https://pypi.org/project/gym-sokoban/0.0.6/)
- The same reverse idea has been applied to a slide-based puzzle by reversing slides from the destination. — [abagames](https://abagames.github.io/joys-of-small-game-development-en/procedural/puzzle_level.html)
- Caveats on reverse generation: the shortest reverse path does not have to match the shortest forward path. One solo developer found that backward generation still produced deadlocked or unsolvable levels in practice. Sokoban solvability is PSPACE-complete in general. — [abagames](https://abagames.github.io/joys-of-small-game-development-en/procedural/puzzle_level.html); [dev.to, "I Built a Procedural Sokoban Generator in One Day..."](https://dev.to/yurukusa/i-built-a-procedural-sokoban-generator-in-one-day-heres-why-it-kept-making-unsolvable-levels-5191) (informal source)
- Refraction's ASP generator quantifies over play to forbid undesired shortcut solutions, not just to require one solution. — [FDG 2013](https://users.soe.ucsc.edu/~amsmith/papers/fdg2013_shortcuts.pdf)
- ChatGPT4PCG scores "intended solvability" and "accidental solvability" separately, recognizing that a level can be solvable in unintended ways. — [arXiv 2303.15662](https://arxiv.org/pdf/2303.15662)
- In constrained MAP-Elites, the agent's evaluation can mislabel levels: an unwinnable level can be judged feasible, or a winnable one infeasible, depending on how the evaluation runs. — [arXiv 2002.04733](https://arxiv.org/pdf/2002.04733)
- Astro Golf guaranteed a strong property (every level hole-in-one-able) by large offline computational testing. — [HN](https://news.ycombinator.com/item?id=21136364)
- PickPocket estimates success under execution noise with 200 perturbed simulations per shot. — [AAAI 2006](https://cdn.aaai.org/AAAI/2006/AAAI06-156.pdf)

### Inferences (applied to Last Orders)
- **Solvability gate (already present).** Keep the greedy solver plus robustness check as the hard filter. Add a "shortcut" check like Refraction's: reject maps where a single trivial straight shot scores every target, or where the hazard and arm are never relevant to any found solution. A cheap test is to re-solve with the obstacle removed. If the solution set is unchanged, the obstacle is decoration; drop it or move it into the solution corridor.
- **Reverse construction for a slide game.** The physics is deterministic with a fixed step, so the generator can "shoot first, then place". It would:
  1. sample a launch (angle, power, spin) from the pour point;
  2. simulate it with only rails and posts present;
  3. put the target circle where the drink comes to rest;
  4. add glasses or the peanut bowl along or beside that trajectory, re-simulating as it goes so the intended shot still lands.

  This is the shot-specification idea from billiards plus Taylor-Parberry backward generation. A single target is solvable by construction, and the forward solver only has to confirm robustness and check that targets do not interfere when several pours share the bar.
- **Degenerate-map guards worth encoding** (from the failure modes above): drinks resting on open edges; targets reachable only within a razor-thin window (use a perturbation success-rate threshold, e.g. require at least X% of perturbed shots to succeed); the arm timing making a target solvable only at one exact frame; glasses stacked so the first collision is chaotic. Cross-browser floating-point differences are another risk; mitigate with integer or quantized state or the frozen-calendar approach.
- **Difficulty estimation from agents.** Use the solver's search effort, solution count and perturbation success rate to label difficulty, as Stephenson and Renz did with agent performance, and map those labels onto the weekday tiers instead of setting difficulty only through generator parameters.

### Gaps
- I found no published account of solvability guarantees for a curling-like friction-slide puzzle specifically.
- The exact simulation lengths and timeouts used by Stephenson and Renz could not be read (full PDF unreachable).

## Q4. Which approach fits a small deterministic 2D top-down slide game best? Trade-offs

### Takeaway
The best fit is a hybrid: grammar or template-based constructive generation, with reverse "shot-first" placement of targets, gated by the existing simulation solver and robustness check. It runs offline over a long date range to produce a pre-validated, optionally human-vetted calendar, with the runtime seeded generator plus the handmade map as fallbacks. Evolution or MAP-Elites is worth it only as an offline tuner for the weekday difficulty tiers. ASP/WFC/PCGML/LLM are poor value before a December 2026 deadline.

### Cited Findings (evidence for the trade-offs)
- Controllability: Desert Golfing's human-staged constraints (feature introduction, palette shifts) gave authorial pacing on top of randomness. — [Wikipedia](https://www.wikipedia.com/wiki/Desert_Golfing)
- Spelunky gets authored feel cheaply from 6 to 12 hand templates per room type plus randomized chunks. — [Make Games](https://makegames.tumblr.com/post/4061040007/the-full-spelunky-on-spelunky); [Rooms and Obstacles](https://takenapeveryday.wordpress.com/2014/01/04/rooms-and-obstacles/)
- Compute cost: simulation-based evaluation inside an evolutionary loop is "very time-demanding". — [Springer 2015](https://link.springer.com/chapter/10.1007/978-3-319-16549-3_31)
- Variety: MAP-Elites archives illuminate diversity explicitly, but fill rates can be low (about 10% of cells in Mech-Elites). — [arXiv 2002.04733](https://arxiv.org/pdf/2002.04733)
- WFC without backtracking can fail around 10% of runs on modest grids. — [GitHub plain-JS WFC](https://github.com/MohammadHossinzehi/wave-function-collapse)
- Authoring cost of constraint solving: ASP separates the design-space description from the solver, but practitioners note real downsides ("the Bad, and the Ugly"). — [Horswill, CEUR-WS](https://ceur-ws.org/Vol-3217/paper19.pdf)
- PCGML needs training data the game does not have. — [arXiv 1702.00539](https://arxiv.org/pdf/1702.00539)
- LLM generation needs stability and solvability evaluation anyway, and a diversity metric had to be added to stop repetitive outputs. — [arXiv 2303.15662](https://arxiv.org/pdf/2303.15662); [arXiv 2403.02610](https://arxiv.org/html/2403.02610)
- Pre-curated daily content (Wordle) with an editor in the loop is a proven model for daily puzzles. — [Bernoff](https://bernoff.com/blog/wordle-revised-mathematical-analysis-of-the-first-guess); [The Basis Point](https://thebasispoint.com/when-does-wordle-end-nyt-editor-tracy-bennett-answers-details-her-dream-job/)

### Inferences: comparison for Last Orders

| Approach | Controllability | Variety | Compute | Authoring cost (solo, hackathon) | Fit |
|---|---|---|---|---|---|
| Constructive generate-and-test (current) | Medium, via parameter ranges | Medium | Low–medium; rejection loop | Low (exists) | Keep as the backbone |
| Template/chunk assembly (bar "modules": rail segments, post clusters, glass racks, arm bay) | High | Medium; grows with template count | Very low | Low–medium; author 10–30 small chunks | High: easiest way to get a handmade feel |
| Grammar (sequence of bar segments: "bouncy-bank, then post gate, then target") | High | Medium–high | Low | Medium | Good: also a handy way to express weekday tiers |
| Reverse / shot-first placement | High (difficulty set by chosen shot) | Medium | Low (one simulation per placement) | Low–medium | High: fits deterministic fixed-step physics; few rejections |
| Search-based EA / MAP-Elites (offline) | Medium (fitness design) | High, explicit diversity | High (simulation per evaluation) | Medium–high | Optional: offline tuning of tier parameters or picking the best of N seeds |
| ASP / SAT / SMT | Very high for discrete constraints | High | Variable | High; continuous physics not expressible | Low: only for discrete layout pre-passes |
| WFC | Medium (tile adjacency) | High visual variety | Low–medium | Medium; needs a tileset | Low: the bar is a 1-D strip with few objects |
| PCGML | Low | Unknown | Training cost | High; no data | Very low |
| LLM | Low–medium (prompting) | Medium | API cost or latency | Low to try, high to make reliable | Very low for runtime; maybe for theming or flavour text only |

Recommended pipeline (inference, not from a source):
1. Use a weekday tier, mapped to grammar or template parameters (number of pours, which hazards are enabled, glass count, arm period).
2. Assemble the bar from chunks: rails of each type, open-edge sections, post clusters.
3. For each pour, place the target shot-first: sample a plausible shot, simulate, and put the target where the drink rests. Add the peanut bowl or glasses to reward a bank or combination route.
4. Gate with the forward solver plus perturbation robustness (a PickPocket-style success rate), a shortcut check (removing an obstacle changes the solution set), and degenerate-state checks.
5. Score candidates on difficulty, using solver effort and success rate, and on novelty against recent days. Keep the best of K seeds for that date: a cheap, deterministic "best-of-N" search, which approximates search-based PCG without a full EA.
6. Precompute a frozen calendar offline (Wordle model) for the launch and judging window. Keep runtime seeded generation and the handmade fallback for out-of-range dates or validation failures.

Determinism: if the map is generated on the client from a seed, any floating-point divergence across browsers in the solver loop could change which candidate is accepted, so different players could get different maps. Shipping the accepted map data (not just the seed), or a precomputed calendar, removes this risk.

### Gaps
- I found no benchmark comparing these methods' compute cost on matter-js specifically. Solver cost per map has to be measured in the project.
- I found no source quantifying player perception of procedural versus handmade daily maps for golf-like games.
- Recent (2025–2026) work on LLM-in-the-loop physics level generation beyond ChatGPT4PCG 2 was not surveyed.
