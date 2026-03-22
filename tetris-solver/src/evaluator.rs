use crate::board;
use crate::pieces;

/// El-Tetris weights (Yiyuan Lee).
/// These 6 features with these weights achieve millions of lines cleared.
const W_LANDING_HEIGHT: f64 = -4.500158825082766;
const W_ROWS_REMOVED: f64 = 3.4181268101392694;
const W_ROW_TRANSITIONS: f64 = -3.2178882868487753;
const W_COLUMN_TRANSITIONS: f64 = -9.348695305445199;
const W_HOLES: f64 = -7.899265427351652;
const W_WELL_SUMS: f64 = -3.3855972247263626;

/// Weight for the height-gap penalty during stacking.
/// Penalizes the board for being below the target fill ratio.
const W_HEIGHT_GAP: f64 = -1500.0;

/// Evaluate a board state after a piece has been placed using the El-Tetris algorithm.
///
/// - `cells`: the board AFTER placing the piece and clearing lines
/// - `lines_cleared`: number of lines cleared by this placement
/// - `landing_row`: the row where the piece's origin was placed (before line clears)
/// - `piece_type`: the piece that was placed
/// - `rotation`: the rotation of the placed piece
/// - `scoring_urgency`: 0.0 = pure stacking, 1.0 = pure scoring.
///   Controls the rows_removed weight via lerp(-5.0, +3.42, urgency).
/// - `target_fill`: the target avg fill ratio (e.g. 0.75). Used to penalize
///   boards that are too far below the desired stacking height.
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
) -> f64 {
    // Landing height: midpoint of the piece's vertical extent
    let shape = pieces::get_shape(piece_type, rotation);
    let rows: Vec<i32> = shape.iter().map(|&(dr, _)| landing_row + dr as i32).collect();
    let min_row = *rows.iter().min().unwrap() as f64;
    let max_row = *rows.iter().max().unwrap() as f64;
    // Convert from row index (0=top) to height (0=bottom)
    let h = height as f64;
    let landing_height = h - (min_row + max_row) / 2.0;

    let row_trans = board::row_transitions(cells, width, height) as f64;
    let col_trans = board::column_transitions(cells, width, height) as f64;
    let holes = board::count_holes(cells, width, height) as f64;
    let wells = board::well_sums(cells, width, height) as f64;

    // Smoothly interpolate rows_removed weight based on scoring urgency:
    // urgency 0.0 → -5.0 (penalize clears, build up)
    // urgency 0.5 → ~-0.8 (near-neutral)
    // urgency 1.0 → +3.42 (El-Tetris default, reward clears)
    const W_STACKING_ROWS: f64 = -5.0;
    let rows_removed_weight = W_STACKING_ROWS + (W_ROWS_REMOVED - W_STACKING_ROWS) * scoring_urgency;

    // Height-gap penalty: penalize being below the target fill ratio.
    // The gap is how far avg_fill is below target (clamped to 0 when at/above target).
    // Scaled by (1 - urgency) so it fades out as we approach scoring phase.
    let avg_fill = board::aggregate_height(cells, width, height) as f64 / (width as f64 * h);
    let gap = (target_fill - avg_fill).max(0.0);
    let height_gap_penalty = W_HEIGHT_GAP * gap * (1.0 - scoring_urgency);

    W_LANDING_HEIGHT * landing_height
        + rows_removed_weight * lines_cleared as f64
        + W_ROW_TRANSITIONS * row_trans
        + W_COLUMN_TRANSITIONS * col_trans
        + W_HOLES * holes
        + W_WELL_SUMS * wells
        + height_gap_penalty
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

    #[test]
    fn empty_board_has_baseline_score() {
        let cells = empty_board(10, 20);
        // At full urgency, height-gap penalty is zero (multiplied by 1-urgency=0)
        let score = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.75);
        assert!(score.is_finite());
        assert!(score < 0.0);
    }

    #[test]
    fn clearing_lines_improves_score_at_full_urgency() {
        let cells = empty_board(10, 20);
        let score_0 = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.75);
        let score_1 = evaluate(&cells, 10, 20, 1, 18, T, 0, 1.0, 0.75);
        assert!(score_1 > score_0);
    }

    #[test]
    fn stacking_penalizes_line_clears() {
        let cells = empty_board(10, 20);
        let score_0 = evaluate(&cells, 10, 20, 0, 18, T, 0, 0.0, 0.75);
        let score_1 = evaluate(&cells, 10, 20, 1, 18, T, 0, 0.0, 0.75);
        assert!(score_0 > score_1);
    }

    #[test]
    fn mid_urgency_is_between_extremes() {
        let cells = empty_board(10, 20);
        let score_stack = evaluate(&cells, 10, 20, 1, 18, T, 0, 0.0, 0.75);
        let score_mid = evaluate(&cells, 10, 20, 1, 18, T, 0, 0.5, 0.75);
        let score_score = evaluate(&cells, 10, 20, 1, 18, T, 0, 1.0, 0.75);
        assert!(score_mid > score_stack);
        assert!(score_score > score_mid);
    }

    #[test]
    fn height_gap_penalizes_empty_board_during_stacking() {
        let cells = empty_board(10, 20);
        // At urgency 0 with target 0.75, empty board has max gap penalty
        let score_high_target = evaluate(&cells, 10, 20, 0, 18, T, 0, 0.0, 0.75);
        // With target 0.0, no gap penalty
        let score_no_target = evaluate(&cells, 10, 20, 0, 18, T, 0, 0.0, 0.0);
        assert!(score_no_target > score_high_target);
    }

    #[test]
    fn height_gap_fades_at_high_urgency() {
        let cells = empty_board(10, 20);
        // At urgency 1.0, gap penalty is zero regardless of target
        let score_a = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.75);
        let score_b = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.0);
        assert!((score_a - score_b).abs() < 0.001);
    }

    #[test]
    fn holes_penalized() {
        let cells_no_hole = empty_board(10, 20);
        let mut cells_hole = empty_board(10, 20);
        set_cell(&mut cells_hole, 10, 18, 3, T);

        let score_clean = evaluate(&cells_no_hole, 10, 20, 0, 18, T, 0, 1.0, 0.75);
        let score_hole = evaluate(&cells_hole, 10, 20, 0, 18, T, 0, 1.0, 0.75);
        assert!(score_clean > score_hole);
    }

    #[test]
    fn lower_placement_preferred() {
        let cells = empty_board(10, 20);
        let score_low = evaluate(&cells, 10, 20, 0, 18, T, 0, 1.0, 0.75);
        let score_high = evaluate(&cells, 10, 20, 0, 5, T, 0, 1.0, 0.75);
        assert!(score_low > score_high);
    }

    #[test]
    fn works_on_wide_board() {
        let cells = empty_board(40, 40);
        let score = evaluate(&cells, 40, 40, 0, 38, T, 0, 1.0, 0.75);
        assert!(score.is_finite());
    }

    #[test]
    fn full_row_fewer_transitions() {
        let mut cells_full = empty_board(10, 20);
        for c in 0..10 {
            set_cell(&mut cells_full, 10, 19, c, I);
        }
        let score_full = evaluate(&cells_full, 10, 20, 0, 18, T, 0, 1.0, 0.75);
        let score_empty = evaluate(&empty_board(10, 20), 10, 20, 0, 18, T, 0, 1.0, 0.75);
        assert!(score_full > score_empty);
    }
}
