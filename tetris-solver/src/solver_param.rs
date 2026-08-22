use crate::board;
use crate::evaluator_param::{self, AiMode};
use crate::movegen::{self, FoundPlacement};
use crate::params::{FlatParams, FourWideParams, SolverParams};
use crate::pieces;
use crate::placement::Placement;
use crate::solver::SolveResult;
use crate::strategy::Strategy;

/// Compute scoring urgency as a sigmoid of average fill vs target.
fn scoring_urgency(avg_fill: f64, target_fill: f64, sigmoid_k: f64) -> f64 {
    1.0 / (1.0 + (-sigmoid_k * (avg_fill - target_fill)).exp())
}

/// Solve for the best move given the current game state and strategy (parameterized).
pub fn solve_param(
    cells: &[u8],
    width: u32,
    height: u32,
    current_type: u8,
    hold: u8,
    can_hold: bool,
    next_queue: &[u8],
    target_fill_ratio: f64,
    strategy: Strategy,
    sp: &SolverParams,
    fp: &FlatParams,
    fwp: &FourWideParams,
) -> Option<SolveResult> {
    let strategy = if strategy == Strategy::FourWide && width < 10 {
        Strategy::Flat
    } else {
        strategy
    };

    let target_fill = target_fill_ratio;

    let (ws0, we0) = board::well_column_range(width);
    let base_metrics = board::compute_all_metrics(cells, width, height, ws0, we0);
    let avg_fill = base_metrics.aggregate_height as f64 / (width as f64 * height as f64);
    let urgency = scoring_urgency(avg_fill, target_fill, sp.sigmoid_k);
    let below_target = avg_fill < target_fill;
    let mode = evaluator_param::derive_mode(&base_metrics, width, height, target_fill);
    // Release the held I when the stack is dangerously high — hoarding it
    // further blocks the payoff
    let keep_i_held = below_target && base_metrics.top_quarter_cells == 0;

    if keep_i_held && current_type == pieces::I && can_hold {
        let alt_type = if hold > 0 {
            hold
        } else if !next_queue.is_empty() {
            next_queue[0]
        } else {
            0
        };
        if alt_type > 0 && alt_type != pieces::I {
            let alt_placements = movegen::find_placements(cells, width, height, alt_type);
            let mut best: Option<(f64, SolveResult)> = None;
            for cand in alt_placements {
                let score = score_placement_param(
                    cells, width, height, &cand.placement, cand.spin, base_metrics.well_col, mode, urgency, target_fill, strategy, sp, fp, fwp,
                );
                update_best(&mut best, score, cand, true);
            }
            if best.is_some() {
                return best.map(|(_, r)| r);
            }
        }
    }

    let mut scored: Vec<(f64, FoundPlacement, bool)> = Vec::with_capacity(64);

    let current_placements = movegen::find_placements(cells, width, height, current_type);
    for cand in current_placements {
        let score = score_placement_param(
            cells, width, height, &cand.placement, cand.spin, base_metrics.well_col, mode, urgency, target_fill, strategy, sp, fp, fwp,
        );
        scored.push((score, cand, false));
    }

    if can_hold {
        let alt_type = if hold > 0 {
            hold
        } else if !next_queue.is_empty() {
            next_queue[0]
        } else {
            0
        };
        if alt_type > 0 && alt_type != current_type {
            if keep_i_held && alt_type == pieces::I {
                // Skip — keep I in hold for scoring phase
            } else {
                let alt_placements = movegen::find_placements(cells, width, height, alt_type);
                for cand in alt_placements {
                    let score = score_placement_param(
                        cells, width, height, &cand.placement, cand.spin, base_metrics.well_col, mode, urgency, target_fill, strategy, sp, fp, fwp,
                    );
                    scored.push((score, cand, true));
                }
            }
        }
    }

    let next_current = next_queue.first().copied().unwrap_or(0);
    let next_after_hold = if hold > 0 {
        next_current
    } else {
        next_queue.get(1).copied().unwrap_or(0)
    };
    let (la_min, la_max) = if width > 20 {
        find_active_columns(cells, width, height)
    } else {
        (0u32, width.saturating_sub(1))
    };
    finalize_with_lookahead(
        cells, width, height, scored, next_current, next_after_hold, la_min, la_max,
        target_fill, strategy, sp, fp, fwp,
    )
}


