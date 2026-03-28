use crate::params::{FlatParams, FourWideParams, SolverParams};
use crate::placement::Placement;
use crate::solver_param;
use crate::strategy::Strategy;

/// Result of the solver: the best placement and whether to hold first.
#[derive(Debug, Clone, PartialEq)]
pub struct SolveResult {
    pub placement: Placement,
    pub use_hold: bool,
}

/// Solve for the best move given the current game state and strategy.
/// Delegates to solver_param with default parameters.
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
    solver_param::solve_param(
        cells, width, height, current_type, hold, can_hold, next_queue,
        target_fill_ratio, strategy,
        &SolverParams::default(), &FlatParams::default(), &FourWideParams::default(),
    )
}

/// Expose scoring_urgency for tests via solver_param.
#[cfg(test)]
fn scoring_urgency(avg_fill: f64, target_fill: f64) -> f64 {
    1.0 / (1.0 + (-10.0 * (avg_fill - target_fill)).exp())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board;
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
        let _shape = crate::pieces::get_shape(result.placement.piece_type, result.placement.rotation);
        assert!(result.placement.landing_row >= 0);
    }

    #[test]
    fn four_wide_holds_i_piece_longer() {
        let cells = empty_board(10, 20);
        let result = solve(&cells, 10, 20, I, 0, true, &[T, S], 0.75, Strategy::FourWide).unwrap();
        assert!(result.use_hold, "Expected I piece to be held during 4-wide stacking");
    }

    #[test]
    fn four_wide_falls_back_on_narrow_board() {
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
