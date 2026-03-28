use crate::evaluator_param;
use crate::params::{FlatParams, FourWideParams};
use crate::strategy::Strategy;

// Keep old constants for reference / documentation only.
// Actual logic now lives in evaluator_param.rs, driven by params::*::default().

/// Evaluate a board state after placement, dispatching on strategy.
pub fn evaluate(
    cells: &[u8],
    width: u32,
    height: u32,
    lines_cleared: u32,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    scoring_urgency: f64,
    target_fill: f64,
    strategy: Strategy,
) -> f64 {
    evaluator_param::evaluate(
        cells, width, height, lines_cleared, landing_row,
        piece_type, rotation, scoring_urgency, target_fill,
        strategy, &FlatParams::default(), &FourWideParams::default(),
    )
}

/// Re-export compute_landing_height from evaluator_param.
pub fn compute_landing_height(height: u32, landing_row: i32, piece_type: u8, rotation: u8) -> f64 {
    evaluator_param::compute_landing_height(height, landing_row, piece_type, rotation)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pieces::{I, T, EMPTY};

    fn empty_board(width: u32, height: u32) -> Vec<u8> {
        vec![EMPTY; (width * height) as usize]
    }

    fn set_cell(cells: &mut [u8], width: u32, row: u32, col: u32, val: u8) {
        cells[(row * width + col) as usize] = val;
    }

    // === Flat strategy tests (unchanged behavior) ===

    #[test]
    fn empty_board_has_baseline_score() {
        let cells = empty_board(10, 20);
        let score = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.75, Strategy::Flat);
        assert!(score.is_finite());
        assert!(score < 0.0);
    }

    #[test]
    fn above_target_rewards_line_clears() {
        let cells = empty_board(10, 20);
        let score_0 = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.0, Strategy::Flat);
        let score_1 = evaluate(&cells, 10, 20, 1, 18, T, 0, 1.0, 0.0, Strategy::Flat);
        assert!(score_1 > score_0, "Above target, clears ({}) should beat no clears ({})", score_1, score_0);
    }

    #[test]
    fn below_target_penalizes_line_clears() {
        let cells = empty_board(10, 20);
        let score_0 = evaluate(&cells, 10, 20, 0, 18, T, 0, 0.0, 0.75, Strategy::Flat);
        let score_1 = evaluate(&cells, 10, 20, 1, 18, T, 0, 0.0, 0.75, Strategy::Flat);
        assert!(score_0 > score_1, "Below target, no clears ({}) should beat clears ({})", score_0, score_1);
    }

    #[test]
    fn scoring_vs_stacking_by_target() {
        let cells = empty_board(10, 20);
        let score_scoring = evaluate(&cells, 10, 20, 1, 18, T, 0, 0.0, 0.0, Strategy::Flat);
        let score_stacking = evaluate(&cells, 10, 20, 1, 18, T, 0, 0.0, 0.75, Strategy::Flat);
        assert!(score_scoring > score_stacking);
    }

    #[test]
    fn height_gap_penalizes_empty_board_during_stacking() {
        let cells = empty_board(10, 20);
        let score_high_target = evaluate(&cells, 10, 20, 0, 18, T, 0, 0.0, 0.75, Strategy::Flat);
        let score_no_target = evaluate(&cells, 10, 20, 0, 18, T, 0, 0.0, 0.0, Strategy::Flat);
        assert!(score_no_target > score_high_target);
    }

    #[test]
    fn target_penalty_differs_by_target() {
        let cells = empty_board(10, 20);
        let score_at_target = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.0, Strategy::Flat);
        let score_off_target = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.75, Strategy::Flat);
        assert!(score_at_target > score_off_target);
    }

    #[test]
    fn holes_penalized() {
        let cells_no_hole = empty_board(10, 20);
        let mut cells_hole = empty_board(10, 20);
        set_cell(&mut cells_hole, 10, 18, 3, T);

        let score_clean = evaluate(&cells_no_hole, 10, 20, 0, 18, T, 0, 1.0, 0.0, Strategy::Flat);
        let score_hole = evaluate(&cells_hole, 10, 20, 0, 18, T, 0, 1.0, 0.0, Strategy::Flat);
        assert!(score_clean > score_hole);
    }

    #[test]
    fn lower_placement_preferred() {
        let cells = empty_board(10, 20);
        let score_low = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.75, Strategy::Flat);
        let score_high = evaluate(&cells, 10, 20, 0, 5, T, 0, 1.0, 0.75, Strategy::Flat);
        assert!(score_low > score_high);
    }

    #[test]
    fn works_on_wide_board() {
        let cells = empty_board(40, 40);
        let score = evaluate(&cells, 40, 40, 0, 38, T, 0, 1.0, 0.75, Strategy::Flat);
        assert!(score.is_finite());
    }

    #[test]
    fn full_row_fewer_transitions() {
        let mut cells_full = empty_board(10, 20);
        for c in 0..10 {
            set_cell(&mut cells_full, 10, 19, c, I);
        }
        let score_full = evaluate(&cells_full, 10, 20, 0, 18, T, 0, 1.0, 0.75, Strategy::Flat);
        let score_empty = evaluate(&empty_board(10, 20), 10, 20, 0, 18, T, 0, 1.0, 0.75, Strategy::Flat);
        assert!(score_full > score_empty);
    }

    // === 4-Wide strategy tests ===

    #[test]
    fn four_wide_clean_well_scores_higher() {
        let mut clean = empty_board(10, 20);
        for c in 0..3 {
            set_cell(&mut clean, 10, 19, c, I);
        }
        let mut dirty = empty_board(10, 20);
        for c in 3..6 {
            set_cell(&mut dirty, 10, 19, c, I);
        }
        let score_clean = evaluate(&clean, 10, 20, 0, 18, T, 0, 0.5, 0.85, Strategy::FourWide);
        let score_dirty = evaluate(&dirty, 10, 20, 0, 18, T, 0, 0.5, 0.85, Strategy::FourWide);
        assert!(score_clean > score_dirty, "Clean well ({}) should score higher than dirty well ({})", score_clean, score_dirty);
    }

    #[test]
    fn four_wide_balanced_towers_preferred() {
        let mut balanced = empty_board(10, 20);
        for r in 17..20 {
            for c in 0..3 { set_cell(&mut balanced, 10, r, c, I); }
            for c in 7..10 { set_cell(&mut balanced, 10, r, c, I); }
        }
        let mut unbalanced = empty_board(10, 20);
        for r in 15..20 {
            for c in 0..3 { set_cell(&mut unbalanced, 10, r, c, I); }
        }
        for c in 7..10 { set_cell(&mut unbalanced, 10, 19, c, I); }

        let score_bal = evaluate(&balanced, 10, 20, 0, 16, T, 0, 1.0, 0.85, Strategy::FourWide);
        let score_unbal = evaluate(&unbalanced, 10, 20, 0, 14, T, 0, 1.0, 0.85, Strategy::FourWide);
        assert!(score_bal > score_unbal, "Balanced ({}) should beat unbalanced ({})", score_bal, score_unbal);
    }

    #[test]
    fn four_wide_stacking_penalizes_clears() {
        let cells = empty_board(10, 20);
        let score_0 = evaluate(&cells, 10, 20, 0, 18, T, 0, 0.0, 0.85, Strategy::FourWide);
        let score_1 = evaluate(&cells, 10, 20, 1, 18, T, 0, 0.0, 0.85, Strategy::FourWide);
        assert!(score_0 > score_1, "During stacking, no clears ({}) should beat clears ({})", score_0, score_1);
    }

    #[test]
    fn four_wide_scoring_rewards_clears() {
        let cells = empty_board(10, 20);
        let score_0 = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.0, Strategy::FourWide);
        let score_1 = evaluate(&cells, 10, 20, 1, 18, T, 0, 1.0, 0.0, Strategy::FourWide);
        assert!(score_1 > score_0, "During scoring, clears ({}) should beat no clears ({})", score_1, score_0);
    }

    #[test]
    fn four_wide_works_on_wide_board() {
        let cells = empty_board(40, 40);
        let score = evaluate(&cells, 40, 40, 0, 38, T, 0, 0.5, 0.85, Strategy::FourWide);
        assert!(score.is_finite());
    }
}