/// Death-equivalent second-ply score when the next piece has no placements.
const LOOKAHEAD_TOPOUT: f64 = -1.0e6;

/// Depth-2 rerank of the top `lookahead_breadth` first-ply candidates.
/// `next_after_hold` differs from `next_current` when the hold swap
/// consumes the queue head.
#[allow(clippy::too_many_arguments)]
fn finalize_with_lookahead(
    cells: &[u8],
    width: u32,
    height: u32,
    mut scored: Vec<(f64, FoundPlacement, bool)>,
    next_current: u8,
    next_after_hold: u8,
    col_min: u32,
    col_max: u32,
    target_fill: f64,
    strategy: Strategy,
    sp: &SolverParams,
    fp: &FlatParams,
    fwp: &FourWideParams,
) -> Option<SolveResult> {
    if scored.is_empty() {
        return None;
    }
    // total_cmp ranks NaN above +inf; demote non-finite scores to worst
    for entry in &mut scored {
        if !entry.0.is_finite() {
            entry.0 = f64::MIN;
        }
    }

    let breadth = sp.breadth();
    if breadth == 0 || next_current == 0 {
        let (_, cand, use_hold) = scored
            .into_iter()
            .max_by(|a, b| a.0.total_cmp(&b.0))?;
        return Some(SolveResult {
            placement: cand.placement,
            use_hold,
            path: cand.path,
            spin: cand.spin,
        });
    }

    let k = breadth.min(scored.len());
    if k < scored.len() {
        scored.select_nth_unstable_by(k - 1, |a, b| b.0.total_cmp(&a.0));
        scored.truncate(k);
    }

    let (ws, we) = board::well_column_range(width);
    let mut board2: Vec<u8> = Vec::with_capacity((width * height) as usize);
    let mut best: Option<(f64, FoundPlacement, bool)> = None;
    for (score1, cand, use_hold) in scored {
        let next = if use_hold { next_after_hold } else { next_current };
        let bonus = if next == 0 {
            0.0
        } else {
            let p = &cand.placement;
            // Widen the active window past this placement's columns
            let shape = pieces::get_shape(p.piece_type, p.rotation);
            let pmin = shape.iter().map(|&(_, dc)| (p.col + dc as i32).max(0) as u32).min().unwrap();
            let pmax = shape.iter().map(|&(_, dc)| (p.col + dc as i32).max(0) as u32).max().unwrap();
            let c_lo = col_min.min(pmin.saturating_sub(4));
            let c_hi = col_max.max((pmax + 4).min(width.saturating_sub(1)));

            board::simulate_place_into(
                cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col, &mut board2,
            );
            let metrics2 = if width > 20 {
                board::compute_metrics_windowed(&board2, width, height, ws, we, c_lo, c_hi)
            } else {
                board::compute_all_metrics(&board2, width, height, ws, we)
            };
            let mode2 = evaluator_param::derive_mode(&metrics2, width, height, target_fill);
            let mut best2 = LOOKAHEAD_TOPOUT;
            for cand2 in movegen::find_placements_windowed(&board2, width, height, next, c_lo, c_hi) {
                let s2 = score_placement_fast(
                    board2.as_mut_slice(), width, height, &cand2.placement, cand2.spin, metrics2.well_col,
                    mode2, 0.0, target_fill, strategy, sp, fp, fwp, ws, we, c_lo, c_hi,
                );
                if s2 > best2 {
                    best2 = s2;
                }
            }
            sp.lookahead_weight * best2
        };
        let total = score1 + bonus;
        let total = if total.is_finite() { total } else { f64::MIN };
        let better = best
            .as_ref()
            .map_or(true, |(b, _, _)| total.total_cmp(b).is_gt());
        if better {
            best = Some((total, cand, use_hold));
        }
    }

    best.map(|(_, cand, use_hold)| SolveResult {
        placement: cand.placement,
        use_hold,
        path: cand.path,
        spin: cand.spin,
    })
}

