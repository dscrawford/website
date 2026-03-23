use crate::board;
use crate::pieces;
use crate::strategy::Strategy;

// === Flat strategy weights (El-Tetris, Yiyuan Lee) ===

const W_LANDING_HEIGHT: f64 = -4.500158825082766;
const W_ROW_TRANSITIONS: f64 = -3.2178882868487753;
const W_COLUMN_TRANSITIONS: f64 = -9.348695305445199;
const W_HOLES: f64 = -7.899265427351652;
const W_WELL_SUMS: f64 = -3.3855972247263626;
const W_HEIGHT_GAP: f64 = -8000.0;

// === 4-Wide strategy weights ===

const FW_LANDING_HEIGHT: f64 = -4.5;
const FW_WELL_CLEANLINESS: f64 = 50.0;
const FW_HOLES: f64 = -10.0;
const FW_COLUMN_TRANSITIONS: f64 = -6.0;
const FW_ROW_TRANSITIONS: f64 = -2.0;
const FW_WELL_SUMS: f64 = -1.0;
const FW_TOWER_BALANCE: f64 = -4.0;
const FW_ROWS_STACKING: f64 = -20.0;
const FW_ROWS_SCORING: f64 = 30.0;
const FW_HEIGHT_GAP: f64 = -8000.0;

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
    match strategy {
        Strategy::Flat => evaluate_flat(
            cells, width, height, lines_cleared, landing_row,
            piece_type, rotation, scoring_urgency, target_fill,
        ),
        Strategy::FourWide => evaluate_four_wide(
            cells, width, height, lines_cleared, landing_row,
            piece_type, rotation, scoring_urgency, target_fill,
        ),
    }
}

/// Flat strategy: original El-Tetris evaluation with urgency-based weight interpolation.
fn evaluate_flat(
    cells: &[u8],
    width: u32,
    height: u32,
    lines_cleared: u32,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    _scoring_urgency: f64,
    target_fill: f64,
) -> f64 {
    let landing_height = compute_landing_height(height, landing_row, piece_type, rotation);

    let row_trans = board::row_transitions(cells, width, height) as f64;
    let col_trans = board::column_transitions(cells, width, height) as f64;
    let holes = board::count_holes(cells, width, height) as f64;
    let wells = board::well_sums(cells, width, height) as f64;

    let avg_fill = board::aggregate_height(cells, width, height) as f64 / (width as f64 * height as f64);

    let below_target = avg_fill < target_fill;

    // Symmetric distance-from-target penalty — the dominant force in both modes
    let deviation = (avg_fill - target_fill).abs();
    let target_penalty = W_HEIGHT_GAP * deviation * deviation;

    if below_target {
        // STACKING MODE: full El-Tetris quality weights, penalize line clears,
        // reduced landing height (we want to stack high)
        const W_STACKING_ROWS: f64 = -20.0;
        let landing_weight = W_LANDING_HEIGHT * 0.2;

        landing_weight * landing_height
            + W_STACKING_ROWS * lines_cleared as f64
            + W_ROW_TRANSITIONS * row_trans
            + W_COLUMN_TRANSITIONS * col_trans
            + W_HOLES * holes
            + W_WELL_SUMS * wells
            + target_penalty
    } else {
        // SCORING MODE: massively reward line clears, reduce quality weights
        // so the solver prioritizes getting lines off the board over keeping
        // a pristine surface. Holes/transitions matter less when clearing down.
        const W_SCORING_ROWS: f64 = 30.0;

        landing_height * W_LANDING_HEIGHT
            + W_SCORING_ROWS * lines_cleared as f64
            + W_ROW_TRANSITIONS * row_trans * 0.3
            + W_COLUMN_TRANSITIONS * col_trans * 0.3
            + W_HOLES * holes * 0.5
            + W_WELL_SUMS * wells * 0.3
            + target_penalty
    }
}

