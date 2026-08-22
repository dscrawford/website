# Tetris Solver Improvement Plan

Based on `docs/TETRIS_AI_RESEARCH.md`. Five phases, each independently shippable and testable. TDD throughout: write failing tests first, then implement.

## Current state (verified)

- `placement.rs` enumerates hard-drops only (rotation × column → straight drop). No tucks/slides/spins.
- `moves.rs` synthesizes rotate → shift → soft-drop paths without collision checking along the path.
- Rust `pieces.rs` has shapes but **no kick tables**; the JS engine (`src/game-engine/pieces.js`) already has full SRS kicks (JLSTZ + I, CW + CCW, `[dr, dc]` rows-down convention) and lock-delay with move resets — the game can already execute tucks and spins.
- `evaluator_param.rs`: Dellacherie-style features (row/col transitions, holes, covered, well sums, landing height) with a binary below/above `target_fill` branch.
- `solver_param.rs`: 1-ply greedy + hold heuristic (I held while stacking). `next_queue` received but only used for hold.
- Evolution harness exists (`src/evolve/`, `evaluator_param`/`params` runtime-tunable).

## Phase 1 — Reachability move generation (foundation)

Everything else compounds on this; do it first.

**1a. Kick tables in Rust** (`pieces.rs`)
- Port `WALL_KICKS`, `WALL_KICKS_I`, CCW variants from `src/game-engine/pieces.js` verbatim (same `[dr, dc]` convention, rows increase downward).
- Tests: table symmetry (CCW table = negated CW reverse transitions), spot-check against JS values.

