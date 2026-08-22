# Tetris AI Algorithms: Research Report

*Generated: 2026-08-21 | Sources: ~30 (web + 4 reference codebases deep-read) | Confidence: High*

Research driver: three planned improvements to `tetris-solver`:

1. **Flatness discipline** — avoid placements that block future flat ground.
2. **Advanced move finding** — tucks/slides under overhangs, T-spins and kick-based spins.
3. **Stack & score without self-blocking** — don't burn the tetris opportunity, don't cover the well.

## Executive Summary

The strongest Tetris AIs share three architectural pillars, each mapping to one of our goals. (1) They evaluate boards with transition-based features (row/column transitions) plus *classified* hole features and explicit dependency detection, rather than raw bumpiness — and the best tune weights with cross-entropy/CMA-ES, reaching ~35–51M lines vs ~660K for hand-tuned. (2) They enumerate placements with a reachability search (BFS/Dijkstra over `(x, y, rotation)` states with left/right/rotate/drop edges plus SRS kick tables), which finds tucks and T-spins as a natural byproduct — our current hard-drop-only enumeration structurally cannot. (3) They make "score vs stack" an *economic* decision: burns (non-tetris clears) carry an explicit per-line cost, tetrises a large reward, well-covering a cubic-in-height penalty, and "tetris-ready" a bonus — so patience and burning both emerge from the evaluation rather than hard rules. StackRabbit (NES scoring, superhuman) and Cold Clear (modern guideline, Rust) are the two reference implementations, and both were read directly.

---

## 1. Board Evaluation: Keeping the Surface Flat Without Blocking Yourself

### 1.1 The classic feature sets

