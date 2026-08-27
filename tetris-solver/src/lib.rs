pub mod pieces;
pub mod board;
pub mod movegen;
pub mod placement;
pub mod scorer;
pub mod params;
pub mod evaluator_param;
pub mod evaluator;
pub mod solver_param;
pub mod solver;
pub mod moves;
pub mod strategy;

#[cfg(feature = "evolve")]
pub mod bag;
#[cfg(feature = "evolve")]
pub mod game_runner;
#[cfg(feature = "evolve")]
pub mod evolve;

use wasm_bindgen::prelude::*;

/// Solve for the best move sequence given the current game state.
///
/// Returns a Vec<u8> of move opcodes:
///   0=Left, 1=Right, 2=RotateCW, 3=RotateCCW, 4=HardDrop, 5=Hold, 6=SoftDrop
///
/// `target_fill_ratio` controls when the AI transitions from stacking to scoring.
/// 0.75 means the AI stacks to ~75% average fill before prioritizing line clears.
///
/// `strategy` selects the AI personality: 0=Flat, 1=FourWide.
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
    strategy: u8,
) -> Vec<u8> {
    // Validate untrusted JS inputs: out-of-range piece types index into
    // PIECE_SHAPES, and mismatched cell buffers index out of bounds — both
    // would trap the module.
    const MAX_BOARD_CELLS: usize = 1 << 20;
    let valid_piece = |t: u8| (1..=7).contains(&t);
    if !valid_piece(current_type)
        || width == 0
        || height == 0
        || !target_fill_ratio.is_finite()
        || !(0.0..=1.0).contains(&target_fill_ratio)
        || (width as usize).saturating_mul(height as usize) != board_cells.len()
        || board_cells.len() > MAX_BOARD_CELLS
    {
        return vec![moves::SOFT_DROP];
    }
    let hold_type = if (1..=7).contains(&hold) { hold as u8 } else { 0u8 };
    let queue: Vec<u8> = next_queue.iter().copied().filter(|&t| valid_piece(t)).collect();
    let strat = strategy::Strategy::from_u8(strategy);

    let mut sp = params::SolverParams::default();
    sp.lookahead_breadth =
        scaled_lookahead_breadth((width * height) as usize, sp.lookahead_breadth);

    let result = solver_param::solve_param(
        board_cells,
        width,
        height,
        current_type,
        hold_type,
        can_hold,
        &queue,
        target_fill_ratio,
        strat,
        &sp,
        &params::FlatParams::default(),
        &params::FourWideParams::default(),
    );

    match result {
        // Path is computed from the spawn state; the JS side solves once per
        // piece right after spawn, so the piece is at spawn when this runs.
        Some(r) => moves::assemble_moves(&r.path, r.use_hold),
        None => vec![moves::SOFT_DROP], // fallback: just drop one row
    }
}

/// Scale lookahead breadth by board area to keep per-piece solve latency
/// bounded (~1ms at 10x20 up to ~31ms at 40x80 with full breadth).
pub(crate) fn scaled_lookahead_breadth(area: usize, base: f64) -> f64 {
    if area <= 1000 {
        base.min(8.0)
    } else if area <= 3600 {
        4.0
    } else {
        2.0
    }
}

#[cfg(test)]
mod tests {
    use super::scaled_lookahead_breadth;

    #[test]
    fn breadth_scaling_boundaries() {
        for (area, expected) in [
            (999, 8.0),
            (1000, 8.0),
            (1001, 4.0),
            (3599, 4.0),
            (3600, 4.0),
            (3601, 2.0),
            (80_000, 2.0),
        ] {
            assert_eq!(scaled_lookahead_breadth(area, 8.0), expected, "area {}", area);
        }
        // Promoted genomes with huge breadth stay capped on small boards
        assert_eq!(scaled_lookahead_breadth(200, 40.0), 8.0);
    }
}