/// Score a single placement using parameterized evaluation.
fn score_placement_param(
    cells: &[u8],
    width: u32,
    height: u32,
    p: &Placement,
    spin: u8,
    well_col: u32,
    mode: AiMode,
    urgency: f64,
    target_fill: f64,
    strategy: Strategy,
    sp: &SolverParams,
    fp: &FlatParams,
    fwp: &FourWideParams,
) -> f64 {
    let (_, eroded) = board::clears_and_eroded(
        cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col,
    );
    let (new_cells, lines) =
        board::simulate_place(cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col);

    let _ = urgency;
    let (ws, we) = board::well_column_range(width);
    let metrics = board::compute_all_metrics(&new_cells, width, height, ws, we);
    let post_fill = metrics.aggregate_height as f64 / (width as f64 * height as f64);
    let above_target = post_fill >= target_fill;
    let base = evaluator_param::evaluate_fast(
        &metrics, width, height, lines, eroded, spin, mode, p.landing_row, p.piece_type,
        p.rotation, target_fill, strategy, fp, fwp,
    );

    // Flat clear pricing now lives in the evaluator (w_clear1..4); the
    // legacy per-line bonus would make priced burns net-positive again
    let clear_bonus = match strategy {
        Strategy::FourWide if lines > 0 && above_target => {
            sp.fw_tetris_bonus_max * (lines as f64 / 4.0)
        }
        _ => 0.0,
    };

    let well_penalty = match strategy {
        Strategy::FourWide => {
            let (well_start, well_end) = board::well_column_range(width);
            let in_well = board::placement_cells_in_well(
                p.piece_type, p.rotation, p.landing_row, p.col, well_start, well_end,
            );
            if p.piece_type == pieces::I && above_target {
                0.0
            } else {
                sp.fw_well_cell_penalty * in_well as f64
            }
        }
        Strategy::Flat => {
            // Contaminating the (pre-placement) well without clearing blocks
            // the tetris payoff — StackRabbit's desperation-piece penalty
            if lines == 0 {
                let shape = pieces::get_shape(p.piece_type, p.rotation);
                let in_well = shape
                    .iter()
                    .filter(|&&(_, dc)| p.col + dc as i32 == well_col as i32)
                    .count();
                sp.flat_well_cell_penalty * in_well as f64
            } else {
                0.0
            }
        }
    };

    base + clear_bonus + well_penalty
}

// === Fast path for evolution: reuses buffer, single-pass metrics ===

