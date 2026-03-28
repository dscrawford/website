use rand::Rng;

use crate::bag::BagRandomizer;
use crate::board;
use crate::params::{FlatParams, FourWideParams, SolverParams};
use crate::pieces;
use crate::solver_param;
use crate::strategy::Strategy;

#[derive(Debug, Clone)]
pub struct GameResult {
    pub pieces_placed: u32,
    pub lines_cleared: u32,
    pub game_over: bool,
}

/// Run a headless Tetris game using the fast solver path.
/// Tracks active column bounds to avoid full-board scans on wide boards.
pub fn run_game(
    width: u32,
    height: u32,
    max_pieces: u32,
    strategy: Strategy,
    solver_params: &SolverParams,
    flat_params: &FlatParams,
    fw_params: &FourWideParams,
    target_fill: f64,
    rng: &mut impl Rng,
) -> GameResult {
    let mut cells = vec![0u8; (width * height) as usize];
    let mut bag = BagRandomizer::new(rng);
    let mut hold: u8 = 0;
    let mut can_hold = true;
    let mut pieces_placed: u32 = 0;
    let mut lines_cleared: u32 = 0;

    // Track active column bounds for windowed operations on wide boards
    let mut active_range: Option<(u32, u32)> = None;

    for _ in 0..max_pieces {
        let current_type = bag.next_piece(rng);
        let next_queue = bag.peek_queue(5);

        let result = solver_param::solve_param_fast(
            &mut cells,
            width,
            height,
            current_type,
            hold,
            can_hold,
            &next_queue,
            target_fill,
            strategy,
            solver_params,
            flat_params,
            fw_params,
            active_range,
        );

        let result = match result {
            Some(r) => r,
            None => {
                return GameResult {
                    pieces_placed,
                    lines_cleared,
                    game_over: true,
                };
            }
        };

        if result.use_hold {
            hold = current_type;
            can_hold = false;
        } else {
            can_hold = true;
        }

        let p = &result.placement;

        if p.landing_row < 0 {
            return GameResult {
                pieces_placed,
                lines_cleared,
                game_over: true,
            };
        }

        // Update active column bounds based on placed piece
        let shape = pieces::get_shape(p.piece_type, p.rotation);
        let piece_min = shape.iter().map(|&(_, dc)| (p.col + dc as i32).max(0) as u32).min().unwrap();
        let piece_max = shape.iter().map(|&(_, dc)| (p.col + dc as i32).min(width as i32 - 1) as u32).max().unwrap();

        active_range = Some(match active_range {
            Some((amin, amax)) => {
                let margin = 4u32;
                (amin.min(piece_min).saturating_sub(margin),
                 (amax.max(piece_max) + margin).min(width - 1))
            }
            None => {
                let margin = 8u32;
                (piece_min.saturating_sub(margin),
                 (piece_max + margin).min(width - 1))
            }
        });

        let (new_cells, cleared) =
            board::simulate_place(&cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col);
        cells = new_cells;
        lines_cleared += cleared;
        pieces_placed += 1;

        let top_filled = cells[..width as usize].iter().any(|&c| c != 0);
        if top_filled {
            return GameResult {
                pieces_placed,
                lines_cleared,
                game_over: true,
            };
        }
    }

    GameResult {
        pieces_placed,
        lines_cleared,
        game_over: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::rngs::SmallRng;

    #[test]
    fn game_runs_without_panic() {
        let mut rng = SmallRng::seed_from_u64(42);
        let result = run_game(
            10, 20, 200, Strategy::Flat,
            &SolverParams::default(), &FlatParams::default(), &FourWideParams::default(),
            0.6, &mut rng,
        );
        assert!(result.pieces_placed > 0);
        assert!(result.lines_cleared > 0);
    }

    #[test]
    fn wide_board_game_runs() {
        let mut rng = SmallRng::seed_from_u64(42);
        let result = run_game(
            100, 200, 50, Strategy::Flat,
            &SolverParams::default(), &FlatParams::default(), &FourWideParams::default(),
            0.6, &mut rng,
        );
        assert!(result.pieces_placed > 0);
    }

    #[test]
    fn four_wide_strategy_runs() {
        let mut rng = SmallRng::seed_from_u64(42);
        let result = run_game(
            10, 20, 100, Strategy::FourWide,
            &SolverParams::default(), &FlatParams::default(), &FourWideParams::default(),
            0.6, &mut rng,
        );
        assert!(result.pieces_placed > 0);
    }
}
