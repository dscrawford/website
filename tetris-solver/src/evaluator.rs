use crate::board;
use crate::pieces::EMPTY;

/// Weights for the board evaluation heuristic.
pub struct Weights {
    pub open_col_clear: f64,
    pub tetris_ready: f64,
    pub aggregate_height: f64,
    pub holes: f64,
    pub bumpiness: f64,
    pub lines_cleared_single: f64,
    pub lines_cleared_tetris: f64,
    pub open_col_blockage: f64,
    pub max_height: f64,
    pub height_danger: f64,
}

impl Default for Weights {
    fn default() -> Self {
        Weights {
            open_col_clear: 1000.0,
            tetris_ready: 500.0,
            aggregate_height: -4.0,
            holes: -8.0,
            bumpiness: -3.0,
            lines_cleared_single: 8.0,
            lines_cleared_tetris: 40.0,
            open_col_blockage: -50.0,
            max_height: -5.0,
            height_danger: -20.0,
        }
    }
}

/// Evaluate a board state after a piece has been placed.
/// `open_col` is the column index kept open for I-piece Tetrises.
pub fn evaluate(
    cells: &[u8],
    width: u32,
    height: u32,
    lines_cleared: u32,
    open_col: u32,
    weights: &Weights,
) -> f64 {
    let mut score = 0.0;

    // Open column: is it completely clear?
    let open_col_height = board::column_height(cells, width, height, open_col);
    if open_col_height == 0 {
        score += weights.open_col_clear;
    }

    // Tetris ready: check if 4+ rows beside the open column are filled
    score += tetris_readiness(cells, width, height, open_col) * weights.tetris_ready;

    // Aggregate height
    score += board::aggregate_height(cells, width, height) as f64 * weights.aggregate_height;

    // Holes
    score += board::count_holes(cells, width, height) as f64 * weights.holes;

    // Bumpiness (excluding the open column from calculation)
    score += bumpiness_excluding(cells, width, height, open_col) as f64 * weights.bumpiness;

    // Lines cleared bonus
    let lines_score = match lines_cleared {
        0 => 0.0,
        1 => weights.lines_cleared_single,
        2 => weights.lines_cleared_single * 3.0,
        3 => weights.lines_cleared_single * 6.0,
        4 => weights.lines_cleared_tetris,
        _ => weights.lines_cleared_tetris,
    };
    score += lines_score;

    // Open column blockage penalty
    score += open_col_height as f64 * weights.open_col_blockage;

    // Max height penalty
    let mh = board::max_height(cells, width, height);
    score += mh as f64 * weights.max_height;

    // Height danger: exponential penalty when stack exceeds 60% of board height
    let danger_threshold = (height * 3 / 5) as f64;
    if mh as f64 > danger_threshold {
        let over = mh as f64 - danger_threshold;
        score += over * over * weights.height_danger;
    }

    score
}

/// Count how many complete rows exist if the open column were filled.
/// This measures how "ready" the board is for a Tetris clear.
fn tetris_readiness(cells: &[u8], width: u32, height: u32, open_col: u32) -> f64 {
    let w = width as usize;
    let h = height as usize;
    let oc = open_col as usize;
    let mut ready_rows = 0.0;

    for row in 0..h {
        let start = row * w;
        let mut row_full_except_open = true;
        for col in 0..w {
            if col == oc {
                continue;
            }
            if cells[start + col] == EMPTY {
                row_full_except_open = false;
                break;
            }
        }
        if row_full_except_open && cells[start + oc] == EMPTY {
            ready_rows += 1.0;
        }
    }

    // Cap at 4 (one Tetris worth) and normalize
    if ready_rows >= 4.0 { 1.0 } else { ready_rows / 4.0 }
}