/// Solve using no-copy placement evaluation and windowed metrics.
/// `active_col_range` is an optional hint for the active column bounds (avoids full scan).
/// Note: temporarily mutates `cells` during scoring but restores original state.
pub fn solve_param_fast(
    cells: &mut [u8],
    width: u32,
    height: u32,
    current_type: u8,
    hold: u8,
    can_hold: bool,
    next_queue: &[u8],
    target_fill_ratio: f64,
    strategy: Strategy,
    sp: &SolverParams,
    fp: &FlatParams,
    fwp: &FourWideParams,
    active_col_range: Option<(u32, u32)>,
) -> Option<SolveResult> {
    let strategy = if strategy == Strategy::FourWide && width < 10 {
        Strategy::Flat
    } else {
        strategy
    };

    let target_fill = target_fill_ratio;
    let (well_start, well_end) = board::well_column_range(width);

    // Use provided active column bounds or compute them
    let (col_min, col_max) = if width > 20 {
        active_col_range.unwrap_or_else(|| find_active_columns(cells, width, height))
    } else {
        (0u32, width - 1)
    };

    let base_metrics = if width > 20 {
        board::compute_metrics_windowed(cells, width, height, well_start, well_end, col_min, col_max)
    } else {
        board::compute_all_metrics(cells, width, height, well_start, well_end)
    };
    let avg_fill = base_metrics.aggregate_height as f64 / (width as f64 * height as f64);
    let urgency = scoring_urgency(avg_fill, target_fill, sp.sigmoid_k);
    let below_target = avg_fill < target_fill;
    let mode = evaluator_param::derive_mode(&base_metrics, width, height, target_fill);
    let keep_i_held =
        below_target && base_metrics.top_quarter_cells == 0;

    if keep_i_held && current_type == pieces::I && can_hold {
        let alt_type = if hold > 0 {
            hold
        } else if !next_queue.is_empty() {
            next_queue[0]
        } else {
            0
        };
        if alt_type > 0 && alt_type != pieces::I {
            let alt_placements = movegen::find_placements_windowed(cells, width, height, alt_type, col_min, col_max);
            let mut best: Option<(f64, SolveResult)> = None;
            for cand in alt_placements {
                let score = score_placement_fast(
                    cells, width, height, &cand.placement, cand.spin, base_metrics.well_col, mode, urgency, target_fill, strategy, sp, fp, fwp,
                    well_start, well_end, col_min, col_max,
                );
                update_best(&mut best, score, cand, true);
            }
            if best.is_some() {
                return best.map(|(_, r)| r);
            }
        }
    }

    let mut scored: Vec<(f64, FoundPlacement, bool)> = Vec::with_capacity(64);

    let current_placements = movegen::find_placements_windowed(cells, width, height, current_type, col_min, col_max);
    for cand in current_placements {
        let score = score_placement_fast(
            cells, width, height, &cand.placement, cand.spin, base_metrics.well_col, mode, urgency, target_fill, strategy, sp, fp, fwp,
            well_start, well_end, col_min, col_max,
        );
        scored.push((score, cand, false));
    }

    if can_hold {
        let alt_type = if hold > 0 {
            hold
        } else if !next_queue.is_empty() {
            next_queue[0]
        } else {
            0
        };
        if alt_type > 0 && alt_type != current_type {
            if keep_i_held && alt_type == pieces::I {
                // Skip
            } else {
                let alt_placements = movegen::find_placements_windowed(cells, width, height, alt_type, col_min, col_max);
                for cand in alt_placements {
                    let score = score_placement_fast(
                        cells, width, height, &cand.placement, cand.spin, base_metrics.well_col, mode, urgency, target_fill, strategy, sp, fp, fwp,
                        well_start, well_end, col_min, col_max,
                    );
                    scored.push((score, cand, true));
                }
            }
        }
    }

    let next_current = next_queue.first().copied().unwrap_or(0);
    let next_after_hold = if hold > 0 {
        next_current
    } else {
        next_queue.get(1).copied().unwrap_or(0)
    };
    finalize_with_lookahead(
        cells, width, height, scored, next_current, next_after_hold, col_min, col_max,
        target_fill, strategy, sp, fp, fwp,
    )
}

/// Score a placement using no-copy simulate and windowed metrics.
fn score_placement_fast(
    cells: &mut [u8],
    width: u32,
    height: u32,
    p: &Placement,
    spin: u8,
    well_col: u32,
    mode: AiMode,
    _urgency: f64,
    target_fill: f64,
    strategy: Strategy,
    sp: &SolverParams,
    fp: &FlatParams,
    fwp: &FourWideParams,
    well_start: u32,
    well_end: u32,
    col_min: u32,
    col_max: u32,
) -> f64 {
    let (lines, eroded, metrics) = board::score_placement_no_copy(
        cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col,
        well_start, well_end, col_min, col_max,
    );
    let post_fill = metrics.aggregate_height as f64 / (width as f64 * height as f64);
    let above_target = post_fill >= target_fill;

    let base = evaluator_param::evaluate_fast(
        &metrics, width, height, lines, eroded, spin, mode, p.landing_row, p.piece_type,
        p.rotation, target_fill, strategy, fp, fwp,
    );

    // Flat clear pricing now lives in the evaluator (w_clear1..4); the
    // legacy per-line bonus would make priced burns net-positive again
    let clear_bonus = match strategy {
        Strategy::FourWide if lines > 0 && above_target => {
            sp.fw_tetris_bonus_max * (lines as f64 / 4.0)
        }
        _ => 0.0,
    };

    let well_penalty = match strategy {
        Strategy::FourWide => {
            let in_well = board::placement_cells_in_well(
                p.piece_type, p.rotation, p.landing_row, p.col, well_start, well_end,
            );
            if p.piece_type == pieces::I && above_target {
                0.0
            } else {
                sp.fw_well_cell_penalty * in_well as f64
            }
        }
        Strategy::Flat => {
            // Contaminating the (pre-placement) well without clearing blocks
            // the tetris payoff — StackRabbit's desperation-piece penalty
            if lines == 0 {
                let shape = pieces::get_shape(p.piece_type, p.rotation);
                let in_well = shape
                    .iter()
                    .filter(|&&(_, dc)| p.col + dc as i32 == well_col as i32)
                    .count();
                sp.flat_well_cell_penalty * in_well as f64
            } else {
                0.0
            }
        }
    };

    base + clear_bonus + well_penalty
}

