// Headless sweep of the browser's STACK/SCORE hysteresis loop across the
// board sizes real viewports produce, to check the solver behaves the same
// on a phone (narrow) as on a widescreen (wide).
use rand::rngs::StdRng;
use rand::SeedableRng;
use tetris_solver::bag::BagRandomizer;
use tetris_solver::board;
use tetris_solver::evaluator_param::well_exempt_fill;
use tetris_solver::params::{FlatParams, FourWideParams, SolverParams};
use tetris_solver::solver_param;
use tetris_solver::strategy::Strategy;

const BASE_STACK_TARGET: f64 = 0.75;
const FLIP_MARGIN: f64 = 0.05;
const SCORE_TARGET: f64 = 0.10;

/// Mirrors stackTargetFor in src/hooks/useAutoSolver.js.
fn stack_target(width: u32) -> f64 {
    let cols = width.saturating_sub(1).max(1) as f64;
    BASE_STACK_TARGET.min(0.45 + 0.02 * cols)
}

struct Stats {
    pieces: u32,
    topout_at: Option<u32>,
    lines: u32,
    max_fill: f64,
    avg_fill: f64,
    avg_holes: f64,
    avg_bump: f64,
    max_col_h: u32,
    score_phases: u32,
    score_pieces: u32,
    holes_at_flip: f64,
    topout_in_score: bool,
    holes_end: u32,
}

fn run(width: u32, height: u32, pieces: u32, strategy: Strategy, seed: u64) -> Stats {
    let sp = SolverParams::default();
    let fp = FlatParams::default();
    let fwp = FourWideParams::default();
    let mut rng = StdRng::seed_from_u64(seed);
    let mut cells = vec![0u8; (width * height) as usize];
    let mut bag = BagRandomizer::new(&mut rng);
    let mut hold: u8 = 0;
    let mut can_hold = true;
    let mut scoring = false;

    let mut st = Stats {
        pieces: 0, topout_at: None, lines: 0, max_fill: 0.0, avg_fill: 0.0,
        avg_holes: 0.0, avg_bump: 0.0, max_col_h: 0, score_phases: 0,
        score_pieces: 0, holes_at_flip: 0.0, topout_in_score: false, holes_end: 0,
    };
    let (ws, we) = board::well_column_range(width);

    for i in 0..pieces {
        let m = board::compute_all_metrics(&cells, width, height, ws, we);
        let fill = well_exempt_fill(&m, width, height);
        st.max_fill = st.max_fill.max(fill);
        st.avg_fill += fill;
        st.avg_holes += m.holes as f64;
        st.avg_bump += m.bumpiness as f64 / (width.max(2) - 1) as f64;
        let tallest = col_heights(&cells, width, height).into_iter().max().unwrap_or(0);
        st.max_col_h = st.max_col_h.max(tallest);

        if !scoring && fill >= stack_target(width) - FLIP_MARGIN {
            scoring = true;
            st.score_phases += 1;
            st.holes_at_flip += m.holes as f64;
        } else if scoring && fill <= SCORE_TARGET {
            scoring = false;
        }
        if scoring { st.score_pieces += 1; }
        st.holes_end = m.holes;
        let target = if scoring { SCORE_TARGET } else { stack_target(width) };

        let current = bag.next_piece(&mut rng);
        let queue = bag.peek_queue(5);
        let result = solver_param::solve_param_fast(
            &mut cells, width, height, current, hold, can_hold, &queue,
            target, strategy, &sp, &fp, &fwp, None,
        );
        let result = match result {
            Some(r) => r,
            None => { st.topout_at = Some(i); st.topout_in_score = scoring; break; }
        };
        if result.use_hold { hold = current; can_hold = false; } else { can_hold = true; }
        let p = &result.placement;
        let (new_cells, cleared) =
            board::simulate_place(&cells, width, height, p.piece_type, p.rotation, p.landing_row, p.col);
        cells = new_cells;
        st.lines += cleared;
        st.pieces = i + 1;
        if cells[..width as usize].iter().any(|&c| c != 0) {
            st.topout_at = Some(i);
            st.topout_in_score = scoring;
            break;
        }
    }
    let n = st.pieces.max(1) as f64;
    st.avg_fill /= n;
    st.avg_holes /= n;
    st.avg_bump /= n;
    st
}

fn col_heights(cells: &[u8], width: u32, height: u32) -> Vec<u32> {
    (0..width).map(|c| {
        (0..height).find(|&r| cells[(r * width + c) as usize] != 0)
            .map(|r| height - r).unwrap_or(0)
    }).collect()
}

