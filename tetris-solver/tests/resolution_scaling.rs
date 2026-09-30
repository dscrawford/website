//! Resolution regression suite.
//!
//! The site sizes the board from the viewport (cell = floor(vh / 40), cols =
//! clamp(floor(vw / cell), 10, 999)), so a phone plays on ~18x40 while a
//! widescreen plays on ~71x40. These tests replay the browser's
//! STACK/SCORE hysteresis loop headlessly at each of those shapes and assert
//! the solver stays alive and keeps the stack clean on all of them — the
//! phone aspect ratio used to bury itself in holes and top out.

use tetris_solver::board;
use tetris_solver::evaluator_param::well_exempt_fill;
use tetris_solver::params::{FlatParams, FourWideParams, SolverParams};
use tetris_solver::solver_param;
use tetris_solver::strategy::Strategy;

// Mirrors useAutoSolver.js
const BASE_STACK_TARGET: f64 = 0.75;
const FLIP_MARGIN: f64 = 0.05;
const SCORE_TARGET: f64 = 0.10;

/// Mirrors `stackTargetFor` in src/hooks/useAutoSolver.js: boards too narrow
/// to hold the full target stack for a lower one.
fn stack_target(width: u32) -> f64 {
    let cols = width.saturating_sub(1).max(1) as f64;
    BASE_STACK_TARGET.min(0.45 + 0.02 * cols)
}

/// Pieces simulated per board. Debug builds are slow, so the default is the
/// smallest count that reliably exposed the old narrow-board topout (it died
/// inside 80 pieces); raise it with RES_TEST_PIECES for a deeper soak.
fn pieces_per_run() -> u32 {
    std::env::var("RES_TEST_PIECES")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(250)
}

/// xorshift64* — a deterministic RNG so these runs are reproducible without
/// pulling `rand` into the default (wasm) build.
struct Rng(u64);

impl Rng {
    fn new(seed: u64) -> Self {
        Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1)
    }
    fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next_u64() % n as u64) as usize
    }
}

/// 14-bag randomizer, matching the engine's piece distribution
/// (createBag in src/game-engine/types.js): two copies of each type per bag,
/// which allows longer droughts than a 7-bag and is what the site plays.
struct Bag {
    queue: Vec<u8>,
}

impl Bag {
    fn new(rng: &mut Rng) -> Self {
        let mut b = Bag { queue: Vec::new() };
        b.refill(rng);
        b
    }
    fn refill(&mut self, rng: &mut Rng) {
        let mut bag: Vec<u8> = (1..=7).chain(1..=7).collect();
        for i in (1..bag.len()).rev() {
            let j = rng.below(i + 1);
            bag.swap(i, j);
        }
        self.queue.extend(bag);
    }
    fn next(&mut self, rng: &mut Rng) -> u8 {
        if self.queue.len() < 8 {
            self.refill(rng);
        }
        self.queue.remove(0)
    }
    fn peek(&mut self, n: usize, rng: &mut Rng) -> Vec<u8> {
        while self.queue.len() < n {
            self.refill(rng);
        }
        self.queue[..n].to_vec()
    }
}

#[derive(Debug)]
struct Outcome {
    pieces: u32,
    topped_out: bool,
    mean_holes: f64,
    max_holes: u32,
    max_bumpiness_per_col: f64,
    max_col_height: u32,
    max_fill: f64,
}

fn play(width: u32, height: u32, pieces: u32, strategy: Strategy, seed: u64) -> Outcome {
    let (sp, fp, fwp) = (
        SolverParams::default(),
        FlatParams::default(),
        FourWideParams::default(),
    );
    let mut rng = Rng::new(seed);
    let mut bag = Bag::new(&mut rng);
    let mut cells = vec![0u8; (width * height) as usize];
    let (ws, we) = board::well_column_range(width);
    let mut hold: u8 = 0;
    let mut can_hold = true;
    let mut scoring = false;

    let mut out = Outcome {
        pieces: 0,
        topped_out: false,
        mean_holes: 0.0,
        max_holes: 0,
        max_bumpiness_per_col: 0.0,
        max_col_height: 0,
        max_fill: 0.0,
    };

    for _ in 0..pieces {
        let m = board::compute_all_metrics(&cells, width, height, ws, we);
        let fill = well_exempt_fill(&m, width, height);
        out.max_fill = out.max_fill.max(fill);
        out.max_holes = out.max_holes.max(m.holes);
        out.mean_holes += m.holes as f64;
        out.max_bumpiness_per_col = out
            .max_bumpiness_per_col
            .max(m.bumpiness as f64 / (width.max(2) - 1) as f64);
        out.max_col_height = out.max_col_height.max(tallest_column(&cells, width, height));

        if !scoring && fill >= stack_target(width) - FLIP_MARGIN {
            scoring = true;
        } else if scoring && fill <= SCORE_TARGET {
            scoring = false;
        }
        let target = if scoring { SCORE_TARGET } else { stack_target(width) };

        let current = bag.next(&mut rng);
        let queue = bag.peek(5, &mut rng);
        let result = solver_param::solve_param_fast(
            &mut cells, width, height, current, hold, can_hold, &queue, target, strategy,
            &sp, &fp, &fwp, None,
        );
        let Some(result) = result else {
            out.topped_out = true;
            break;
        };
        if result.use_hold {
            hold = current;
            can_hold = false;
        } else {
            can_hold = true;
        }
        let p = &result.placement;
        let (next_cells, _cleared) = board::simulate_place(
            &cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col,
        );
        cells = next_cells;
        out.pieces += 1;
        if cells[..width as usize].iter().any(|&c| c != 0) {
            out.topped_out = true;
            break;
        }
    }
    out.mean_holes /= out.pieces.max(1) as f64;
    out
}

