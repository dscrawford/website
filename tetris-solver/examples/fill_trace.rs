// Reproduces the browser's STACK/SCORE hysteresis loop headlessly to study
// where fill equilibrates under each fill definition.
use rand::rngs::StdRng;
use rand::SeedableRng;
use tetris_solver::bag::BagRandomizer;
use tetris_solver::board;
use tetris_solver::evaluator_param::well_exempt_fill;
use tetris_solver::params::{FlatParams, FourWideParams, SolverParams};
use tetris_solver::solver_param;
use tetris_solver::strategy::Strategy;

const STACK_TARGET: f64 = 0.75;
const STACK_FLIP: f64 = 0.70;
const SCORE_TARGET: f64 = 0.10;

fn cell_fill(cells: &[u8]) -> f64 {
    cells.iter().filter(|&&c| c != 0).count() as f64 / cells.len() as f64
}

fn run(width: u32, height: u32, pieces: u32, js_uses_solver_fill: bool, seed: u64) {
    let sp = SolverParams::default();
    let fp = FlatParams::default();
    let fwp = FourWideParams::default();
    let mut rng = StdRng::seed_from_u64(seed);
    let mut cells = vec![0u8; (width * height) as usize];
    let mut bag = BagRandomizer::new(&mut rng);
    let mut hold: u8 = 0;
    let mut can_hold = true;
    let mut scoring = false;
    let mut score_phases = 0u32;
    let mut max_cell_fill: f64 = 0.0;
    let mut max_solver_fill: f64 = 0.0;

    for i in 0..pieces {
        let (ws, we) = board::well_column_range(width);
        let m = board::compute_all_metrics(&cells, width, height, ws, we);
        let sfill = well_exempt_fill(&m, width, height);
        let cfill = cell_fill(&cells);
        max_cell_fill = max_cell_fill.max(cfill);
        max_solver_fill = max_solver_fill.max(sfill);

        let hys_fill = if js_uses_solver_fill { sfill } else { cfill };
        if !scoring && hys_fill >= STACK_FLIP {
            scoring = true;
            score_phases += 1;
        } else if scoring && hys_fill <= SCORE_TARGET {
            scoring = false;
        }
        let target = if scoring { SCORE_TARGET } else { STACK_TARGET };

        if i % 100 == 0 {
            println!(
                "piece {i:5}  cell_fill {:5.1}%  solver_fill {:5.1}%  mode {}",
                cfill * 100.0,
                sfill * 100.0,
                if scoring { "SCORE" } else { "STACK" }
            );
        }

        let current = bag.next_piece(&mut rng);
        let queue = bag.peek_queue(5);
        let result = solver_param::solve_param_fast(
            &mut cells, width, height, current, hold, can_hold, &queue,
            target, Strategy::Flat, &sp, &fp, &fwp, None,
        );
        let result = match result {
            Some(r) => r,
            None => {
                println!("GAME OVER at piece {i}");
                break;
            }
        };
        if result.use_hold {
            hold = current;
            can_hold = false;
        } else {
            can_hold = true;
        }
        let p = &result.placement;
        let (new_cells, _cleared) =
            board::simulate_place(&cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col);
        cells = new_cells;
        if cells[..width as usize].iter().any(|&c| c != 0) {
            println!("TOPOUT at piece {i}");
            break;
        }
    }
    println!(
        "== {}x{} hysteresis_on={}  max_cell_fill {:.1}%  max_solver_fill {:.1}%  score_phases {}",
        width,
        height,
        if js_uses_solver_fill { "solver_fill" } else { "cell_fill" },
        max_cell_fill * 100.0,
        max_solver_fill * 100.0,
        score_phases
    );
}

fn main() {
    for &(w, h, pieces) in &[(10u32, 20u32, 600u32), (71, 40, 3000)] {
        run(w, h, pieces, false, 42);
        run(w, h, pieces, true, 42);
        println!();
    }
}
