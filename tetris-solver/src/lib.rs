pub mod pieces;
pub mod board;
pub mod placement;
pub mod evaluator;
pub mod solver;
pub mod moves;
pub mod strategy;

use wasm_bindgen::prelude::*;

/// Solve for the best move sequence given the current game state.
///
/// Returns a Vec<u8> of move opcodes:
///   0=Left, 1=Right, 2=RotateCW, 3=RotateCCW, 4=HardDrop, 5=Hold, 6=SoftDrop
///
/// `target_fill_ratio` controls when the AI transitions from stacking to scoring.
/// 0.75 means the AI stacks to ~75% average fill before prioritizing line clears.
///
/// `strategy` selects the AI personality: 0=Flat, 1=ThreeTower.
#[wasm_bindgen]
pub fn solve(
    board_cells: &[u8],
    width: u32,
    height: u32,
    current_type: u8,
    _current_rotation: u8,
    current_row: i32,
    _current_col: i32,
    hold: i8,
    can_hold: bool,
    next_queue: &[u8],
    target_fill_ratio: f64,
    strategy: u8,
) -> Vec<u8> {
    let hold_type = if hold < 0 { 0u8 } else { hold as u8 };
    let strat = strategy::Strategy::from_u8(strategy);

    let result = solver::solve(
        board_cells,
        width,
        height,
        current_type,
        hold_type,
        can_hold,
        next_queue,
        target_fill_ratio,
        strat,
    );

    match result {
        Some(r) => {
            // Calculate spawn column for the piece being placed
            let placed_type = r.placement.piece_type;
            let shape = pieces::get_shape(placed_type, 0);
            let cols: Vec<i8> = shape.iter().map(|&(_, c)| c).collect();
            let piece_width = cols.iter().max().unwrap() - cols.iter().min().unwrap() + 1;
            let spawn_col = (width as i32 - piece_width as i32) / 2;

            // spawn_row is the current piece row (where the bot starts executing from)
            let spawn_row = current_row;

            moves::generate_moves(&r.placement, spawn_col, 0, spawn_row, r.use_hold)
        }
        None => vec![moves::SOFT_DROP], // fallback: just drop one row
    }
}
