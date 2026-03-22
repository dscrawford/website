use crate::board;
use crate::evaluator::{self, Weights};
use crate::pieces;
use crate::placement::{self, Placement};

/// Result of the solver: the best placement and whether to hold first.
#[derive(Debug, Clone, PartialEq)]
pub struct SolveResult {
    pub placement: Placement,
    pub use_hold: bool,
}

/// Solve for the best move given the current game state.
///
/// - `current_type`: current piece (1-7)
/// - `hold`: held piece type, or 0 if none
/// - `can_hold`: whether hold is available this turn
/// - `next_queue`: upcoming pieces (used when holding with no held piece)
/// - `open_col`: column to keep clear (typically width-1)
pub fn solve(
    cells: &[u8],
    width: u32,
    height: u32,
    current_type: u8,
    hold: u8,
    can_hold: bool,
    next_queue: &[u8],
    open_col: u32,
) -> Option<SolveResult> {
    let weights = Weights::default();

    // Score all placements for the current piece
    let current_placements = placement::enumerate_placements(cells, width, height, current_type);
    let mut best: Option<(f64, SolveResult)> = None;

    for p in &current_placements {
        let (new_cells, lines) =
            board::simulate_place(cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col);
        let score = evaluator::evaluate(&new_cells, width, height, lines, open_col, &weights);
        update_best(&mut best, score, p.clone(), false);
    }

    // Consider hold if available
    if can_hold {
        let alt_type = if hold > 0 { hold } else if !next_queue.is_empty() { next_queue[0] } else { 0 };
        if alt_type > 0 && alt_type != current_type {
            let alt_placements = placement::enumerate_placements(cells, width, height, alt_type);
            for p in &alt_placements {
                let (new_cells, lines) =
                    board::simulate_place(cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col);
                let mut score = evaluator::evaluate(&new_cells, width, height, lines, open_col, &weights);

                // Bonus for holding an I-piece when we don't need it yet
                if current_type == pieces::I && !is_tetris_ready(cells, width, height, open_col) {
                    score += 200.0;
                }

                update_best(&mut best, score, p.clone(), true);
            }
        }
    }

    // Special case: if we have an I-piece (current or hold) and the board is tetris-ready,
    // strongly prefer dropping I in the open column
    if is_tetris_ready(cells, width, height, open_col) {
        if let Some(i_result) = find_i_piece_tetris(
            cells, width, height, current_type, hold, can_hold, open_col,
        ) {
            // Override with I-piece Tetris if found
            return Some(i_result);
        }
    }

    best.map(|(_, result)| result)
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

/// Check if the board has 4+ rows that are full except the open column.
fn is_tetris_ready(cells: &[u8], width: u32, height: u32, open_col: u32) -> bool {
    let w = width as usize;
    let h = height as usize;
    let oc = open_col as usize;
    let mut ready = 0;

    for row in 0..h {
        let start = row * w;
        let mut full_except_open = true;
        for col in 0..w {
            if col == oc { continue; }
            if cells[start + col] == pieces::EMPTY {
                full_except_open = false;
                break;
            }
        }
        if full_except_open && cells[start + oc] == pieces::EMPTY {
            ready += 1;
        }
    }
    ready >= 4
}

/// Try to find an I-piece placement in the open column for a Tetris clear.
fn find_i_piece_tetris(
    cells: &[u8],
    width: u32,
    height: u32,
    current_type: u8,
    hold: u8,
    can_hold: bool,
    open_col: u32,
) -> Option<SolveResult> {
    let use_hold;
    if current_type == pieces::I {
        use_hold = false;
    } else if can_hold && hold == pieces::I {
        use_hold = true;
    } else {
        return None;
    }

    // I-piece vertical (rotation 1 or 3) dropped into the open column
    for rotation in [1u8, 3] {
        let min_c = pieces::min_col_offset(pieces::I, rotation) as i32;
        let target_col = open_col as i32 - min_c;

        if board::check_collision(cells, width, height, pieces::I, rotation, 0, target_col) {
            continue;
        }

        let landing_row = board::drop_row(cells, width, height, pieces::I, rotation, target_col);

        return Some(SolveResult {
            placement: Placement {
                piece_type: pieces::I,
                rotation,
                col: target_col,
                landing_row,
            },
            use_hold,
        });
    }

    None
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
        let result = solve(&cells, 10, 20, T, 0, true, &[I, S, Z], 9);
        assert!(result.is_some());
    }

    #[test]
    fn solve_avoids_open_column() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, T, 0, true, &[I, S], 9).unwrap();
        // Placement should NOT occupy column 9
        let shape = pieces::get_shape(result.placement.piece_type, result.placement.rotation);
        for &(_, dc) in shape.iter() {
            let c = result.placement.col + dc as i32;
            assert_ne!(c, 9, "Solver should avoid the open column");
        }
    }

    #[test]
    fn solve_holds_i_piece_when_not_ready() {
        let cells = empty_board(10, 20);
        // Current piece is I, board is empty (not tetris ready)
        // Solver should hold the I piece
        let result = solve(&cells, 10, 20, I, 0, true, &[T, S], 9).unwrap();
        assert!(result.use_hold, "Should hold I piece when board not tetris-ready");
    }

    #[test]
    fn solve_drops_i_piece_when_tetris_ready() {
        let mut cells = empty_board(10, 20);
        // Fill rows 16-19 except col 9
        for r in 16..20 {
            for c in 0..9 {
                set_cell(&mut cells, 10, r, c, T);
            }
        }
        let result = solve(&cells, 10, 20, I, 0, true, &[T, S], 9).unwrap();
        assert!(!result.use_hold);
        assert_eq!(result.placement.piece_type, I);
        // Should place in the open column
        let shape = pieces::get_shape(I, result.placement.rotation);
        let cols: Vec<i32> = shape.iter().map(|&(_, dc)| result.placement.col + dc as i32).collect();
        assert!(cols.contains(&9), "I piece should be placed in the open column");
    }

    #[test]
    fn solve_swaps_hold_for_i_when_tetris_ready() {
        let mut cells = empty_board(10, 20);
        // Fill rows 16-19 except col 9
        for r in 16..20 {
            for c in 0..9 {
                set_cell(&mut cells, 10, r, c, T);
            }
        }
        // Current piece is T, hold is I
        let result = solve(&cells, 10, 20, T, I, true, &[S], 9).unwrap();
        assert!(result.use_hold, "Should swap to held I piece");
        assert_eq!(result.placement.piece_type, I);
    }

    #[test]
    fn is_tetris_ready_works() {
        let mut cells = empty_board(10, 20);
        assert!(!is_tetris_ready(&cells, 10, 20, 9));

        // Fill 4 rows except col 9
        for r in 16..20 {
            for c in 0..9 {
                set_cell(&mut cells, 10, r, c, T);
            }
        }
        assert!(is_tetris_ready(&cells, 10, 20, 9));
    }

    #[test]
    fn solve_works_with_wide_board() {
        let cells = empty_board(40, 40);
        let result = solve(&cells, 40, 40, T, 0, true, &[I, S], 39);
        assert!(result.is_some());
    }
}
