use rand::SeedableRng;
use rand::rngs::SmallRng;
use std::time::Instant;
use tetris_solver::bag::BagRandomizer;
use tetris_solver::params::{FlatParams, FourWideParams, SolverParams};
use tetris_solver::strategy::Strategy;
use tetris_solver::{board, movegen, solver_param};

fn main() {
    // Browser-like board: 1920x1080 -> 71 cols x 40 rows, breadth 4
    let (w, h) = (71u32, 40u32);
    let sp = SolverParams { lookahead_breadth: 4.0, ..Default::default() };
    let fp = FlatParams::default();
    let fwp = FourWideParams::default();

    // Play a game to get realistic mid-game boards
    let mut rng = SmallRng::seed_from_u64(7);
    let mut bag = BagRandomizer::new(&mut rng);
    let mut cells = vec![0u8; (w * h) as usize];
    let mut boards: Vec<(Vec<u8>, u8)> = Vec::new();
    for _ in 0..120 {
        let cur = bag.next_piece(&mut rng);
        let queue = bag.peek_queue(5);
        boards.push((cells.clone(), cur));
        let Some(r) = solver_param::solve_param(&cells, w, h, cur, 0, true, &queue, 0.6,
            Strategy::Flat, &sp, &fp, &fwp) else { break };
        let p = &r.placement;
        let (nc, _) = board::simulate_place(&cells, w, h, p.piece_type, p.rotation, p.landing_row, p.col);
        cells = nc;
    }
    let n = boards.len();
    println!("captured {} board states", n);

    // Phase timings over all captured states
    let t = Instant::now();
    for (b, piece) in &boards {
        let _ = movegen::find_placements(b, w, h, *piece);
    }
    println!("movegen full-width:      {:>7.1}ms total, {:.2}ms/solve", t.elapsed().as_secs_f64()*1e3, t.elapsed().as_secs_f64()*1e3/n as f64);

    let (ws, we) = board::well_column_range(w);
    let t = Instant::now();
    for (b, _) in &boards {
        let _ = board::compute_all_metrics(b, w, h, ws, we);
    }
    println!("compute_all_metrics x1:  {:>7.1}ms total, {:.3}ms/call", t.elapsed().as_secs_f64()*1e3, t.elapsed().as_secs_f64()*1e3/n as f64);

    // Full solve via the WASM entry path (solve_param, the slow path)
    let t = Instant::now();
    for (b, piece) in &boards {
        let queue = [3u8, 4, 1];
        let _ = solver_param::solve_param(b, w, h, *piece, 0, true, &queue, 0.6,
            Strategy::Flat, &sp, &fp, &fwp);
    }
    println!("solve_param (slow/wasm): {:>7.1}ms total, {:.2}ms/solve", t.elapsed().as_secs_f64()*1e3, t.elapsed().as_secs_f64()*1e3/n as f64);

    // Same via the fast path
    let t = Instant::now();
    for (b, piece) in &boards {
        let queue = [3u8, 4, 1];
        let mut buf = b.clone();
        let _ = solver_param::solve_param_fast(&mut buf, w, h, *piece, 0, true, &queue, 0.6,
            Strategy::Flat, &sp, &fp, &fwp, None);
    }
    println!("solve_param_fast:        {:>7.1}ms total, {:.2}ms/solve", t.elapsed().as_secs_f64()*1e3, t.elapsed().as_secs_f64()*1e3/n as f64);

    // Breadth 0 comparison (lookahead share)
    let sp0 = SolverParams { lookahead_breadth: 0.0, ..Default::default() };
    let t = Instant::now();
    for (b, piece) in &boards {
        let queue = [3u8, 4, 1];
        let _ = solver_param::solve_param(b, w, h, *piece, 0, true, &queue, 0.6,
            Strategy::Flat, &sp0, &fp, &fwp);
    }
    println!("solve_param breadth 0:   {:>7.1}ms total, {:.2}ms/solve", t.elapsed().as_secs_f64()*1e3, t.elapsed().as_secs_f64()*1e3/n as f64);
}
