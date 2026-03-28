use crate::board;
use crate::evaluator_param;
use crate::params::{FlatParams, FourWideParams, SolverParams};
use crate::pieces;
use crate::placement::{self, Placement};
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

    let agg_h = board::aggregate_height(cells, width, height);
    let avg_fill = agg_h as f64 / (width as f64 * height as f64);
    let urgency = scoring_urgency(avg_fill, target_fill, sp.sigmoid_k);
    let below_target = avg_fill < target_fill;

    // Below target (stacking): hold I pieces for later scoring
    if below_target && current_type == pieces::I && can_hold {
        let alt_type = if hold > 0 {
            hold
        } else if !next_queue.is_empty() {
            next_queue[0]
        } else {
            0
        };
        if alt_type > 0 && alt_type != pieces::I {
            let alt_placements = placement::enumerate_placements(cells, width, height, alt_type);
            let mut best: Option<(f64, SolveResult)> = None;
            for p in &alt_placements {
                let score = score_placement_param(
                    cells, width, height, p, urgency, target_fill, strategy, sp, fp, fwp,
                );
                update_best(&mut best, score, p.clone(), true);
            }
            if best.is_some() {
                return best.map(|(_, r)| r);
            }
        }
    }

    let mut best: Option<(f64, SolveResult)> = None;

    let current_placements = placement::enumerate_placements(cells, width, height, current_type);
    for p in &current_placements {
        let score = score_placement_param(
            cells, width, height, p, urgency, target_fill, strategy, sp, fp, fwp,
        );
        update_best(&mut best, score, p.clone(), false);
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
            if below_target && alt_type == pieces::I {
                // Skip — keep I in hold for scoring phase
            } else {
                let alt_placements =
                    placement::enumerate_placements(cells, width, height, alt_type);
                for p in &alt_placements {
                    let score = score_placement_param(
                        cells, width, height, p, urgency, target_fill, strategy, sp, fp, fwp,
                    );
                    update_best(&mut best, score, p.clone(), true);
                }
            }
        }
    }

    best.map(|(_, result)| result)
}

/// Score a single placement using parameterized evaluation.
fn score_placement_param(
    cells: &[u8],
    width: u32,
    height: u32,
    p: &Placement,
    urgency: f64,
    target_fill: f64,
    strategy: Strategy,
    sp: &SolverParams,
    fp: &FlatParams,
    fwp: &FourWideParams,
) -> f64 {
    let (new_cells, lines) =
        board::simulate_place(cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col);

    let post_agg = board::aggregate_height(&new_cells, width, height);
    let post_fill = post_agg as f64 / (width as f64 * height as f64);
    let above_target = post_fill >= target_fill;

    let base = evaluator_param::evaluate(
        &new_cells, width, height, lines, p.landing_row, p.piece_type, p.rotation,
        urgency, target_fill, strategy, fp, fwp,
    );

    let bonus_max = match strategy {
        Strategy::Flat => sp.flat_tetris_bonus_max,
        Strategy::FourWide => sp.fw_tetris_bonus_max,
    };

    let clear_bonus = if lines > 0 && above_target {
        bonus_max * (lines as f64 / 4.0)
    } else {
        0.0
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
        Strategy::Flat => 0.0,
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

    if below_target && current_type == pieces::I && can_hold {
        let alt_type = if hold > 0 {
            hold
        } else if !next_queue.is_empty() {
            next_queue[0]
        } else {
            0
        };
        if alt_type > 0 && alt_type != pieces::I {
            let alt_placements = placement::enumerate_placements_windowed(cells, width, height, alt_type);
            let mut best: Option<(f64, SolveResult)> = None;
            for p in &alt_placements {
                let score = score_placement_fast(
                    cells, width, height, p, urgency, target_fill, strategy, sp, fp, fwp,
                    well_start, well_end, col_min, col_max,
                );
                update_best(&mut best, score, p.clone(), true);
            }
            if best.is_some() {
                return best.map(|(_, r)| r);
            }
        }
    }

    let mut best: Option<(f64, SolveResult)> = None;

    let current_placements = placement::enumerate_placements_windowed(cells, width, height, current_type);
    for p in &current_placements {
        let score = score_placement_fast(
            cells, width, height, p, urgency, target_fill, strategy, sp, fp, fwp,
            well_start, well_end, col_min, col_max,
        );
        update_best(&mut best, score, p.clone(), false);
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
            if below_target && alt_type == pieces::I {
                // Skip
            } else {
                let alt_placements =
                    placement::enumerate_placements_windowed(cells, width, height, alt_type);
                for p in &alt_placements {
                    let score = score_placement_fast(
                        cells, width, height, p, urgency, target_fill, strategy, sp, fp, fwp,
                        well_start, well_end, col_min, col_max,
                    );
                    update_best(&mut best, score, p.clone(), true);
                }
            }
        }
    }

    best.map(|(_, result)| result)
}

/// Score a placement using no-copy simulate and windowed metrics.
fn score_placement_fast(
    cells: &mut [u8],
    width: u32,
    height: u32,
    p: &Placement,
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
    let (lines, metrics) = board::score_placement_no_copy(
        cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col,
        well_start, well_end, col_min, col_max,
    );
    let post_fill = metrics.aggregate_height as f64 / (width as f64 * height as f64);
    let above_target = post_fill >= target_fill;

    let base = evaluator_param::evaluate_fast(
        &metrics, width, height, lines, p.landing_row, p.piece_type, p.rotation,
        target_fill, strategy, fp, fwp,
    );

    let bonus_max = match strategy {
        Strategy::Flat => sp.flat_tetris_bonus_max,
        Strategy::FourWide => sp.fw_tetris_bonus_max,
    };

    let clear_bonus = if lines > 0 && above_target {
        bonus_max * (lines as f64 / 4.0)
    } else {
        0.0
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
        Strategy::Flat => 0.0,
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
    placement: Placement,
    use_hold: bool,
) {
    let result = SolveResult { placement, use_hold };
    match best {
        Some((best_score, _)) if score <= *best_score => {}
        _ => *best = Some((score, result)),
    }
}
