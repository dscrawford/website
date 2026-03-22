pub mod pieces;
pub mod board;
pub mod placement;
pub mod evaluator;
pub mod solver;
pub mod moves;

use wasm_bindgen::prelude::*;

/// Solve for the best move sequence given the current game state.
///
/// Returns a Vec<u8> of move opcodes:
///   0=Left, 1=Right, 2=RotateCW, 3=RotateCCW, 4=HardDrop, 5=Hold
///
/// `target_fill_ratio` controls when the AI transitions from stacking to scoring.
/// 0.75 means the AI stacks to ~75% average fill before prioritizing line clears.
#[wasm_bindgen]
pub fn solve(
    board_cells: &[u8],
    width: u32,
    height: u32,
    current_type: u8,
    _current_rotation: u8,
    _current_row: i32,
    _current_col: i32,
    hold: i8,
    can_hold: bool,
    next_queue: &[u8],
    target_fill_ratio: f64,
) -> Vec<u8> {
    let hold_type = if hold < 0 { 0u8 } else { hold as u8 };

    let result = solver::solve(
        board_cells,
        width,
        height,
        current_type,
        hold_type,
        can_hold,
        next_queue,
        target_fill_ratio,
    );

    match result {
        Some(r) => {
            // Calculate spawn column for the piece being placed
            let placed_type = r.placement.piece_type;
            let shape = pieces::get_shape(placed_type, 0);
            let cols: Vec<i8> = shape.iter().map(|&(_, c)| c).collect();
            let piece_width = cols.iter().max().unwrap() - cols.iter().min().unwrap() + 1;
            let spawn_col = (width as i32 - piece_width as i32) / 2;

            moves::generate_moves(&r.placement, spawn_col, 0, r.use_hold)
        }
        None => vec![moves::HARD_DROP], // fallback: just drop
    }
}