fn grid() {
    println!("{:<10} {:>6} {:>7} {:>7} {:>6} {:>7} {:>8} {:>10} {:>9}", "board", "topout", "pieces", "maxfill", "holes", "bump/col", "scoreph", "score_pcs", "die_score");
    let dims: Vec<(u32,u32)> = vec![
        (10,20),(10,40),(12,40),(14,40),(18,40),(23,40),(28,40),(45,40),(71,40),(93,40),
        (18,20),(30,20),(71,20),(18,80),
    ];
    for (w,h) in dims {
        let mut topouts=0; let (mut tp, mut tmax, mut tavg, mut th, mut tb)=(0u32,0.0,0.0,0.0,0.0);
        let (mut tsp, mut tspc, mut tdie)=(0u32,0u32,0u32);
        let nseeds: u64 = std::env::var("SEEDS").ok().and_then(|v| v.parse().ok()).unwrap_or(3);
        let seeds: Vec<u64> = (1..=nseeds).collect();
        let pieces: u32 = std::env::var("PIECES").ok().and_then(|v| v.parse().ok()).unwrap_or(1500);
        for &seed in &seeds {
            let st = run(w,h,pieces,Strategy::Flat,seed);
            if st.topout_at.is_some() { topouts+=1; }
            tp+=st.pieces; tmax+=st.max_fill; tavg+=st.avg_fill; th+=st.avg_holes; tb+=st.avg_bump;
            tsp+=st.score_phases; tspc+=st.score_pieces; if st.topout_in_score { tdie+=1; }
        }
        let ns = seeds.len() as u32;
        let n = ns as f64;
        let _ = tavg;
        println!("{:<10} {:>6} {:>7} {:>6.1}% {:>6.1} {:>7.2} {:>8} {:>10} {:>9}",
            format!("{}x{}",w,h), format!("{}/{}",topouts,ns), tp/ns, tmax/n*100.0, th/n, tb/n, tsp/ns, tspc/ns, tdie);
    }
}

fn main() {
    if std::env::args().any(|a| a == "--grid") { grid(); return; }
    // (label, viewport) -> board dims via calculateBoardDimensions:
    // cell = floor(vh / 40), width = clamp(floor(vw / cell), 10, 999)
    let viewports: &[(&str, u32, u32)] = &[
        ("iPhone SE portrait", 375, 667),
        ("iPhone 14 portrait", 390, 844),
        ("Pixel 7 portrait", 412, 915),
        ("iPhone 14 landscape", 844, 390),
        ("iPad portrait", 820, 1180),
        ("iPad landscape", 1180, 820),
        ("Laptop 1366x768", 1366, 768),
        ("Widescreen 1920x1080", 1920, 1080),
        ("QHD 2560x1440", 2560, 1440),
        ("Ultrawide 3440x1440", 3440, 1440),
    ];
    let pieces: u32 = std::env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(1500);
    let seeds: Vec<u64> = vec![1, 2, 3];

    println!("{:<22} {:>9} {:>6} {:>7} {:>7} {:>7} {:>6} {:>7} {:>6}",
        "viewport", "board", "topout", "pieces", "maxfill", "avgfill", "holes", "bump/col", "maxh%");
    for &(label, vw, vh) in viewports {
        let cell = (vh / 40).max(1);
        let w = (vw / cell).clamp(10, 999);
        let h = 40;
        let mut topouts = 0;
        let (mut tp, mut tl, mut tmax, mut tavg, mut th, mut tb, mut tmh) = (0u32, 0u32, 0.0, 0.0, 0.0, 0.0, 0u32);
        for &seed in &seeds {
            let st = run(w, h, pieces, Strategy::Flat, seed);
            if st.topout_at.is_some() { topouts += 1; }
            tp += st.pieces; tl += st.lines;
            tmax += st.max_fill; tavg += st.avg_fill; th += st.avg_holes; tb += st.avg_bump;
            tmh = tmh.max(st.max_col_h);
        }
        let n = seeds.len() as f64;
        println!("{:<22} {:>9} {:>6} {:>7} {:>6.1}% {:>6.1}% {:>6.1} {:>7.2} {:>5.0}%",
            label, format!("{}x{}", w, h), format!("{}/{}", topouts, seeds.len()),
            tp / seeds.len() as u32, tmax / n * 100.0, tavg / n * 100.0,
            th / n, tb / n, tmh as f64 / h as f64 * 100.0);
        let _ = tl;
    }
}