/// Find the leftmost and rightmost occupied columns, with margin.
/// Returns (col_min, col_max) for windowed operations.
fn find_active_columns(cells: &[u8], width: u32, height: u32) -> (u32, u32) {
    let w = width as usize;
    let h = height as usize;
    let mut left = w;
    let mut right = 0usize;

    // Scan row by row — early-exit per row once bounds found
    for row in 0..h {
        let start = row * w;
        for col in 0..w {
            if cells[start + col] != 0 {
                if col < left { left = col; }
                if col > right { right = col; }
            }
        }
    }

    if left > right {
        // Empty board
        let center = w / 2;
        let margin = 10;
        ((center.saturating_sub(margin)) as u32, ((center + margin).min(w - 1)) as u32)
    } else {
        let margin = 4;
        (left.saturating_sub(margin) as u32, ((right + margin).min(w - 1)) as u32)
    }
}

fn update_best(
    best: &mut Option<(f64, SolveResult)>,
    score: f64,
    cand: FoundPlacement,
    use_hold: bool,
) {
    let score = if score.is_finite() { score } else { f64::MIN };
    let better = best
        .as_ref()
        .map_or(true, |(b, _)| score.total_cmp(b).is_gt());
    if better {
        *best = Some((
            score,
            SolveResult {
                placement: cand.placement,
                use_hold,
                path: cand.path,
                spin: cand.spin,
            },
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pieces::{EMPTY, I, J, L, O, S, T, Z};

    fn empty_board(width: u32, height: u32) -> Vec<u8> {
        vec![EMPTY; (width * height) as usize]
    }

    fn set_cell(cells: &mut [u8], width: u32, row: u32, col: u32, val: u8) {
        cells[(row * width + col) as usize] = val;
    }

    fn tetris_ready_board() -> Vec<u8> {
        let mut cells = empty_board(10, 20);
        for r in 16..20u32 {
            for c in 0..9u32 {
                set_cell(&mut cells, 10, r, c, I);
            }
        }
        cells
    }

    fn tsd_board() -> Vec<u8> {
        // Same geometry as movegen::tests::finds_tspin_double_with_full_status
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 17, 5, I);
        for c in 0..10u32 {
            if !(3..=5).contains(&c) {
                set_cell(&mut cells, 10, 18, c, I);
            }
            if c != 4 {
                set_cell(&mut cells, 10, 19, c, I);
            }
        }
        cells
    }

    #[test]
    fn solve_param_and_fast_agree_on_narrow_boards() {
        // width <= 20: fast path scans the whole board, so any divergence is
        // a mode or scoring inconsistency, not windowing
        let boards: Vec<(&str, Vec<u8>)> = vec![
            ("empty", empty_board(10, 20)),
            ("tetris_ready", tetris_ready_board()),
            ("tsd", tsd_board()),
        ];
        let sp = SolverParams::default();
        let fp = FlatParams::default();
        let fwp = FourWideParams::default();

        for (name, cells) in boards {
            for piece in [I, T, S, Z, L, J] {
                let slow = solve_param(
                    &cells, 10, 20, piece, 0, false, &[], 0.5, Strategy::Flat, &sp, &fp, &fwp,
                );
                let mut fast_cells = cells.clone();
                let fast = solve_param_fast(
                    &mut fast_cells, 10, 20, piece, 0, false, &[], 0.5, Strategy::Flat,
                    &sp, &fp, &fwp, None,
                );
                assert_eq!(
                    slow.map(|r| r.placement),
                    fast.map(|r| r.placement),
                    "board {} piece {}: slow and fast paths disagree",
                    name,
                    piece
                );
                assert_eq!(fast_cells, cells, "fast path must restore the board");
            }
        }
    }

    #[test]
    fn solver_prefers_tsd_over_flat_placements() {
        let cells = tsd_board();
        let result = solve_param(
            &cells, 10, 20, T, 0, false, &[], 0.0, Strategy::Flat,
            &SolverParams::default(), &FlatParams::default(), &FourWideParams::default(),
        )
        .expect("solver must return a placement");
        assert_eq!(
            (result.placement.rotation, result.placement.col, result.placement.landing_row),
            (2, 3, 17),
            "solver should choose the TSD slot"
        );
        let (_, lines) = board::simulate_place(
            &cells, 10, 20,
            result.placement.piece_type, result.placement.rotation,
            result.placement.landing_row, result.placement.col,
        );
        assert_eq!(lines, 2);
    }

    #[test]
    fn contaminating_the_well_without_clearing_is_penalized() {
        let cells = tetris_ready_board();
        let sp = SolverParams::default();
        let fp = FlatParams { w_height_gap: 0.0, ..Default::default() };
        let result = solve_param(
            &cells, 10, 20, L, 0, false, &[], 0.0, Strategy::Flat, &sp, &fp,
            &FourWideParams::default(),
        )
        .unwrap();
        let shape = pieces::get_shape(result.placement.piece_type, result.placement.rotation);
        let touches_well = shape.iter().any(|&(_, dc)| result.placement.col + dc as i32 == 9);
        assert!(!touches_well, "L piece should avoid burying the ready well");
    }

    // === Lookahead mechanics (Phase 4) ===

    fn fp(p: Placement) -> FoundPlacement {
        FoundPlacement { placement: p, path: vec![], spin: 0 }
    }

    #[test]
    fn breadth_rounding_below_half_disables_lookahead() {
        let cells = empty_board(10, 20);
        for breadth in [-100.0_f64, -0.001, 0.0, 0.49, f64::NAN] {
            let scored = vec![
                (1.0, fp(Placement { piece_type: I, rotation: 0, col: 0, landing_row: 0 }), false),
                (9.0, fp(Placement { piece_type: O, rotation: 0, col: 1, landing_row: 0 }), true),
                (5.0, fp(Placement { piece_type: T, rotation: 0, col: 2, landing_row: 0 }), false),
            ];
            let sp = SolverParams { lookahead_breadth: breadth, ..SolverParams::default() };
            let result = finalize_with_lookahead(
                &cells, 10, 20, scored, I, O, 0, 9, 0.5, Strategy::Flat,
                &sp, &FlatParams::default(), &FourWideParams::default(),
            )
            .expect("non-empty scored must return a result");
            assert_eq!(result.placement.col, 1, "breadth {} should pick greedy max", breadth);
            assert!(result.use_hold);
        }
    }

    #[test]
    fn breadth_half_rounds_up_to_one() {
        let cells = empty_board(10, 20);
        let scored = vec![
            (1.0, fp(Placement { piece_type: I, rotation: 0, col: 0, landing_row: 18 }), false),
            (9.0, fp(Placement { piece_type: O, rotation: 0, col: 0, landing_row: 17 }), true),
            (5.0, fp(Placement { piece_type: T, rotation: 0, col: 5, landing_row: 17 }), false),
        ];
        let sp = SolverParams { lookahead_breadth: 0.5, ..SolverParams::default() };
        let result = finalize_with_lookahead(
            &cells, 10, 20, scored, I, O, 0, 9, 0.5, Strategy::Flat,
            &sp, &FlatParams::default(), &FourWideParams::default(),
        )
        .expect("must return a result");
        assert_eq!(result.placement.piece_type, O);
        assert!(result.use_hold);
    }

    #[test]
    fn hold_candidates_use_next_after_hold_not_next_current() {
        let width = 6;
        let height = 8;
        let mut cells = empty_board(width, height);
        // Blocks I's spawn footprint so next_current=I sees zero placements
        set_cell(&mut cells, width, 1, 1, I);

        let away = Placement { piece_type: T, rotation: 0, col: 0, landing_row: 6 };
        let scored = vec![
            (0.0, fp(away.clone()), false), // next_current (I) -> topout
            (0.0, fp(away), true),          // next_after_hold (O) -> real bonus
        ];
        let result = finalize_with_lookahead(
            &cells, width, height, scored, I, O, 0, width - 1, 0.5, Strategy::Flat,
            &SolverParams::default(), &FlatParams::default(), &FourWideParams::default(),
        )
        .expect("must return a result");
        assert!(
            result.use_hold,
            "hold candidate must win: its ply-2 piece (O) can spawn while I cannot"
        );
    }

    #[test]
    fn lookahead_penalizes_blocking_next_piece_spawn() {
        let width = 6;
        let height = 6;
        let cells = empty_board(width, height);
        // O spawn footprint on width 6 is rows 0-1, cols 3-4
        let blocking = Placement { piece_type: O, rotation: 0, col: 2, landing_row: 0 };
        let safe = Placement { piece_type: O, rotation: 0, col: 0, landing_row: 4 };
        let scored = vec![(0.0, fp(blocking), false), (0.0, fp(safe.clone()), false)];
        let result = finalize_with_lookahead(
            &cells, width, height, scored, O, O, 0, width - 1, 0.5, Strategy::Flat,
            &SolverParams::default(), &FlatParams::default(), &FourWideParams::default(),
        )
        .expect("must return a result");
        assert_eq!(result.placement, safe, "must not bury the next piece's spawn");
    }

    #[test]
    fn breadth_larger_than_candidate_count_is_safe() {
        let cells = empty_board(10, 20);
        let scored = vec![
            (1.0, fp(Placement { piece_type: I, rotation: 0, col: 0, landing_row: 18 }), false),
            (2.0, fp(Placement { piece_type: O, rotation: 0, col: 4, landing_row: 17 }), false),
        ];
        let sp = SolverParams { lookahead_breadth: 1000.0, ..SolverParams::default() };
        let result = finalize_with_lookahead(
            &cells, 10, 20, scored, T, 0, 0, 9, 0.5, Strategy::Flat,
            &sp, &FlatParams::default(), &FourWideParams::default(),
        )
        .expect("must return a result");
        assert!([0, 4].contains(&result.placement.col));
    }

    #[test]
    fn empty_scored_candidates_returns_none() {
        let cells = empty_board(10, 20);
        let result = finalize_with_lookahead(
            &cells, 10, 20, vec![], I, 0, 0, 9, 0.5, Strategy::Flat,
            &SolverParams::default(), &FlatParams::default(), &FourWideParams::default(),
        );
        assert!(result.is_none());
    }

    #[test]
    fn nan_score_never_beats_a_finite_best() {
        // total_cmp ordering: NaN never compares greater than a finite score
        let cells = empty_board(10, 20);
        let scored = vec![
            (5.0, fp(Placement { piece_type: O, rotation: 0, col: 1, landing_row: 0 }), false),
            (f64::NAN, fp(Placement { piece_type: I, rotation: 0, col: 0, landing_row: 0 }), false),
        ];
        let result = finalize_with_lookahead(
            &cells, 10, 20, scored, 0, 0, 0, 9, 0.5, Strategy::Flat,
            &SolverParams::default(), &FlatParams::default(), &FourWideParams::default(),
        )
        .expect("must return a result");
        assert_eq!(result.placement.col, 1, "finite score must win over NaN");
    }

    #[test]
    fn lookahead_runs_on_wide_boards() {
        // width > 20 exercises compute_metrics_windowed in the bonus path
        let width = 25;
        let height = 20;
        let cells = empty_board(width, height);
        let scored = vec![
            (1.0, fp(Placement { piece_type: I, rotation: 0, col: 5, landing_row: 18 }), false),
            (2.0, fp(Placement { piece_type: O, rotation: 0, col: 10, landing_row: 17 }), true),
        ];
        let result = finalize_with_lookahead(
            &cells, width, height, scored, T, S, 3, 15, 0.5, Strategy::Flat,
            &SolverParams::default(), &FlatParams::default(), &FourWideParams::default(),
        )
        .expect("must return a result");
        assert!(result.placement.piece_type == I || result.placement.piece_type == O);
    }
}
