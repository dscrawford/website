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

/// Evaluate a board state after a piece has been placed using the El-Tetris algorithm.
///
/// - `cells`: the board AFTER placing the piece and clearing lines
/// - `lines_cleared`: number of lines cleared by this placement
/// - `landing_row`: the row where the piece's origin was placed (before line clears)
/// - `piece_type`: the piece that was placed
/// - `rotation`: the rotation of the placed piece
pub fn evaluate(
    cells: &[u8],
    width: u32,
    height: u32,
    lines_cleared: u32,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
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

    W_LANDING_HEIGHT * landing_height
        + W_ROWS_REMOVED * lines_cleared as f64
        + W_ROW_TRANSITIONS * row_trans
        + W_COLUMN_TRANSITIONS * col_trans
        + W_HOLES * holes
        + W_WELL_SUMS * wells
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
        let score = evaluate(&cells, 10, 20, 0, 18, T, 0);
        // Should be finite and dominated by row_transitions penalty
        // (40 transitions * -3.2 ≈ -128) + column_transitions (10 * -9.3 ≈ -93)
        assert!(score.is_finite());
        assert!(score < 0.0); // penalties dominate on empty board
    }

    #[test]
    fn clearing_lines_improves_score() {
        // Board with one line cleared should score better than zero
        let cells = empty_board(10, 20);
        let score_0 = evaluate(&cells, 10, 20, 0, 18, T, 0);
        let score_1 = evaluate(&cells, 10, 20, 1, 18, T, 0);
        assert!(score_1 > score_0);
    }

    #[test]
    fn holes_penalized() {
        let cells_no_hole = empty_board(10, 20);

        let mut cells_hole = empty_board(10, 20);
        set_cell(&mut cells_hole, 10, 18, 3, T);
        // row 19, col 3 is a hole

        let score_clean = evaluate(&cells_no_hole, 10, 20, 0, 18, T, 0);
        let score_hole = evaluate(&cells_hole, 10, 20, 0, 18, T, 0);
        assert!(score_clean > score_hole);
    }

    #[test]
    fn lower_placement_preferred() {
        let cells = empty_board(10, 20);
        // Landing at row 18 (near bottom) vs row 5 (high up)
        let score_low = evaluate(&cells, 10, 20, 0, 18, T, 0);
        let score_high = evaluate(&cells, 10, 20, 0, 5, T, 0);
        // Lower landing height = less penalty
        assert!(score_low > score_high);
    }

    #[test]
    fn works_on_wide_board() {
        let cells = empty_board(40, 40);
        let score = evaluate(&cells, 40, 40, 0, 38, T, 0);
        assert!(score.is_finite());
    }

    #[test]
    fn full_row_fewer_transitions() {
        let mut cells_full = empty_board(10, 20);
        for c in 0..10 {
            set_cell(&mut cells_full, 10, 19, c, I);
        }
        // Full row 19 has 0 row transitions vs empty rows with 2 each
        let score_full = evaluate(&cells_full, 10, 20, 0, 18, T, 0);
        let score_empty = evaluate(&empty_board(10, 20), 10, 20, 0, 18, T, 0);
        // Full row reduces row transitions: fewer penalties
        assert!(score_full > score_empty);
    }
}
