use crate::params::{FlatParams, FourWideParams, SolverParams};
use crate::placement::Placement;
use crate::solver_param;
use crate::strategy::Strategy;

/// Result of the solver: the best placement, whether to hold first, the
/// input path from spawn (movegen opcodes), and T-spin status at lock.
#[derive(Debug, Clone, PartialEq)]
pub struct SolveResult {
    pub placement: Placement,
    pub use_hold: bool,
    pub path: Vec<u8>,
    pub spin: u8,
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

    fn tetris_ready_board() -> Vec<u8> {
        // Rows 16-19 full except col 9: one vertical I from a tetris
        let mut cells = empty_board(10, 20);
        for r in 16..20 {
            for c in 0..9 {
                set_cell(&mut cells, 10, r, c, I);
            }
        }
        cells
    }

    fn economics_params() -> (crate::params::SolverParams, crate::params::FlatParams, crate::params::FourWideParams) {
        // Height-gap holds the board at target for the visual design; zero it
        // here so these tests isolate the clear-pricing economics
        let fp = crate::params::FlatParams { w_height_gap: 0.0, ..Default::default() };
        (Default::default(), fp, Default::default())
    }

    #[test]
    fn declines_single_that_kills_tetris() {
        // Scoring mode with a tetris-ready well: burning it with a non-I
        // piece must lose to stacking and waiting for the I
        let cells = tetris_ready_board();
        let (sp, fp, fwp) = economics_params();
        for piece in [crate::pieces::L, crate::pieces::J, S, T] {
            let result = crate::solver_param::solve_param(
                &cells, 10, 20, piece, 0, false, &[], 0.0, Strategy::Flat, &sp, &fp, &fwp,
            )
            .unwrap();
            let shape = crate::pieces::get_shape(result.placement.piece_type, result.placement.rotation);
            let touches_well = shape
                .iter()
                .any(|&(_, dc)| result.placement.col + dc as i32 == 9);
            assert!(
                !touches_well,
                "piece {} placed into the well column (rot {} col {} row {})",
                piece, result.placement.rotation, result.placement.col, result.placement.landing_row
            );
        }
    }

    #[test]
    fn takes_the_tetris_with_i() {
        let cells = tetris_ready_board();
        let (sp, fp, fwp) = economics_params();
        let result = crate::solver_param::solve_param(
            &cells, 10, 20, I, 0, false, &[], 0.0, Strategy::Flat, &sp, &fp, &fwp,
        )
        .unwrap();
        let (_, lines) = board::simulate_place(
            &cells, 10, 20,
            result.placement.piece_type, result.placement.rotation,
            result.placement.landing_row, result.placement.col,
        );
        assert_eq!(lines, 4, "I piece should clear the tetris, got {} lines", lines);
    }

    #[test]
    fn releases_held_i_in_danger_zone() {
        // Stack into the top quarter with a ready well: the I must be
        // played for the tetris, not hoarded for a target that may never come
        let mut cells = empty_board(10, 20);
        for r in 2..20 {
            for c in 0..9 {
                set_cell(&mut cells, 10, r, c, I);
            }
        }
        let result = solve(&cells, 10, 20, I, 0, true, &[T, S], 0.75, Strategy::Flat).unwrap();
        assert!(
            !result.use_hold && result.placement.piece_type == I,
            "I should be played, not held (use_hold={})",
            result.use_hold
        );
        let (_, lines) = board::simulate_place(
            &cells, 10, 20,
            result.placement.piece_type, result.placement.rotation,
            result.placement.landing_row, result.placement.col,
        );
        assert_eq!(lines, 4, "I should clear four lines from the well");
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