/// 4-Wide strategy: rewards keeping a centered 4-wide well clear while building towers.
/// Uses the same binary stacking/scoring approach as flat, with tower-specific metrics.
fn evaluate_four_wide(
    cells: &[u8],
    width: u32,
    height: u32,
    lines_cleared: u32,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    _scoring_urgency: f64,
    target_fill: f64,
) -> f64 {
    let landing_height = compute_landing_height(height, landing_row, piece_type, rotation);

    let (well_start, well_end) = board::well_column_range(width);
    let well_area = (well_end - well_start + 1) * height;
    let well_filled = board::well_fill_count(cells, width, height, well_start, well_end);
    let well_clean_ratio = 1.0 - (well_filled as f64 / well_area as f64);

    let holes = board::count_holes(cells, width, height) as f64;
    let col_trans = board::column_transitions(cells, width, height) as f64;
    let row_trans = board::row_transitions(cells, width, height) as f64;
    let wells = board::well_sums(cells, width, height) as f64;

    let (left_avg, right_avg) = board::tower_zone_avg_heights(cells, width, height, well_start, well_end);
    let balance_penalty = (left_avg - right_avg).abs();

    let avg_fill = board::aggregate_height(cells, width, height) as f64 / (width as f64 * height as f64);
    let below_target = avg_fill < target_fill;

    // Symmetric distance-from-target penalty
    let deviation = (avg_fill - target_fill).abs();
    let target_penalty = FW_HEIGHT_GAP * deviation * deviation;

    if below_target {
        // STACKING: build towers, keep well clear, penalize line clears
        FW_LANDING_HEIGHT * 0.2 * landing_height
            + FW_WELL_CLEANLINESS * well_clean_ratio
            + FW_HOLES * holes
            + FW_COLUMN_TRANSITIONS * col_trans
            + FW_ROW_TRANSITIONS * row_trans
            + FW_WELL_SUMS * wells
            + FW_TOWER_BALANCE * balance_penalty
            + FW_ROWS_STACKING * lines_cleared as f64
            + target_penalty
    } else {
        // SCORING: aggressively clear lines, relax quality weights
        FW_LANDING_HEIGHT * landing_height
            + FW_WELL_CLEANLINESS * well_clean_ratio * 0.3
            + FW_HOLES * holes * 0.5
            + FW_COLUMN_TRANSITIONS * col_trans * 0.3
            + FW_ROW_TRANSITIONS * row_trans * 0.3
            + FW_WELL_SUMS * wells * 0.3
            + FW_TOWER_BALANCE * balance_penalty * 0.3
            + FW_ROWS_SCORING * lines_cleared as f64
            + target_penalty
    }
}

/// Compute landing height as the midpoint of the piece's vertical extent,
/// converted from row-index (0=top) to height (0=bottom).
fn compute_landing_height(height: u32, landing_row: i32, piece_type: u8, rotation: u8) -> f64 {
    let shape = pieces::get_shape(piece_type, rotation);
    let rows: Vec<i32> = shape.iter().map(|&(dr, _)| landing_row + dr as i32).collect();
    let min_row = *rows.iter().min().unwrap() as f64;
    let max_row = *rows.iter().max().unwrap() as f64;
    let h = height as f64;
    h - (min_row + max_row) / 2.0
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
        // Board at target — use target 0.0 so empty board is "above target"
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
        // Same board, same piece — but different targets flip the behavior
        let cells = empty_board(10, 20);
        // Target 0.0: board is "above" target → scoring mode → rewards clears
        let score_scoring = evaluate(&cells, 10, 20, 1, 18, T, 0, 0.0, 0.0, Strategy::Flat);
        // Target 0.75: board is "below" target → stacking mode → penalizes clears
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
        // Empty board: avg_fill = 0. Target 0.0 → deviation 0. Target 0.75 → deviation 0.75.
        let score_at_target = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.0, Strategy::Flat);
        let score_off_target = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.75, Strategy::Flat);
        assert!(score_at_target > score_off_target);
    }

    #[test]
    fn holes_penalized() {
        let cells_no_hole = empty_board(10, 20);
        let mut cells_hole = empty_board(10, 20);
        set_cell(&mut cells_hole, 10, 18, 3, T);

        // Use target 0.0 so the target penalty doesn't mask the hole penalty
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
        // Same total fill, but one has pieces in the well and the other in tower zones.
        // Clean: pieces in tower columns (0-2), well (3-6) empty
        let mut clean = empty_board(10, 20);
        for c in 0..3 {
            set_cell(&mut clean, 10, 19, c, I);
        }
        // Dirty: pieces in well columns (3-5), towers empty
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
        // Balanced: both sides have height 3 (18 cells total)
        let mut balanced = empty_board(10, 20);
        for r in 17..20 {
            for c in 0..3 { set_cell(&mut balanced, 10, r, c, I); }
            for c in 7..10 { set_cell(&mut balanced, 10, r, c, I); }
        }
        // Unbalanced: left=5, right=1 (18 cells total — same fill)
        let mut unbalanced = empty_board(10, 20);
        for r in 15..20 {
            for c in 0..3 { set_cell(&mut unbalanced, 10, r, c, I); }
        }
        for c in 7..10 { set_cell(&mut unbalanced, 10, 19, c, I); }

        // Use high urgency so height-gap penalty is zero for both
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
        // Use target 0.0 so empty board is "above target" → scoring mode
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