/// Calculate bumpiness excluding the open column.
fn bumpiness_excluding(cells: &[u8], width: u32, height: u32, open_col: u32) -> u32 {
    let mut heights: Vec<u32> = Vec::new();
    for col in 0..width {
        if col == open_col {
            continue;
        }
        heights.push(board::column_height(cells, width, height, col));
    }
    if heights.len() < 2 {
        return 0;
    }
    let mut bump = 0u32;
    for i in 1..heights.len() {
        bump += heights[i].abs_diff(heights[i - 1]);
    }
    bump
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
    fn empty_board_high_score_for_clear_open_col() {
        let cells = empty_board(10, 20);
        let weights = Weights::default();
        let score = evaluate(&cells, 10, 20, 0, 9, &weights);
        // Open column is clear => +1000
        assert!(score >= 1000.0);
    }

    #[test]
    fn blocked_open_col_penalized() {
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 19, 9, T);
        let weights = Weights::default();
        let score = evaluate(&cells, 10, 20, 0, 9, &weights);
        // Open col blocked => no +1000, and -50 blockage penalty
        assert!(score < 1000.0);
    }

    #[test]
    fn holes_penalized() {
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 18, 3, T);
        // row 19, col 3 is a hole
        let weights = Weights::default();
        let score_with_hole = evaluate(&cells, 10, 20, 0, 9, &weights);

        let cells2 = empty_board(10, 20);
        let score_no_hole = evaluate(&cells2, 10, 20, 0, 9, &weights);

        assert!(score_no_hole > score_with_hole);
    }

    #[test]
    fn tetris_clear_highest_bonus() {
        let cells = empty_board(10, 20);
        let weights = Weights::default();
        let score_tetris = evaluate(&cells, 10, 20, 4, 9, &weights);
        let score_single = evaluate(&cells, 10, 20, 1, 9, &weights);
        assert!(score_tetris > score_single);
    }

    #[test]
    fn tetris_readiness_full_rows() {
        let mut cells = empty_board(10, 20);
        // Fill rows 16-19 except col 9
        for r in 16..20 {
            for c in 0..9 {
                set_cell(&mut cells, 10, r, c, I);
            }
        }
        let readiness = tetris_readiness(&cells, 10, 20, 9);
        assert!((readiness - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn tetris_readiness_partial() {
        let mut cells = empty_board(10, 20);
        // Fill 2 rows except col 9
        for r in 18..20 {
            for c in 0..9 {
                set_cell(&mut cells, 10, r, c, I);
            }
        }
        let readiness = tetris_readiness(&cells, 10, 20, 9);
        assert!((readiness - 0.5).abs() < f64::EPSILON);
    }

    #[test]
    fn height_danger_penalty_kicks_in() {
        let mut cells_low = empty_board(10, 20);
        let mut cells_high = empty_board(10, 20);
        let weights = Weights::default();

        // Low stack: col 0 height 5 (25% of board) — no danger
        for r in 15..20 {
            set_cell(&mut cells_low, 10, r, 0, I);
        }

        // High stack: col 0 height 15 (75% of board) — above 60% threshold
        for r in 5..20 {
            set_cell(&mut cells_high, 10, r, 0, I);
        }

        let score_low = evaluate(&cells_low, 10, 20, 0, 9, &weights);
        let score_high = evaluate(&cells_high, 10, 20, 0, 9, &weights);

        // High stack should be penalized much more severely
        assert!(score_low > score_high, "High stack ({}) should score worse than low stack ({})", score_high, score_low);

        // The difference should be significant due to quadratic danger penalty
        let diff = score_low - score_high;
        assert!(diff > 100.0, "Danger penalty should be significant, diff={}", diff);
    }

    #[test]
    fn bumpiness_excluding_works() {
        let mut cells = empty_board(10, 20);
        // Col 0 height 2, col 1 height 1, col 9 (open) height 5
        set_cell(&mut cells, 10, 18, 0, I);
        set_cell(&mut cells, 10, 19, 0, I);
        set_cell(&mut cells, 10, 19, 1, I);
        for r in 15..20 {
            set_cell(&mut cells, 10, r, 9, I);
        }
        // Without open col: heights are [2, 1, 0, 0, 0, 0, 0, 0, 0]
        // bumpiness = |2-1| + |1-0| + 0+0+0+0+0+0 = 2
        let bump = bumpiness_excluding(&cells, 10, 20, 9);
        assert_eq!(bump, 2);
    }
}