**1b. New `movegen.rs` — BFS/Dijkstra over piece states**
- State: `(row, col, rotation)`; edges: Left, Right, CW (with kicks), CCW (with kicks), SoftDrop. Cold Clear `moves.rs` is the model.
- Priority = input count (shortest path wins; ties broken by fewer rotations). Visited: dense bitset `[rotation][row][col]` sized to the column window.
- Assume zero-G (bot controls descent via soft-drop opcodes; lock delay resets on movement — matches `useAutoSolver` behavior).
- Lock positions: any state that cannot soft-drop; dedup via canonical rotation (S/Z/I have 2 distinct shapes, O has 1).
- Track per-state: last-input-was-rotation + which kick index passed → `SpinStatus {None, Mini, Full}` via 3-corner rule + test-5 exception (T only).
- Output: `Placement { piece_type, rotation, col, landing_row, path: Vec<u8>, spin: SpinStatus }`.
- Keep wide-board column windowing: seed BFS start states across the window (Cold Clear's `zero_g_starts` pattern), search only near the stack.
- `moves.rs::generate_moves` returns the recorded path (delete path synthesis); keep hold-prefix logic.
- Tests (RED first):
  - Tuck: overhang board where T fits only by sliding under → placement found, hard-drop enumeration would miss it.
  - TSD: standard T-slot → found with `spin == Full`; clearing 2 lines.
  - TST: kick-dependent slot → found only because test-5 kick applied.
  - Unreachable cavity NOT enumerated.
  - Path replay: Rust mini-simulator applies each opcode with collision checks → ends exactly at placement. Property test across random boards.
  - Parity: same replay in a JS engine test (`engine.test.js`) for a known tuck + TSD path.
- Perf gate: movegen on 40×80 windowed board < 1ms (bench test), since Phase 4 multiplies it.

## Phase 2 — Flatness features (`board.rs`, `evaluator_param.rs`, `params.rs`)

New metrics (each a small pure function + unit tests):
- Bumpiness (Σ|Δh| and Σ(Δh)²) **excluding the well column** (Flat: none/lowest; FourWide: existing well range).
- Hole split: cavities vs overhangs (Cold Clear neighbor-height classification) — replaces flat `count_holes` in eval; keep old fn for compat.
- Hole depth (fill above each hole) + rows-with-holes (BCTS).
- Dependency notches: count of 1-wide depth-≥3 wells (needs vertical I) — StackRabbit's +3-after-−3 rule; flat penalty each.
- Eroded piece cells (lines cleared × placed-piece cells in those lines) — computed in `simulate_place`/`score_placement_no_copy` before rows collapse.
- Piecewise height: cells above ½ height and ¾ height (scaled to board height, not absolute rows — our boards vary).
- Wire into `FlatParams`/`FourWideParams` + `BoardMetrics` fast path; defaults roughly El-Tetris/CC-ratio-derived; exact values come from Phase 5 retune.
- Weight ratios to respect initially: cavity ≈ 5× overhang ≈ 10× covered; col transitions ≈ 3× row transitions.

## Phase 3 — Scoring economics (`evaluator_param.rs`, `solver_param.rs`, `strategy.rs`)

Replace binary stack/score branch with priced decisions:
- **Per-clear-size pricing**: `w_clear1..w_clear4` (1–3 negative, 4 strongly positive) replacing `lines as f64 ×` weight; T-spin clear bonuses (`w_tspin1..3`, negative mini weights) + `w_wasted_t` once Phase 1 lands.
- **Tetris-ready bonus**: 4 complete-except-well rows with uncovered well → bonus (StackRabbit `tetrisReadyCoef`).
- **Covered-well cubic penalty**: block over well column at height h costs `(h/scare_height)³ × w`.
- **Guaranteed burns**: rows with garbage in the well column each charged one burn cost.
- **Well exemption**: exclude well column from aggregate-height/fill and bumpiness accounting.
- **Mode switching**: derived `AiMode { Stack, Dig, Score }` from board state (any cavity → Dig with cheap burns; fill ≥ target → Score), replacing the sigmoid-urgency/below-target branches. `Strategy` (Flat/FourWide) stays as the user-facing personality; mode selects the weight scales within it.
- 7-bag awareness: `scare_height` can be permissive (max I-gap = 12 under bag), keep as tunable.
- Tests: "single that kills a tetris" scenario — board one row from tetris-ready; assert solver declines the single and stacks instead; desperation-well-fill scenario scores worse than burn; Dig mode burns cheaply when cavity exists.

### Phase 3 outcome notes (implemented)

- Well is **dynamic** (rightmost lowest column, Cold Clear style), not fixed-edge: works at any board width.
- Mode (`Stack`/`Dig`/`Score`) is derived **once from the pre-placement board** — deriving per-candidate let placements "branch-shop" (create a cavity to be judged by Dig's gentler scales).
- Fill is well-exempt (subtract lowest column, normalize over w−1 columns). The burial loophole this opens is closed by a solver-level contamination penalty on non-clearing placements in the well column.
- Eroded-cells applies only in Stack/Dig; Score mode's per-size clear pricing replaces it.
- Scoring feature-scale discounts defaulted to 1.0 (with pre-derived mode they would half-price hole creation across all candidates).
- FourWide untouched — its combo well wants singles; clear-size pricing would fight it.
- Default magnitudes hand-measured on 20×500-piece benchmarks (covered_well −8 beat −20 by 40%); Phase 5 evolution owns final values.

## Phase 4 — Lookahead (`solver_param.rs`) — DONE

- Implemented as `finalize_with_lookahead`: both solve paths collect 1-ply-scored candidates, top-N (default breadth 8) get expanded — simulate, windowed metrics + movegen for the next piece, best 2nd-ply score × `lookahead_weight` (0.5) added. Hold-aware (swap consuming the queue head shifts the ply-2 piece to queue[1]). Next-piece topout scores −1e6.
- Measured (20×500-piece games, default weights): 0.320 → **0.373 lpp**, lines 1,020 → 2,897, deaths 19/20 → **6/20**.
- Latency scales linearly with breadth (40×80: 31ms at 8, 16ms at 4, 11ms at 2; 10×20: 0.9ms at 8). The WASM boundary scales breadth by board area (≤1000 cells: 8, ≤3600: 4, else 2) — solves run once per piece, not per frame.
- Evolve loop is ~10× slower per piece-solve at breadth 8; the breadth is a gene, so Phase 5 can trade it off. Debug test suite now ~110s (game-runner tests at full breadth).

## Phase 5 — Retune (`evolve` harness) — DONE (Flat)

- Fitness switched to clear-weighted score/piece (40/100/300/1200 per 1-4 lines + spin bonus, normalized /100) — selects for tetrises/spins over raw lines.
- Ran as a 3-island k8s Job (one pod per node, 6 CPUs each, seeds 42/1042/2042, 40 generations, widths 10+20). Winner: seed 2042 at fitness 0.536 vs 0.331 default (+62% on the fitness metric). Full genome adopted into `FlatParams`/`SolverParams` defaults; evolved lookahead breadth 8.9, weight 0.44.
- `bin/evolve` now prints the full machine-readable `GENOME:` line (const blocks are legacy/lossy and marked as such).
- Rerun recipe: tar `tetris-solver/{src,Cargo.*}` into a ConfigMap, apply the indexed Job (3 completions, `rust:1-slim`, in-pod build), collect `GENOME:` lines from pod logs, paste the best into `params.rs` defaults.
- FourWide retune not yet run — same recipe with `--strategy fourwide`.

## Deferred / optional

- Bitboard rows (u64) for collision + metrics — only if Phase 4 perf gate fails.
- 4-wide residual-shape scoring (3/4/6-residual continuation patterns) — polish for the FourWide personality.
- Monte Carlo playouts beyond preview — likely overkill for a background animation.

### Phase 3 review follow-ups (deferred)

- `clears_and_eroded` recomputes line counts that `simulate_place` also derives (slow path only, O(4w) per candidate) — merge if the slow path ever matters.
- `hole_positions` Vec allocated per metrics call when holes exist — fold into a caller scratch buffer together with the Phase 1 scratch item below.
- `simulate_place` full-board copy per candidate in the slow path — `simulate_place_into` exists unused; switch the browser path if profiling warrants.

### Phase 1 review follow-ups (from scout reports, deferred)

- Movegen scratch-buffer reuse across calls (perf MEDIUM): visited/prev/prev_op vecs + lock map re-allocated each call; matters only for the evolve loop (~161µs/piece-solve currently). Bundle with a HashMap→linear-Vec dedup swap if done.
- Web Worker for `solveMoves` (security LOW): solver runs synchronously on the render loop; only matters at extreme board widths.
- JS-side T-spin awareness: engine has no spin field/scoring, so JS parity tests can only verify positions, not spin classification. Wire up in Phase 3 alongside spin scoring; add a Rust-generated SPIN_MINI parity fixture then.
- Shared `getCell` quirk (both engines): `row < 0` returns empty before the column check, letting airborne pieces pass outside the walls. Movegen sidesteps it with a stricter local check; changing the engines would alter gameplay, so it stays documented instead.

## Risks

- **Rust/JS divergence**: paths found by Rust must execute identically in JS. Mitigation: replay tests both sides (Phase 1), kick tables ported verbatim.
- **Gravity vs zero-G assumption**: at high `speedMultiplier` engine gravity may drop the piece mid-path. Mitigation: solver already re-solves per piece; paths are short; accept occasional misexecution or bump soft-drop cadence.
- **Perf on 40×80 with lookahead**: mitigated by windowing + top-N + perf gates.
- **Evolve runtime**: new features widen the genome; keep `evaluate_fast` single-pass metrics path intact.