fn tallest_column(cells: &[u8], width: u32, height: u32) -> u32 {
    (0..width)
        .map(|c| {
            (0..height)
                .find(|&r| cells[(r * width + c) as usize] != 0)
                .map_or(0, |r| height - r)
        })
        .max()
        .unwrap_or(0)
}

/// Viewports the site actually runs on, converted to board dimensions the
/// same way calculateBoardDimensions does.
const VIEWPORT_BOARDS: &[(&str, u32, u32)] = &[
    ("iPhone SE portrait", 23, 40),
    ("iPhone 14 portrait", 18, 40),
    ("iPhone 14 landscape", 93, 40),
    ("iPad portrait", 28, 40),
    ("iPad landscape", 59, 40),
    ("laptop / widescreen", 71, 40),
    ("ultrawide", 95, 40),
];

const SEEDS: [u64; 3] = [1, 7, 42];

#[test]
fn every_viewport_board_survives_the_stacking_cycle() {
    let pieces = pieces_per_run();
    for &(label, w, h) in VIEWPORT_BOARDS {
        for seed in SEEDS {
            let out = play(w, h, pieces, Strategy::Flat, seed);
            assert!(
                !out.topped_out,
                "{label} ({w}x{h}) seed {seed}: topped out after {} pieces ({:?})",
                out.pieces, out
            );
        }
    }
}

#[test]
fn every_viewport_board_stacks_without_burying_holes() {
    let pieces = pieces_per_run();
    for &(label, w, h) in VIEWPORT_BOARDS {
        for seed in SEEDS {
            let out = play(w, h, pieces, Strategy::Flat, seed);
            // Holes the solver opens and digs back out are normal; holes it
            // lives with are the regression. The narrow-board failure carried
            // 100+ holes continuously, far past either bound.
            let mean_budget = (w as f64 / 10.0).max(2.0);
            let peak_budget = (w / 2).max(12);
            assert!(
                out.mean_holes <= mean_budget,
                "{label} ({w}x{h}) seed {seed}: {:.1} holes on average, budget {mean_budget:.1} ({:?})",
                out.mean_holes, out
            );
            assert!(
                out.max_holes <= peak_budget,
                "{label} ({w}x{h}) seed {seed}: peaked at {} holes, budget {peak_budget} ({:?})",
                out.max_holes, out
            );
        }
    }
}

#[test]
fn narrow_boards_stay_as_flat_as_wide_ones() {
    let pieces = pieces_per_run();
    for &(label, w, h) in VIEWPORT_BOARDS {
        for seed in SEEDS {
            let out = play(w, h, pieces, Strategy::Flat, seed);
            assert!(
                out.max_bumpiness_per_col <= 4.0,
                "{label} ({w}x{h}) seed {seed}: bumpiness {:.2} per column ({:?})",
                out.max_bumpiness_per_col, out
            );
        }
    }
}

#[test]
fn boards_keep_headroom_below_the_ceiling() {
    let pieces = pieces_per_run();
    for &(label, w, h) in VIEWPORT_BOARDS {
        for seed in SEEDS {
            let out = play(w, h, pieces, Strategy::Flat, seed);
            assert!(
                out.max_col_height < h - 2,
                "{label} ({w}x{h}) seed {seed}: stack reached row {} of {h} ({:?})",
                out.max_col_height, out
            );
        }
    }
}

#[test]
fn extreme_aspect_ratios_survive() {
    // Skinny desktop windows clamp to MIN_BOARD_WIDTH=10; tall phones with a
    // short board height give very tall narrow boards. These shapes are the
    // slowest to fail, so they get a longer soak than the viewport boards.
    let pieces = pieces_per_run() * 2;
    for &(w, h) in &[(10u32, 40u32), (10, 20), (18, 80), (18, 20)] {
        for seed in SEEDS {
            let out = play(w, h, pieces, Strategy::Flat, seed);
            assert!(
                !out.topped_out,
                "{w}x{h} seed {seed}: topped out after {} pieces ({:?})",
                out.pieces, out
            );
        }
    }
}

#[test]
fn four_wide_strategy_survives_every_viewport_board() {
    let pieces = pieces_per_run();
    for &(label, w, h) in VIEWPORT_BOARDS {
        let out = play(w, h, pieces, Strategy::FourWide, SEEDS[0]);
        assert!(
            !out.topped_out,
            "4-wide {label} ({w}x{h}): topped out after {} pieces ({:?})",
            out.pieces, out
        );
    }
}

/// The target-attraction term is the only one expressed as a fraction of the
/// board; every other weight prices cells. One placed piece moves the fill
/// fraction by ~4 / stacking-cells, so the normalization has to cancel that
/// or the pull per piece grows as boards get smaller — which is exactly what
/// buried the phone board in holes.
#[test]
fn target_attraction_per_piece_is_board_independent() {
    use tetris_solver::evaluator_param::target_norm;
    let per_piece = |w: u32, h: u32| {
        let stacking_cells = (w.saturating_sub(1).max(1) * h) as f64;
        4.0 / stacking_cells * target_norm(w, h)
    };
    let reference = per_piece(71, 40);
    for &(label, w, h) in VIEWPORT_BOARDS {
        let ratio = per_piece(w, h) / reference;
        assert!(
            (0.5..=2.0).contains(&ratio),
            "{label} ({w}x{h}): per-piece target pull is {ratio:.2}x the widescreen board"
        );
    }
}
