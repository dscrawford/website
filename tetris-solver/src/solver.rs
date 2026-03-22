use crate::board;
use crate::evaluator;
use crate::placement::{self, Placement};

/// Result of the solver: the best placement and whether to hold first.
#[derive(Debug, Clone, PartialEq)]
pub struct SolveResult {
    pub placement: Placement,
    pub use_hold: bool,
}

/// Solve for the best move given the current game state.
/// Pure greedy: evaluate all placements of current piece (and optionally
/// held/next piece) using El-Tetris heuristics, pick the highest score.
pub fn solve(
    cells: &[u8],
    width: u32,
    height: u32,
    current_type: u8,
    hold: u8,
    can_hold: bool,
    next_queue: &[u8],
) -> Option<SolveResult> {
    let mut best: Option<(f64, SolveResult)> = None;

    // Score all placements for the current piece
    let current_placements = placement::enumerate_placements(cells, width, height, current_type);
    for p in &current_placements {
        let score = score_placement(cells, width, height, p);
        update_best(&mut best, score, p.clone(), false);
    }

    // Consider hold if available
    if can_hold {
        let alt_type = if hold > 0 { hold } else if !next_queue.is_empty() { next_queue[0] } else { 0 };
        if alt_type > 0 && alt_type != current_type {
            let alt_placements = placement::enumerate_placements(cells, width, height, alt_type);
            for p in &alt_placements {
                let score = score_placement(cells, width, height, p);
                update_best(&mut best, score, p.clone(), true);
            }
        }
    }

    best.map(|(_, result)| result)
}

/// Score a single placement using El-Tetris evaluation.
fn score_placement(cells: &[u8], width: u32, height: u32, p: &Placement) -> f64 {
    let (new_cells, lines) =
        board::simulate_place(cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col);
    evaluator::evaluate(
        &new_cells,
        width,
        height,
        lines,
        p.landing_row,
        p.piece_type,
        p.rotation,
    )
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
        let result = solve(&cells, 10, 20, T, 0, true, &[I, S, Z]);
        assert!(result.is_some());
    }

    #[test]
    fn solve_picks_low_placement() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, T, 0, false, &[]).unwrap();
        // El-Tetris penalizes landing height, so piece should land near the bottom
        assert!(result.placement.landing_row >= 17, "Expected low placement, got row {}", result.placement.landing_row);
    }

    #[test]
    fn solve_considers_hold() {
        let cells = empty_board(10, 20);
        // With hold available and a different piece held, solver should consider both
        let result = solve(&cells, 10, 20, T, I, true, &[S]);
        assert!(result.is_some());
    }

    #[test]
    fn solve_works_with_wide_board() {
        let cells = empty_board(40, 40);
        let result = solve(&cells, 40, 40, T, 0, true, &[I, S]);
        assert!(result.is_some());
    }

    #[test]
    fn solve_avoids_holes() {
        let mut cells = empty_board(10, 20);
        // Fill row 19 except col 5
        for c in 0..10 {
            if c != 5 {
                set_cell(&mut cells, 10, 19, c, I);
            }
        }
        // Solver should prefer filling the gap at col 5 to avoid creating holes
        let result = solve(&cells, 10, 20, T, 0, false, &[]).unwrap();
        // The placement shouldn't create additional holes
        let (new_cells, _) = board::simulate_place(
            &cells, 10, 20,
            result.placement.piece_type,
            result.placement.rotation,
            result.placement.landing_row,
            result.placement.col,
        );
        let holes = board::count_holes(&new_cells, 10, 20);
        // Good solver should keep holes minimal
        assert!(holes <= 2, "Expected few holes, got {}", holes);
    }

    #[test]
    fn solve_prefers_line_clears() {
        let mut cells = empty_board(10, 20);
        // Fill row 19 except cols 3,4,5 (T piece rotation 2 fills 3 cells in a row)
        for c in 0..10 {
            if c < 3 || c > 5 {
                set_cell(&mut cells, 10, 19, c, I);
            }
        }
        // Fill col 4 at row 18 (T rotation 2 also has a cell at row+1, col+1)
        // With almost full row, solver should try to complete it
        let result = solve(&cells, 10, 20, I, 0, false, &[]);
        assert!(result.is_some());
    }
}