**Dellacherie (2003)** — hand-tuned six-feature linear evaluator, ~660,000 lines on 10×20 with one-piece greedy play ([Algorta & Şimşek survey, arXiv 1905.01652](https://ar5iv.labs.arxiv.org/html/1905.01652)):

```
score = −landing_height + eroded_cells − row_transitions − column_transitions − 4·holes − cumulative_wells
```

- **Eroded piece cells** = (lines cleared this move) × (cells of the placed piece within those lines). The only positive clear term — rewards clears that *use* the current piece, discouraging clears that leave garbage behind.
- **Cumulative wells** = per well of depth d, cost 1+2+…+d = d(d+1)/2 — quadratic penalty on deep wells.
- Row/column transitions count full↔empty adjacencies (walls count as full).

**El-Tetris (2011)** — same six features, PSO-tuned weights ([reimplementation](https://github.com/YuhanXiaoJY/Implementation-of-El-Tetris); original blog is offline, weights widely corroborated):

| Feature | Weight |
|---|---|
| Landing height | −4.5002 |
| Eroded cells | +3.4181 |
| Row transitions | −3.2179 |
| **Column transitions** | **−9.3487** |
| Holes | −7.8993 |
| Well sums | −3.3856 |

Column transitions carry ~3× the weight of row transitions — it is the strongest "no overhangs in the making" signal, because every hole roof adds column transitions the moment it's created.

**BCTS (Thiery & Scherrer 2009)** — Dellacherie + **hole depth** (filled cells above each hole) + **rows with holes** (≈ burns needed). Cross-entropy tuned: ~35M lines. CBMPI (Gabillon et al. 2013) is the best published at ~51M lines ([survey](https://ar5iv.labs.arxiv.org/html/1905.01652)).

### 1.2 How the elite bots encode flatness (firsthand code reading)

**Cold Clear** ([bot/src/evaluation/standard.rs](https://github.com/MinusKelvin/cold-clear/blob/master/bot/src/evaluation/standard.rs)) — verified directly from source:

- **Bumpiness excluding the well column**, both linear and squared: `bumpiness: -24, bumpiness_sq: -7`. A deliberate well must not read as roughness.
- **Three hole classes with very different prices**: `cavity_cells: -173` (truly enclosed), `overhang_cells: -34` (empty cells under a ledge, recoverable by tuck/spin — classified by checking neighbor-column heights), `covered_cells: -17` (fill stacked above the topmost hole, capped 6/hole, plus squared term). This is the key insight for goal #1: *an overhang you can still tuck under is 5× cheaper than a sealed cavity*.
- **Escalating height terms**: `height: -39`, `top_half: -150` (per cell above row 10), `top_quarter: -511` (above row 15) — piecewise risk instead of one threshold.
- **T-slot pattern detection**: detects sky T-slots, TST twists, and fin shapes on the surface, virtually places T pieces into them, and rewards board shapes containing them (`tslot: [8, 148, 192, 407]` by lines cleared). The bot *builds* T-spin setups because boards containing them score higher.
- `row_transitions: -5` retained as a general fragmentation term.

**StackRabbit** ([src/cpp_modules/src/eval.cpp](https://github.com/GregoryCannon/StackRabbit/blob/master/src/cpp_modules/src/eval.cpp), [params.hpp](https://github.com/GregoryCannon/StackRabbit/blob/master/src/cpp_modules/src/params.hpp)) — verified directly from source:

- **Surface rank table (value iteration)**: encodes the 9-column surface as base-7 (each adjacent height diff clamped to [−3,+3] → digit), indexing a precomputed table of surface values learned by value iteration. *Every reachable surface shape has a learned value* — the strongest known flatness treatment. Diffs beyond ±3 add `extremeGapCoef` penalties.
- **Explicit dependency detection** (fallback `calculateFlatness()`): a +3 rise immediately after a −3 drop = a 1-wide, depth-3 notch that only a vertical I fills → flat 25-point penalty. Cheap and proven.
- **Accessibility features** (NES-specific but instructive): columns higher than what the input speed can reach are penalized quadratically (`inaccessibleLeft/Right: -100/-200`).

**Human stacking theory** that motivates these: stack "flat but not too flat" so S/Z still fit; avoid dependence on one piece type; checkerboard parity constrains which pieces can lie flat on a given surface ([Hard Drop stacking wiki](https://harddrop.com/wiki/Tetris_stacking), [parity](https://harddrop.com/wiki/Parity) — snippet-sourced, direct fetch 403'd).

### 1.3 Weight tuning and lookahead

| Method | Result | Source |
|---|---|---|
| Hand-tuned (Dellacherie) | ~660K lines | [survey](https://ar5iv.labs.arxiv.org/html/1905.01652) |
| GA, 4 features (aggregate height/lines/holes/bumpiness) | thousands of lines | [Code My Road](https://codemyroad.wordpress.com/2013/04/14/tetris-ai-the-near-perfect-player/) |
| Cross-entropy (BCTS) / CMA-ES (Boumaza) | ~35M lines | [survey](https://ar5iv.labs.arxiv.org/html/1905.01652) |
| CBMPI | ~51M lines (best published) | [survey](https://ar5iv.labs.arxiv.org/html/1905.01652) |
| PSO, 17 features, 2-piece BFS (NES score objective) | median 989K NES pts, 47% max-out | [meatfighter](https://meatfighter.com/tetrisairevisited/) |

- **Lookahead is worth orders of magnitude**: Böhm et al. jumped from ~10⁵–10⁶ lines (1-piece) to 4.8×10⁸ with 2-piece search ([survey](https://ar5iv.labs.arxiv.org/html/1905.01652)). StackRabbit does depth-2 deterministic search pruned to top-N, then **300 Monte Carlo playouts × depth 5** past the preview ([high_level_search.cpp](https://github.com/GregoryCannon/StackRabbit/blob/master/src/cpp_modules/src/high_level_search.cpp), [params.ts](https://github.com/GregoryCannon/StackRabbit/blob/master/src/server/params.ts)). Cold Clear runs a DAG/beam search ~14 moves deep over the preview queue ([dag.rs](https://github.com/MinusKelvin/cold-clear/blob/master/bot/src/dag.rs); "14 moves" is single-source via [Galactoid](https://galactoidtetris.wordpress.com/2021/02/06/learning-to-play-like-cold-clear/)).
- Optimize weights against the outcome distribution you care about: meatfighter's PSO fitness = mean of best 33 of 100 runs, deliberately selecting for aggression.
- Pure neural/RL approaches historically underperform these feature-based linear evaluators on lines cleared ([survey](https://ar5iv.labs.arxiv.org/html/1905.01652)).

---

## 2. Move Finding: Tucks, Slides, and Spins

### 2.1 The core reframing — placement enumeration is reachability search

Consensus across every strong bot: enumerate placements by graph search where **nodes are piece states `(x, y, rotation)`** and **edges are legal inputs** {left, right, soft drop, rotate CW/CCW, (180 where supported)}. A placement is valid iff the piece is supported *and the state is reachable from spawn*. "Try each rotation × column and drop" — what our solver does today — misses every tuck and spin.

- **meatfighter (NES)**: plain BFS from spawn, interleaving player inputs with forced gravity steps — tucks (sliding sideways under an overhang mid-fall) fall out naturally. Also rejects placements that would block spawning or partition the field (seed-fill check). ([Nintendo Tetris AI Revisited](https://meatfighter.com/tetrisairevisited/))
- **Cold Clear** ([libtetris/src/moves.rs](https://github.com/MinusKelvin/cold-clear/blob/master/libtetris/src/moves.rs), verified from source): Dijkstra-flavored BFS using a `BinaryHeap` ordered by input time then input count, so the first path found to a state is the cheapest. Visited set = `HashSet<FallingPiece>` (position + rotation + spin status); locked placements collected in a `HashMap` keyed by `piece.canonical()` — canonicalization merges symmetric rotations so S/Z/I (2 shapes) and O (1 shape) don't duplicate. Speed tricks: precomputed `zero_g_starts` (all above-stack states trivially reachable in open air, applied when stack height < 16) so search effort concentrates near the stack, and a fast mode that prunes above-stack states *except* when the piece has T-spin status. Also models DAS repeats and per-input time costs.
- **MisaMino**: cheaper approximation — enumerate {above-stack placements} × {post-sonic-drop maneuver sequences of moves/rotates incl. SRS kicks}; still finds tucks and TSTs ([harddrop wiki](https://harddrop.com/wiki/MisaMino), single-source).
- **knewjade's set-parallel bitboard method** (fastest known): represent the *entire reachable-position set per rotation state* as a bitboard; one `reachable |= shift(reachable, dir) & free[rot]` advances the whole frontier at once; SRS kicks applied set-wide with AND-NOT masking (first-passing-kick semantics); iterate to fixpoint; placements = reachable positions that can't move down. ([gist](https://gist.github.com/knewjade/df3403a266c4eea33c2c94fb3fb7c3b2), Rust impl: [bitris](https://github.com/knewjade/bitris))

**Cost envelope**: state space ≤ ~10 cols × 25 rows × 4 rotations ≈ 1,000 nodes × ≤6 edges — microseconds even naively on a 10-wide board. The optimizations matter because movegen runs once per node of the lookahead tree (10⁴–10⁶ times per decision). Our board can be ~40×80, so the state space is ~40×80×4 ≈ 12.8K nodes — still cheap for 1-ply, and the existing column-window trick composes with it.

### 2.2 SRS kick tables (required for spins)

From [tetris.wiki/Super_Rotation_System](https://tetris.wiki/Super_Rotation_System): on rotation, try 5 offsets in order, first non-colliding wins; all fail → rotation fails. (+x right, +y up; states 0=spawn, R, 2, L.)

**J, L, S, T, Z:**

| Transition | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| 0→R | (0,0) | (−1,0) | (−1,+1) | (0,−2) | (−1,−2) |
| R→0 | (0,0) | (+1,0) | (+1,−1) | (0,+2) | (+1,+2) |
| R→2 | (0,0) | (+1,0) | (+1,−1) | (0,+2) | (+1,+2) |
| 2→R | (0,0) | (−1,0) | (−1,+1) | (0,−2) | (−1,−2) |
| 2→L | (0,0) | (+1,0) | (+1,+1) | (0,−2) | (+1,−2) |
| L→2 | (0,0) | (−1,0) | (−1,−1) | (0,+2) | (−1,+2) |
| L→0 | (0,0) | (−1,0) | (−1,−1) | (0,+2) | (−1,+2) |
| 0→L | (0,0) | (+1,0) | (+1,+1) | (0,−2) | (+1,−2) |

**I piece** (4×4 box, different table):

| Transition | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| 0→R | (0,0) | (−2,0) | (+1,0) | (−2,−1) | (+1,+2) |
| R→0 | (0,0) | (+2,0) | (−1,0) | (+2,+1) | (−1,−2) |
| R→2 | (0,0) | (−1,0) | (+2,0) | (−1,+2) | (+2,−1) |
| 2→R | (0,0) | (+1,0) | (−2,0) | (+1,−2) | (−2,+1) |
| 2→L | (0,0) | (+2,0) | (−1,0) | (+2,+1) | (−1,−2) |
| L→2 | (0,0) | (−2,0) | (+1,0) | (−2,−1) | (+1,+2) |
| L→0 | (0,0) | (+1,0) | (−2,0) | (+1,−2) | (−2,+1) |
| 0→L | (0,0) | (−1,0) | (+2,0) | (−1,+2) | (+2,−1) |

O doesn't kick. The test-5 kicks that translate the piece down 2 rows are what make **T-spin triples** possible. 180° rotation is non-guideline; games that support it define their own kick tables. Simpler systems (NES) have no kicks — tucks exist, spins don't.

### 2.3 T-spin rules ([tetris.wiki/T-Spin](https://tetris.wiki/T-Spin))

1. **Last-move rule**: the T's final maneuver must be a rotation (a subsequent shift/drop demotes it).
2. **3-corner rule**: ≥3 of the 4 cells diagonally adjacent to the T's center occupied (walls/floor count as filled).
3. **Full vs mini**: full = both *front* corners (pointing side) filled + ≥1 back; mini = one front + both back. **Test-5 exception**: if the final rotation used the (±1,∓2) kick, it's a full T-spin regardless — this is why TSTs score as full.
4. Alternative: **immobile rule** (can't move in any direction at lock) — basis of modern "all-spin" rulesets.

**Critical implementation detail**: spin status must be tracked *during* move generation (which kick passed, was last input a rotation), not derived afterward — Cold Clear stores `TspinStatus` on the falling piece and the evaluator prices each placement's clear kind accordingly. Move ordering changes classification.

### 2.4 Engine representation

- **Bitboard rows**: a 10-wide row fits in u16, our ≤64-wide rows in u64. Collision = AND, line clear = row == full mask, features via popcount/ctz. An RL-focused paper reports 53× speedup from bitboard collision/feature extraction ([arXiv 2603.26765](https://arxiv.org/abs/2603.26765)).
- Keep the active piece as precomputed rotated shape masks; "rotate by respawning the rotated shape" not by transforming cells.
- Dedup: hash on `(x, y, rotation, spin_status)`; canonical rotations for the lock set.

---

## 3. Strategy: When to Score, When to Stack, Never Block Yourself

### 3.1 StackRabbit's economics (the definitive scoring AI — 102M NES points, [demo](https://www.youtube.com/watch?v=l_KY_EwZEVA))

All verified from [params.hpp](https://github.com/GregoryCannon/StackRabbit/blob/master/src/cpp_modules/src/params.hpp) / [eval.cpp](https://github.com/GregoryCannon/StackRabbit/blob/master/src/cpp_modules/src/eval.cpp) / [eval_context.cpp](https://github.com/GregoryCannon/StackRabbit/blob/master/src/cpp_modules/src/eval_context.cpp):

- **Fixed right-edge well** (`WELL_COLUMN = 9`), hardcoded; the whole eval is built around it. **The well column is excluded from average-height accounting** so an empty well never reads as "low stack."
- **Burns are priced, not forbidden**: `burnCoef: -9` per non-tetris line vs `tetrisCoef: +50` and `tetrisReadyCoef: +6` (one I away from a tetris). NES scoring makes a tetris 7.5× more point-efficient per line than singles (300 vs 40/line, [NESTrisStatsUI](https://github.com/timotheeg/NESTrisStatsUI/blob/master/docs/stats.md)) — the weights mirror that ratio. Burning *emerges* when quadratic height/col-9 penalties exceed the burn cost; there is no "if height > X, burn" rule.
- **Three separate anti-self-blocking terms** (goal #3 answered directly):
  1. **Covered well**: a block over the well at row r costs `((20−r)/scareHeight)³` × difficulty (×10 if fixing needs a tuck) × `coveredWellCoef(-10)`. Cubic in height — low overhang nearly free, high one catastrophic.
  2. **Guaranteed burns**: every row with garbage in the well column counts as one forced future burn, each charged at `burnCoef`. A desperation piece in the well pays twice (covered-well + guaranteed-burn).
  3. **Unable-to-burn**: penalizes boards where burning would be *hard* (deep adjacent dependencies, holes in the burn zone), scaled by `(col9Height/scareHeight)³` — maintains the *option* of a cheap exit even while stacking.
- **Height thresholds derived from input speed, not constants**: `scareHeight ≈ 0.5·(max5TapHeight − 3..4) + 0.5·6`; above it, height is penalized quadratically. At level 18 it stacks high; at killscreen speeds tolerated height collapses automatically.
- **Mode switching** (`getAiMode()`): `DIG` when a true hole exists (burnCoef → −1: burning becomes nearly free), `NEAR_KILLSCREEN` when lines > 220 (tetrisCoef 50 → **500**: cash out before the killscreen), `LINEOUT` when taps can't reach (well abolished). Distinct weight tables per mode beat one universal set.
- **Randomizer risk**: NES RNG is near-memoryless (droughts unbounded; 13+ pieces without I = drought); StackRabbit handles tail risk via the burn-option terms + Monte Carlo playouts, not explicit I-probability modeling. **Under 7-bag (our `bag.rs`), the max gap between I pieces is provably 12** — higher stacking is safer than under NES RNG ([tetris.wiki/Random_Generator](https://tetris.wiki/Random_Generator)).

### 3.2 Cold Clear's clear pricing (modern guideline)

From [standard.rs](https://github.com/MinusKelvin/cold-clear/blob/master/bot/src/evaluation/standard.rs), verified: single **−143**, double **−100**, triple **−58**, **quad +390**; B2B clear +104, standing B2B +52; TSS +121, TSD +410, TST +602, mini-TSS/TSD −158/−93; perfect clear +999; **wasted T −152** (T piece spent on a non-T-spin). Well chosen dynamically as the lowest column with per-column preference `[20, 23, 20, 50, 59, 21, 59, 10, −10, 24]` (center-ish wells preferred, unlike NES); `well_depth: +57`/cell capped at 17.

This is the exact encoding of "a single that kills a tetris opportunity is bad": non-quad clears are *negative* in themselves and only get taken when the alternative board damage outweighs them.

### 3.3 Four-wide combos (relevant to our `FourWide` strategy)

From [four.lol/stacking/4-wide](https://four.lol/stacking/4-wide/):

- The well must hold **residuals** (leftover filled cells) that always leave a completable line: **3-residual** = human standard, easiest to maintain; **4-residual** = "mainly used by bots" (minimal soft-drops); **6-residual** = max combo potential, hardest shapes.
- Valid continuation = after each single, the remaining residual forms a shape the next piece can complete. Combo value grows superlinearly (Cold Clear: `combo_garbage: +150 × COMBO_GARBAGE[combo]`, table capped at 11) — that's what makes holding a combo worth more than cashing out.
- **Center 4-wide > side 4-wide** defensively; misdrops are near-always combo-fatal.
- Caveat: 4-wide is a versus/attack strategy; under single-player NES-style scoring it's strictly worse than tetrising. For our website background it's an aesthetic choice, which is fine.

---

## Key Takeaways → Mapped to `tetris-solver`

**Goal 2 is the foundation and should land first** — flatness and scoring evals both improve automatically once the search can see tuck/spin placements (Cold Clear prices overhang cells 5× cheaper than cavities *because* its movegen can reach under them).

1. **Replace `placement.rs::enumerate_placements` with reachability search** (Cold Clear's `moves.rs` is the model): Dijkstra/BFS over `(x, y, rotation)` with left/right/CW/CCW/soft-drop edges, visited-set dedup, canonical-rotation lock map, and path recovery. Return `Placement { …, path: Vec<u8>, spin: SpinStatus }` so `moves.rs` emits the *found* path instead of synthesizing rotate→shift→drop (which is currently unvalidated). Keep the wide-board column window by seeding the frontier within it.
2. **Add SRS kick tables to `pieces.rs`** (tables above) and apply them in both the solver's rotate edge *and the JS game engine* — moves the solver finds must be executable by the game, so engine parity is a hard requirement. Track T-spin status during search (last-move-was-rotation + 3-corner + test-5 exception).
3. **Upgrade `evaluator_param.rs` features** (goal 1):
   - Split holes into **cavities / overhangs / covered-fill** (CC: −173/−34/−17 ratios).
   - Add **hole depth** and **rows-with-holes** (BCTS), **eroded piece cells** (Dellacherie), and **bumpiness excluding the well column**.
   - Add StackRabbit's **notch dependency detector** (+3 rise after −3 drop → flat penalty) — cheap, directly encodes "don't create I-only slots."
   - Replace single height penalty with **piecewise escalation** (height / top-half / top-quarter).
4. **Make scoring economic** (goal 3): replace the binary below/above-`target_fill` branch with **per-clear-size pricing** (single/double/triple negative, tetris positive), **tetris-ready bonus**, **covered-well cubic penalty**, **guaranteed-burns count**, and well-column exemption from height/flatness terms. Add a `Dig` mode (cheap burns when holes exist) — our `Strategy` enum becomes a mode-switching weight-table selector like StackRabbit's `getAiMode()`.
5. **Add lookahead in `solver_param.rs`**: we already receive `next_queue` — depth-2 deterministic search with top-N pruning is the proven sweet spot (StackRabbit: breadth 10, then playouts). Worth orders of magnitude more than any eval tweak.
6. **Retune with the existing `evolve` harness** after the feature changes — CMA-ES/cross-entropy on full-game outcome is the best-documented path (35M+ lines); optimize against the objective distribution we actually want (mean of top-third runs for aggression).
7. **Optional perf**: bitboard rows (u64) for collision/feature extraction; knewjade's set-parallel reachability if movegen ever bottlenecks under lookahead.

## Sources

1. [Algorta & Şimşek, "The Game of Tetris in Machine Learning" (arXiv 1905.01652)](https://ar5iv.labs.arxiv.org/html/1905.01652) — survey; Dellacherie/BCTS/CBMPI features, weights, line counts.
2. [MinusKelvin/cold-clear](https://github.com/MinusKelvin/cold-clear) — Rust bot; `libtetris/src/moves.rs` (movegen, read in full), `bot/src/evaluation/standard.rs` (eval + weights, read in full), `bot/src/dag.rs`.
3. [GregoryCannon/StackRabbit](https://github.com/GregoryCannon/StackRabbit) — NES scoring AI; `params.hpp` (read in full), `eval.cpp`, `eval_context.cpp`, `high_level_search.cpp`.
4. [meatfighter.com/tetrisairevisited](https://meatfighter.com/tetrisairevisited/) — NES BFS movegen with gravity interleaving; 17-feature PSO evaluator.
5. [tetris.wiki/Super_Rotation_System](https://tetris.wiki/Super_Rotation_System) — SRS kick tables.
6. [tetris.wiki/T-Spin](https://tetris.wiki/T-Spin) — T-spin detection rules.
7. [knewjade's move-generation gist](https://gist.github.com/knewjade/df3403a266c4eea33c2c94fb3fb7c3b2) + [bitris](https://github.com/knewjade/bitris) — set-parallel bitboard reachability.
8. [harddrop.com/wiki/MisaMino](https://harddrop.com/wiki/MisaMino) — sonic-drop-then-maneuver enumeration, beam search.
9. [Implementation-of-El-Tetris](https://github.com/YuhanXiaoJY/Implementation-of-El-Tetris) — El-Tetris weights.
10. [four.lol/stacking/4-wide](https://four.lol/stacking/4-wide/) — 4-wide residual theory.
11. [NESTrisStatsUI stats.md](https://github.com/timotheeg/NESTrisStatsUI/blob/master/docs/stats.md) — NES scoring efficiency, drought definitions.
12. [tetris.wiki/Random_Generator](https://tetris.wiki/Random_Generator) — 7-bag vs NES randomizer properties.
13. [Code My Road, "Tetris AI – The Near Perfect Player"](https://codemyroad.wordpress.com/2013/04/14/tetris-ai-the-near-perfect-player/) — 4-feature GA baseline.
14. [Galactoid, "Learning to play like Cold Clear"](https://galactoidtetris.wordpress.com/2021/02/06/learning-to-play-like-cold-clear/) — CC lookahead depth (single-source).
15. [ezhao1/Guideline-Tetris-AI](https://github.com/ezhao1/Guideline-Tetris-AI) — small readable SRS pathfinder.
16. [arXiv 2603.26765](https://arxiv.org/abs/2603.26765) — bitboard speedup measurement.

**Known gaps / flags**: El-Tetris exact weights are effectively single-source (original post offline). Cold Clear's weight-tuning methodology is undocumented. MisaMino's movegen characterization is single-source (harddrop wiki). Parity theory (checkerboard arguments) was only snippet-sourced (harddrop 403'd) and no bot except StackRabbit's surface table appears to encode it. "Cold Clear plans 14 moves ahead" is single-source.

## Methodology

Three parallel research agents (evaluation heuristics; move generation/spins; stack-vs-score strategy) using WebSearch/WebFetch with 3–5 deep-reads each, plus direct main-session reading of Cold Clear (`moves.rs`, `standard.rs`) and StackRabbit (`params.hpp`, `eval.cpp` skim) source from GitHub, and GitHub repo search for prior art. ~30 unique sources; conflicting or unfetchable sources flagged inline.
