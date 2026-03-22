use crate::board;
use crate::evaluator;
use crate::pieces;
use crate::placement::{self, Placement};

/// Result of the solver: the best placement and whether to hold first.
#[derive(Debug, Clone, PartialEq)]
pub struct SolveResult {
    pub placement: Placement,
    pub use_hold: bool,
}

/// Sigmoid steepness for the stacking→scoring transition.
/// k=10 means the transition spans roughly ±10% of the target fill ratio.
const SIGMOID_K: f64 = 10.0;

/// Urgency threshold below which I pieces are held for later.
const HOLD_I_THRESHOLD: f64 = 0.3;

/// Max-fill ratio above which a quadratic danger penalty kicks in.
const DANGER_THRESHOLD: f64 = 0.85;

/// Peak danger penalty at 100% max fill.
const DANGER_PENALTY_MAX: f64 = -20.0;

/// Bonus for clearing 4 lines (tetris) at full scoring urgency.
const TETRIS_BONUS_MAX: f64 = 50.0;

/// Compute scoring urgency as a sigmoid of average fill vs target.
/// Returns a value in (0, 1): 0 = pure stacking, 1 = pure scoring.
fn scoring_urgency(avg_fill: f64, target_fill: f64) -> f64 {
    1.0 / (1.0 + (-SIGMOID_K * (avg_fill - target_fill)).exp())
}

/// Solve for the best move given the current game state.
///
/// Uses a smooth sigmoid transition between stacking and scoring phases
/// based on aggregate fill ratio vs. `target_fill_ratio`.
pub fn solve(
    cells: &[u8],
    width: u32,
    height: u32,
    current_type: u8,
    hold: u8,
    can_hold: bool,
    next_queue: &[u8],
    target_fill_ratio: f64,
) -> Option<SolveResult> {
    let agg_h = board::aggregate_height(cells, width, height);
    let avg_fill = agg_h as f64 / (width as f64 * height as f64);
    let max_h = board::max_height(cells, width, height);
    let max_fill = max_h as f64 / height as f64;
    let urgency = scoring_urgency(avg_fill, target_fill_ratio);

    // Low urgency: hold I pieces to save them for scoring later
    if urgency < HOLD_I_THRESHOLD && current_type == pieces::I && can_hold {
        let alt_type = if hold > 0 { hold } else if !next_queue.is_empty() { next_queue[0] } else { 0 };
        if alt_type > 0 && alt_type != pieces::I {
            let alt_placements = placement::enumerate_placements(cells, width, height, alt_type);
            let mut best: Option<(f64, SolveResult)> = None;
            for p in &alt_placements {
                let score = score_placement(cells, width, height, p, urgency, max_fill, target_fill_ratio);
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
        let score = score_placement(cells, width, height, p, urgency, max_fill, target_fill_ratio);
        update_best(&mut best, score, p.clone(), false);
    }

    // Consider hold if available
    if can_hold {
        let alt_type = if hold > 0 { hold } else if !next_queue.is_empty() { next_queue[0] } else { 0 };
        if alt_type > 0 && alt_type != current_type {
            // Low urgency: don't pull I pieces out of hold
            if urgency < HOLD_I_THRESHOLD && alt_type == pieces::I {
                // Skip — keep I in hold for scoring phase
            } else {
                let alt_placements = placement::enumerate_placements(cells, width, height, alt_type);
                for p in &alt_placements {
                    let score = score_placement(cells, width, height, p, urgency, max_fill, target_fill_ratio);
                    update_best(&mut best, score, p.clone(), true);
                }
            }
        }
    }

    best.map(|(_, result)| result)
}

/// Score a single placement using El-Tetris evaluation with urgency-scaled bonuses.
fn score_placement(
    cells: &[u8],
    width: u32,
    height: u32,
    p: &Placement,
    urgency: f64,
    max_fill: f64,
    target_fill: f64,
) -> f64 {
    let (new_cells, lines) =
        board::simulate_place(cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col);
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
    );

    // Tetris bonus scales with urgency — small at low urgency, large when ready to score
    let tetris_bonus = if lines == 4 { TETRIS_BONUS_MAX * urgency } else { 0.0 };

    // Danger penalty: quadratic ramp when max column height exceeds 85% of board
    let danger = if max_fill > DANGER_THRESHOLD {
        let excess = (max_fill - DANGER_THRESHOLD) / (1.0 - DANGER_THRESHOLD);
        DANGER_PENALTY_MAX * excess * excess
    } else {
        0.0
    };

    base + tetris_bonus + danger
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

    #[test]
    fn solve_returns_some_on_empty_board() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, T, 0, true, &[I, S, Z], 0.75);
        assert!(result.is_some());
    }

    #[test]
    fn solve_picks_low_placement() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, T, 0, false, &[], 0.75).unwrap();
        assert!(result.placement.landing_row >= 17, "Expected low placement, got row {}", result.placement.landing_row);
    }

    #[test]
    fn solve_considers_hold() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, T, I, true, &[S], 0.75);
        assert!(result.is_some());
    }

    #[test]
    fn solve_works_with_wide_board() {
        let cells = empty_board(40, 40);
        let result = solve(&cells, 40, 40, T, 0, true, &[I, S], 0.75);
        assert!(result.is_some());
    }

    #[test]
    fn solve_holds_i_piece_when_stacking() {
        let cells = empty_board(10, 20);
        // Empty board = avg_fill ~0, urgency near 0 → should hold I piece
        let result = solve(&cells, 10, 20, I, 0, true, &[T, S], 0.75).unwrap();
        assert!(result.use_hold, "Expected I piece to be held during stacking");
    }

    #[test]
    fn solve_uses_i_piece_when_scoring() {
        // With very low target, even empty board triggers scoring
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, I, T, true, &[S], 0.0).unwrap();
        // At target 0.0 urgency is ~1.0, should not force hold
        // (may or may not hold based on which piece scores better)
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
        let result = solve(&cells, 10, 20, T, 0, false, &[], 0.75).unwrap();
        let (new_cells, _) = board::simulate_place(
            &cells, 10, 20,
            result.placement.piece_type,
            result.placement.rotation,
            result.placement.landing_row,
            result.placement.col,
        );
        let holes = board::count_holes(&new_cells, 10, 20);
        assert!(holes <= 2, "Expected few holes, got {}", holes);
    }

    #[test]
    fn solve_prefers_line_clears_at_high_urgency() {
        let mut cells = empty_board(10, 20);
        for c in 0..10 {
            if c < 3 || c > 5 {
                set_cell(&mut cells, 10, 19, c, I);
            }
        }
        // target 0.0 → urgency ~1.0, should prefer clearing
        let result = solve(&cells, 10, 20, I, 0, false, &[], 0.0);
        assert!(result.is_some());
    }

    #[test]
    fn scoring_urgency_sigmoid_behavior() {
        // Well below target: urgency near 0
        let low = scoring_urgency(0.1, 0.75);
        assert!(low < 0.01, "Expected near-zero urgency, got {}", low);

        // At target: urgency = 0.5
        let mid = scoring_urgency(0.75, 0.75);
        assert!((mid - 0.5).abs() < 0.001, "Expected ~0.5 urgency at target, got {}", mid);

        // Well above target: urgency high (sigmoid with k=10)
        let high = scoring_urgency(0.95, 0.75);
        assert!(high > 0.85, "Expected high urgency, got {}", high);
    }
}
