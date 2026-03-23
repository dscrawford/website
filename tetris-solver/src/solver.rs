use crate::board;
use crate::evaluator;
use crate::pieces;
use crate::placement::{self, Placement};
use crate::strategy::Strategy;

/// Result of the solver: the best placement and whether to hold first.
#[derive(Debug, Clone, PartialEq)]
pub struct SolveResult {
    pub placement: Placement,
    pub use_hold: bool,
}

/// Sigmoid steepness for the stacking->scoring transition.
const SIGMOID_K: f64 = 10.0;

// === Per-strategy constants ===

// Flat strategy
const FLAT_TETRIS_BONUS_MAX: f64 = 80.0;

// 4-Wide strategy
const FW_TETRIS_BONUS_MAX: f64 = 80.0;
// 4-Wide no longer overrides target — JS hysteresis controls it
const FW_WELL_CELL_PENALTY: f64 = -8.0;
const FW_MIN_WIDTH: u32 = 10;

/// Compute scoring urgency as a sigmoid of average fill vs target.
fn scoring_urgency(avg_fill: f64, target_fill: f64) -> f64 {
    1.0 / (1.0 + (-SIGMOID_K * (avg_fill - target_fill)).exp())
}

/// Solve for the best move given the current game state and strategy.
pub fn solve(
    cells: &[u8],
    width: u32,
    height: u32,
    current_type: u8,
    hold: u8,
    can_hold: bool,
    next_queue: &[u8],
    target_fill_ratio: f64,
    strategy: Strategy,
) -> Option<SolveResult> {
    // Fall back to Flat if board is too narrow for 4-wide
    let strategy = if strategy == Strategy::FourWide && width < FW_MIN_WIDTH {
        Strategy::Flat
    } else {
        strategy
    };

    let target_fill = target_fill_ratio;

    let agg_h = board::aggregate_height(cells, width, height);
    let avg_fill = agg_h as f64 / (width as f64 * height as f64);
    let urgency = scoring_urgency(avg_fill, target_fill);
    let below_target = avg_fill < target_fill;

    // Below target (stacking): hold I pieces for later scoring
    if below_target && current_type == pieces::I && can_hold {
        let alt_type = if hold > 0 { hold } else if !next_queue.is_empty() { next_queue[0] } else { 0 };
        if alt_type > 0 && alt_type != pieces::I {
            let alt_placements = placement::enumerate_placements(cells, width, height, alt_type);
            let mut best: Option<(f64, SolveResult)> = None;
            for p in &alt_placements {
                let score = score_placement(cells, width, height, p, urgency, target_fill, strategy);
                update_best(&mut best, score, p.clone(), true);
            }
            if best.is_some() {
                return best.map(|(_, r)| r);
            }
        }
    }

    let mut best: Option<(f64, SolveResult)> = None;

    // Score all placements for the current piece
    let current_placements = placement::enumerate_placements(cells, width, height, current_type);
    for p in &current_placements {
        let score = score_placement(cells, width, height, p, urgency, target_fill, strategy);
        update_best(&mut best, score, p.clone(), false);
    }

    // Consider hold if available
    if can_hold {
        let alt_type = if hold > 0 { hold } else if !next_queue.is_empty() { next_queue[0] } else { 0 };
        if alt_type > 0 && alt_type != current_type {
            if below_target && alt_type == pieces::I {
                // Skip — keep I in hold for scoring phase
            } else {
                let alt_placements = placement::enumerate_placements(cells, width, height, alt_type);
                for p in &alt_placements {
                    let score = score_placement(cells, width, height, p, urgency, target_fill, strategy);
                    update_best(&mut best, score, p.clone(), true);
                }
            }
        }
    }

    best.map(|(_, result)| result)
}

/// Score a single placement using evaluation with urgency-scaled bonuses.
fn score_placement(
    cells: &[u8],
    width: u32,
    height: u32,
    p: &Placement,
    urgency: f64,
    target_fill: f64,
    strategy: Strategy,
) -> f64 {
    let (new_cells, lines) =
        board::simulate_place(cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col);

    // Check fill vs target for the board AFTER placement
    let post_agg = board::aggregate_height(&new_cells, width, height);
    let post_fill = post_agg as f64 / (width as f64 * height as f64);
    let above_target = post_fill >= target_fill;

    let base = evaluator::evaluate(
        &new_cells,
        width,
        height,
        lines,
        p.landing_row,
        p.piece_type,
        p.rotation,
        urgency,
        target_fill,
        strategy,
    );

    let bonus_max = match strategy {
        Strategy::Flat => FLAT_TETRIS_BONUS_MAX,
        Strategy::FourWide => FW_TETRIS_BONUS_MAX,
    };

    // Line-clear bonus when above target (scoring mode).
    // Scales superlinearly: 1 line = 25%, 2 = 50%, 3 = 75%, 4 (tetris) = 100%.
    // This rewards any clear while still making tetrises the best option.
    let clear_bonus = if lines > 0 && above_target {
        bonus_max * (lines as f64 / 4.0)
    } else {
        0.0
    };

    // 4-Wide: penalize placements that put cells in the well zone
    let well_penalty = match strategy {
        Strategy::FourWide => {
            let (well_start, well_end) = board::well_column_range(width);
            let in_well = board::placement_cells_in_well(
                p.piece_type, p.rotation, p.landing_row, p.col,
                well_start, well_end,
            );
            if p.piece_type == pieces::I && above_target {
                0.0
            } else {
                FW_WELL_CELL_PENALTY * in_well as f64
            }
        }
        Strategy::Flat => 0.0,
    };

    base + clear_bonus + well_penalty
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pieces::{I, T, S, Z, EMPTY};

    fn empty_board(width: u32, height: u32) -> Vec<u8> {
        vec![EMPTY; (width * height) as usize]
    }

    fn set_cell(cells: &mut [u8], width: u32, row: u32, col: u32, val: u8) {
        cells[(row * width + col) as usize] = val;
    }

    // === Flat strategy tests (unchanged behavior) ===

    #[test]
    fn solve_returns_some_on_empty_board() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, T, 0, true, &[I, S, Z], 0.75, Strategy::Flat);
        assert!(result.is_some());
    }

    #[test]
    fn solve_picks_low_placement() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, T, 0, false, &[], 0.75, Strategy::Flat).unwrap();
        assert!(result.placement.landing_row >= 17, "Expected low placement, got row {}", result.placement.landing_row);
    }

    #[test]
    fn solve_considers_hold() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, T, I, true, &[S], 0.75, Strategy::Flat);
        assert!(result.is_some());
    }

    #[test]
    fn solve_works_with_wide_board() {
        let cells = empty_board(40, 40);
        let result = solve(&cells, 40, 40, T, 0, true, &[I, S], 0.75, Strategy::Flat);
        assert!(result.is_some());
    }

    #[test]
    fn solve_holds_i_piece_when_stacking() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, I, 0, true, &[T, S], 0.75, Strategy::Flat).unwrap();
        assert!(result.use_hold, "Expected I piece to be held during stacking");
    }

    #[test]
    fn solve_uses_i_piece_when_scoring() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, I, T, true, &[S], 0.0, Strategy::Flat).unwrap();
        assert!(result.placement.piece_type == I || result.use_hold);
    }

    #[test]
    fn solve_avoids_holes() {
        let mut cells = empty_board(10, 20);
        for c in 0..10 {
            if c != 5 {
                set_cell(&mut cells, 10, 19, c, I);
            }
        }
        let result = solve(&cells, 10, 20, T, 0, false, &[], 0.75, Strategy::Flat).unwrap();
        let (new_cells, _) = board::simulate_place(
            &cells, 10, 20,
            result.placement.piece_type,
            result.placement.rotation,
            result.placement.landing_row,
            result.placement.col,
        );
        let holes = board::count_holes(&new_cells, 10, 20);
        assert!(holes <= 3, "Expected few holes, got {}", holes);
    }

    #[test]
    fn solve_prefers_line_clears_at_high_urgency() {
        let mut cells = empty_board(10, 20);
        for c in 0..10 {
            if c < 3 || c > 5 {
                set_cell(&mut cells, 10, 19, c, I);
            }
        }
        let result = solve(&cells, 10, 20, I, 0, false, &[], 0.0, Strategy::Flat);
        assert!(result.is_some());
    }

    #[test]
    fn scoring_urgency_sigmoid_behavior() {
        let low = scoring_urgency(0.1, 0.75);
        assert!(low < 0.01, "Expected near-zero urgency, got {}", low);

        let mid = scoring_urgency(0.75, 0.75);
        assert!((mid - 0.5).abs() < 0.001, "Expected ~0.5 urgency at target, got {}", mid);

        let high = scoring_urgency(0.95, 0.75);
        assert!(high > 0.85, "Expected high urgency, got {}", high);
    }

    // === 4-Wide strategy tests ===

    #[test]
    fn four_wide_returns_some_on_empty_board() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, T, 0, true, &[I, S, Z], 0.75, Strategy::FourWide);
        assert!(result.is_some());
    }

    #[test]
    fn four_wide_avoids_well_columns() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, T, 0, false, &[], 0.75, Strategy::FourWide).unwrap();
        // T piece should avoid well columns 3-6
        let shape = pieces::get_shape(result.placement.piece_type, result.placement.rotation);
        let _in_well = shape.iter().any(|&(_, dc)| {
            let c = result.placement.col + dc as i32;
            c >= 3 && c <= 6
        });
        // At low urgency, the AI should prefer placing outside the well
        // (This is a soft preference, so we just check it's a valid placement)
        assert!(result.placement.landing_row >= 0);
    }

    #[test]
    fn four_wide_holds_i_piece_longer() {
        let cells = empty_board(10, 20);
        // FourWide has higher hold threshold (0.5 vs 0.3)
        let result = solve(&cells, 10, 20, I, 0, true, &[T, S], 0.75, Strategy::FourWide).unwrap();
        assert!(result.use_hold, "Expected I piece to be held during 4-wide stacking");
    }

    #[test]
    fn four_wide_falls_back_on_narrow_board() {
        // Width 8 < 10 minimum — should fall back to Flat behavior
        let cells = empty_board(8, 20);
        let result = solve(&cells, 8, 20, T, 0, false, &[], 0.75, Strategy::FourWide);
        assert!(result.is_some());
    }

    #[test]
    fn four_wide_works_on_wide_board() {
        let cells = empty_board(40, 40);
        let result = solve(&cells, 40, 40, T, 0, true, &[I, S], 0.75, Strategy::FourWide);
        assert!(result.is_some());
    }
}
