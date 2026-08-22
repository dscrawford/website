use crate::board;
use crate::movegen::{SPIN_FULL, SPIN_NONE};
use crate::params::{FlatParams, FourWideParams};
use crate::pieces;
use crate::strategy::Strategy;

/// Play mode for the Flat strategy, derived once from the PRE-placement
/// board so every candidate placement is scored in the same branch — deriving
/// it per-candidate lets placements shop for the branch with gentler scales
/// (e.g. creating a cavity to be judged by Dig's discounted landing height).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AiMode {
    Stack,
    Dig,
    Score,
}

/// Fill excludes the well column (lowest) and normalizes over width-1
/// columns: keeping a deep well reads as progress toward target. The burial
/// loophole this opens is closed by the solver-level contamination penalty.
pub fn well_exempt_fill(m: &board::BoardMetrics, width: u32, height: u32) -> f64 {
    let cols_ex = width.saturating_sub(1).max(1) as f64;
    (m.aggregate_height.saturating_sub(m.well_col_height) as f64 / (cols_ex * height as f64))
        .min(1.0)
}

pub fn derive_mode(m: &board::BoardMetrics, width: u32, height: u32, target_fill: f64) -> AiMode {
    if m.cavities > 0 || m.top_quarter_cells > 0 {
        AiMode::Dig
    } else if well_exempt_fill(m, width, height) >= target_fill {
        AiMode::Score
    } else {
        AiMode::Stack
    }
}

/// Evaluate a board state after placement; computes metrics then delegates to
/// evaluate_fast so both paths share one implementation. `eroded` is
/// Dellacherie's eroded-piece-cells (lines cleared x piece cells in them).
#[allow(clippy::too_many_arguments)]
pub fn evaluate(
    cells: &[u8],
    width: u32,
    height: u32,
    lines_cleared: u32,
    eroded: u32,
    spin: u8,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    _scoring_urgency: f64,
    target_fill: f64,
    strategy: Strategy,
    flat_params: &FlatParams,
    fw_params: &FourWideParams,
) -> f64 {
    let (well_start, well_end) = board::well_column_range(width);
    let metrics = board::compute_all_metrics(cells, width, height, well_start, well_end);
    // No pre-placement board here: mode falls back to the post-board state
    let mode = derive_mode(&metrics, width, height, target_fill);
    evaluate_fast(
        &metrics, width, height, lines_cleared, eroded, spin, mode, landing_row,
        piece_type, rotation, target_fill, strategy, flat_params, fw_params,
    )
}

/// Evaluate using pre-computed BoardMetrics — avoids redundant board scans.
#[allow(clippy::too_many_arguments)]
pub fn evaluate_fast(
    metrics: &board::BoardMetrics,
    width: u32,
    height: u32,
    lines_cleared: u32,
    eroded: u32,
    spin: u8,
    mode: AiMode,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    target_fill: f64,
    strategy: Strategy,
    flat_params: &FlatParams,
    fw_params: &FourWideParams,
) -> f64 {
    match strategy {
        Strategy::Flat => evaluate_flat_fast(
            metrics, width, height, lines_cleared, eroded, spin, mode, landing_row,
            piece_type, rotation, target_fill, flat_params,
        ),
        Strategy::FourWide => evaluate_fw_fast(
            metrics, width, height, lines_cleared, eroded, landing_row,
            piece_type, rotation, target_fill, fw_params,
        ),
    }
}

fn evaluate_flat_fast(
    m: &board::BoardMetrics,
    width: u32,
    height: u32,
    lines_cleared: u32,
    eroded: u32,
    spin: u8,
    mode: AiMode,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    target_fill: f64,
    p: &FlatParams,
) -> f64 {
    let landing_height = compute_landing_height(height, landing_row, piece_type, rotation);

    let fill = well_exempt_fill(m, width, height);
    let deviation = (fill - target_fill).abs();
    let target_penalty = p.w_height_gap * deviation * deviation;

    let digging = mode == AiMode::Dig;
    let scoring = mode == AiMode::Score;

    let row_trans = m.row_transitions as f64;
    let col_trans = m.column_transitions as f64;
    let holes = m.holes as f64;
    let covered = m.covered_cells as f64;
    let wells = m.well_sums as f64;

    // Eroded rewards efficient burns while stacking/digging; in Score mode
    // the per-size clear pricing governs and eroded would double-pay burns
    let eroded_term = if scoring { 0.0 } else { p.w_eroded * eroded as f64 };

    let surface = p.w_bumpiness * m.bumpiness as f64
        + p.w_bumpiness_sq * m.bumpiness_sq as f64
        + p.w_cavities * m.cavities as f64
        + p.w_overhangs * m.overhangs as f64
        + p.w_rows_with_holes * m.rows_with_holes as f64
        + p.w_notches * m.notches as f64
        + p.w_top_half * m.top_half_cells as f64
        + p.w_top_quarter * m.top_quarter_cells as f64
        + eroded_term;

    let well = p.w_well_depth * m.well_depth as f64
        + p.w_covered_well * m.covered_well as f64
        + if m.well_depth >= 4 && m.covered_well == 0 {
            p.w_tetris_ready
        } else {
            0.0
        };

    let spin_term = if piece_type == pieces::T {
        if spin != SPIN_NONE && lines_cleared > 0 {
            let scale = if spin == SPIN_FULL { 1.0 } else { 0.3 };
            p.w_tspin_clear * lines_cleared as f64 * scale
        } else {
            p.w_wasted_t
        }
    } else {
        0.0
    };

    let clear_term = if digging {
        p.w_dig_clear * lines_cleared as f64
    } else if scoring {
        match lines_cleared {
            0 => 0.0,
            1 => p.w_clear1,
            2 => p.w_clear2,
            3 => p.w_clear3,
            _ => p.w_clear4,
        }
    } else {
        p.w_stacking_rows * lines_cleared as f64
    };

    let extras = surface + well + spin_term + clear_term + target_penalty;

    if scoring && !digging {
        landing_height * p.w_landing_height
            + p.w_row_transitions * row_trans * p.scoring_row_trans_scale
            + p.w_column_transitions * col_trans * p.scoring_col_trans_scale
            + p.w_holes * holes * p.scoring_holes_scale
            + p.w_covered_cells * covered * p.scoring_covered_scale
            + p.w_well_sums * wells * p.scoring_wells_scale
            + extras
    } else {
        let landing_weight = p.w_landing_height * p.stacking_landing_scale;
        landing_weight * landing_height
            + p.w_row_transitions * row_trans
            + p.w_column_transitions * col_trans
            + p.w_holes * holes
            + p.w_covered_cells * covered
            + p.w_well_sums * wells
            + extras
    }
}

fn evaluate_fw_fast(
    m: &board::BoardMetrics,
    width: u32,
    height: u32,
    lines_cleared: u32,
    eroded: u32,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    target_fill: f64,
    p: &FourWideParams,
) -> f64 {
    let landing_height = compute_landing_height(height, landing_row, piece_type, rotation);

    let (well_start, well_end) = board::well_column_range(width);
    let well_area = (well_end - well_start + 1) * height;
    let well_clean_ratio = 1.0 - (m.well_fill_count as f64 / well_area as f64);

    let balance_penalty = (m.left_tower_avg_height - m.right_tower_avg_height).abs();
    let avg_fill = m.aggregate_height as f64 / (width as f64 * height as f64);
    let below_target = avg_fill < target_fill;
    let deviation = (avg_fill - target_fill).abs();
    let target_penalty = p.fw_height_gap * deviation * deviation;

    let holes = m.holes as f64;
    let covered = m.covered_cells as f64;
    let col_trans = m.column_transitions as f64;
    let row_trans = m.row_transitions as f64;
    let wells = m.well_sums as f64;

    let surface = p.fw_bumpiness * m.bumpiness as f64
        + p.fw_bumpiness_sq * m.bumpiness_sq as f64
        + p.fw_cavities * m.cavities as f64
        + p.fw_overhangs * m.overhangs as f64
        + p.fw_rows_with_holes * m.rows_with_holes as f64
        + p.fw_notches * m.notches as f64
        + p.fw_top_half * m.top_half_cells as f64
        + p.fw_top_quarter * m.top_quarter_cells as f64
        + p.fw_eroded * eroded as f64;

    if below_target {
        p.fw_landing_height * p.fw_stacking_landing_scale * landing_height
            + p.fw_well_cleanliness * well_clean_ratio
            + p.fw_holes * holes
            + p.fw_covered_cells * covered
            + p.fw_column_transitions * col_trans
            + p.fw_row_transitions * row_trans
            + p.fw_well_sums * wells
            + p.fw_tower_balance * balance_penalty
            + p.fw_rows_stacking * lines_cleared as f64
            + surface
            + target_penalty
    } else {
        p.fw_landing_height * landing_height
            + p.fw_well_cleanliness * well_clean_ratio * p.fw_scoring_well_clean_scale
            + p.fw_holes * holes * p.fw_scoring_holes_scale
            + p.fw_covered_cells * covered * p.fw_scoring_covered_scale
            + p.fw_column_transitions * col_trans * p.fw_scoring_col_trans_scale
            + p.fw_row_transitions * row_trans * p.fw_scoring_row_trans_scale
            + p.fw_well_sums * wells * p.fw_scoring_wells_scale
            + p.fw_tower_balance * balance_penalty * p.fw_scoring_balance_scale
            + p.fw_rows_scoring * lines_cleared as f64
            + surface
            + target_penalty
    }
}

/// Compute landing height as the midpoint of the piece's vertical extent,
/// converted from row-index (0=top) to height (0=bottom).
pub fn compute_landing_height(height: u32, landing_row: i32, piece_type: u8, rotation: u8) -> f64 {
    let shape = pieces::get_shape(piece_type, rotation);
    let rows: Vec<i32> = shape.iter().map(|&(dr, _)| landing_row + dr as i32).collect();
    let min_row = *rows.iter().min().unwrap() as f64;
    let max_row = *rows.iter().max().unwrap() as f64;
    let h = height as f64;
    h - (min_row + max_row) / 2.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pieces::{EMPTY, I, T};

    fn empty_board(width: u32, height: u32) -> Vec<u8> {
        vec![EMPTY; (width * height) as usize]
    }

    fn set(cells: &mut [u8], row: u32, col: u32) {
        cells[(row * 10 + col) as usize] = I;
    }

    fn eval_flat(cells: &[u8], width: u32, height: u32) -> f64 {
        evaluate(
            cells, width, height, 0, 0, 0, (height - 2) as i32, T, 0, 0.0, 0.75,
            Strategy::Flat, &FlatParams::default(), &FourWideParams::default(),
        )
    }

    #[test]
    fn slow_path_equals_fast_path() {
        let mut cells = empty_board(10, 20);
        for c in 0..7 {
            set(&mut cells, 19, c);
        }
        set(&mut cells, 18, 2);
        set(&mut cells, 16, 5);

        let (ws, we) = board::well_column_range(10);
        let m = board::compute_all_metrics(&cells, 10, 20, ws, we);
        let slow = evaluate(
            &cells, 10, 20, 1, 4, 0, 17, T, 2, 0.0, 0.75,
            Strategy::Flat, &FlatParams::default(), &FourWideParams::default(),
        );
        let fast = evaluate_fast(
            &m, 10, 20, 1, 4, 0, derive_mode(&m, 10, 20, 0.75), 17, T, 2, 0.75,
            Strategy::Flat, &FlatParams::default(), &FourWideParams::default(),
        );
        assert_eq!(slow, fast);
    }

    #[test]
    fn cavity_vs_overhang_classification() {
        // Hole at (18,4) under a roof at (17,4), with (19,4) filled.
        // Sealed variant: tall columns both sides -> cavity.
        let mut cavity = empty_board(10, 20);
        for c in [3, 5] {
            for r in 17..20 {
                set(&mut cavity, r, c);
            }
        }
        set(&mut cavity, 17, 4);
        set(&mut cavity, 19, 4);

        // Reachable variant: right side open (col 5 empty, col 6 low) -> a
        // piece can be tucked in from the right.
        let mut overhang = empty_board(10, 20);
        for r in 17..20 {
            set(&mut overhang, r, 3);
        }
        set(&mut overhang, 17, 4);
        set(&mut overhang, 19, 4);
        set(&mut overhang, 19, 6);

        let (ws, we) = board::well_column_range(10);
        let mc = board::compute_all_metrics(&cavity, 10, 20, ws, we);
        assert_eq!((mc.cavities, mc.overhangs), (1, 0), "sealed hole must be a cavity");

        let mo = board::compute_all_metrics(&overhang, 10, 20, ws, we);
        assert_eq!((mo.cavities, mo.overhangs), (0, 1), "reachable hole must be an overhang");
    }

    #[test]
    fn notch_weighted_negative_at_default_weights() {
        // Metrics literals isolate the notch term from fill/well confounds
        let p = FlatParams::default();
        let fw = FourWideParams::default();
        for strategy in [Strategy::Flat, Strategy::FourWide] {
            let notch_m = board::BoardMetrics { notches: 1, ..Default::default() };
            let flat_m = board::BoardMetrics::default();
            let notch_score =
                evaluate_fast(&notch_m, 10, 20, 0, 0, 0, AiMode::Stack, 18, I, 0, 0.75, strategy, &p, &fw);
            let flat_score =
                evaluate_fast(&flat_m, 10, 20, 0, 0, 0, AiMode::Stack, 18, I, 0, 0.75, strategy, &p, &fw);
            assert!(
                notch_score < flat_score,
                "strategy {:?}: an I-dependency notch must cost",
                strategy
            );
        }
    }

    #[test]
    fn eroded_cells_reward_clearing_while_stacking() {
        // Eroded applies in Stack/Dig modes; Score mode's clear pricing
        // replaces it (target 0.75 on an empty board -> Stack)
        let cells = empty_board(10, 20);
        let base = evaluate(
            &cells, 10, 20, 1, 0, 0, 18, I, 0, 0.0, 0.75,
            Strategy::Flat, &FlatParams::default(), &FourWideParams::default(),
        );
        let with_eroded = evaluate(
            &cells, 10, 20, 1, 4, 0, 18, I, 0, 0.0, 0.75,
            Strategy::Flat, &FlatParams::default(), &FourWideParams::default(),
        );
        assert!(with_eroded > base);
    }

    #[test]
    fn eroded_cells_reward_clearing_four_wide() {
        let cells = empty_board(10, 20);
        let base = evaluate(
            &cells, 10, 20, 1, 0, 0, 18, I, 0, 0.0, 0.0,
            Strategy::FourWide, &FlatParams::default(), &FourWideParams::default(),
        );
        let with_eroded = evaluate(
            &cells, 10, 20, 1, 4, 0, 18, I, 0, 0.0, 0.0,
            Strategy::FourWide, &FlatParams::default(), &FourWideParams::default(),
        );
        assert!(with_eroded > base);
    }

    #[test]
    fn cavities_weighted_worse_than_overhangs_at_default_weights() {
        // Metrics literals isolate the surface term from board-construction
        // confounds; locks in the cavity >> overhang design intent
        let p = FlatParams::default();
        let fw = FourWideParams::default();
        for strategy in [Strategy::Flat, Strategy::FourWide] {
            let cavity_m = board::BoardMetrics { holes: 1, cavities: 1, ..Default::default() };
            let overhang_m = board::BoardMetrics { holes: 1, overhangs: 1, ..Default::default() };
            let cavity_score =
                evaluate_fast(&cavity_m, 10, 20, 0, 0, 0, AiMode::Stack, 18, T, 0, 0.75, strategy, &p, &fw);
            let overhang_score =
                evaluate_fast(&overhang_m, 10, 20, 0, 0, 0, AiMode::Stack, 18, T, 0, 0.75, strategy, &p, &fw);
            assert!(
                cavity_score < overhang_score,
                "strategy {:?}: cavity must cost more than a tuckable overhang",
                strategy
            );
        }
    }

    #[test]
    fn slow_path_equals_fast_path_across_strategies_and_boards() {
        let mut ragged = empty_board(10, 20);
        let heights = [1u32, 4, 2, 6, 3, 5, 1, 7, 2, 4];
        for (c, &h) in heights.iter().enumerate() {
            for r in (20 - h)..20 {
                set(&mut ragged, r, c as u32);
            }
        }
        let mut dense = empty_board(10, 20);
        for r in 10..20u32 {
            for c in 0..10u32 {
                if !(r == 19 && c == 4) {
                    set(&mut dense, r, c);
                }
            }
        }

        let cases: Vec<(&str, Vec<u8>, u32, u32, i32, u8, u8)> = vec![
            ("empty", empty_board(10, 20), 0, 0, 18, I, 0),
            ("ragged", ragged, 2, 3, 5, I, 1),
            ("dense", dense, 1, 1, 0, T, 0),
        ];

        for strategy in [Strategy::Flat, Strategy::FourWide] {
            for (name, cells, lines, eroded, row, piece, rot) in &cases {
                let (ws, we) = board::well_column_range(10);
                let m = board::compute_all_metrics(cells, 10, 20, ws, we);
                let slow = evaluate(
                    cells, 10, 20, *lines, *eroded, 0, *row, *piece, *rot, 0.0, 0.75,
                    strategy, &FlatParams::default(), &FourWideParams::default(),
                );
                let fast = evaluate_fast(
                    &m, 10, 20, *lines, *eroded, 0, derive_mode(&m, 10, 20, 0.75), *row, *piece, *rot, 0.75,
                    strategy, &FlatParams::default(), &FourWideParams::default(),
                );
                assert_eq!(slow, fast, "case {} strategy {:?}", name, strategy);
            }
        }
    }

    #[test]
    fn landing_height_midpoint() {
        // T rot 0 at landing_row 18 on 20-high board: rows 18-19, midpoint 18.5
        let lh = compute_landing_height(20, 18, T, 0);
        assert_eq!(lh, 20.0 - 18.5);
    }

    // === derive_mode edge cases ===

    fn metrics_with(cavities: u32, top_quarter_cells: u32, agg: u32, well_h: u32) -> board::BoardMetrics {
        board::BoardMetrics {
            cavities,
            top_quarter_cells,
            aggregate_height: agg,
            well_col_height: well_h,
            ..Default::default()
        }
    }

    #[test]
    fn derive_mode_boundaries() {
        // Below target -> Stack; exact target (>=) -> Score
        assert_eq!(derive_mode(&metrics_with(0, 0, 0, 0), 10, 20, 0.75), AiMode::Stack);
        assert_eq!(derive_mode(&metrics_with(0, 0, 0, 0), 10, 20, 0.0), AiMode::Score);
        // cols_ex=9, denom=180: agg 90 -> fill 0.5 exactly
        assert_eq!(derive_mode(&metrics_with(0, 0, 90, 0), 10, 20, 0.5), AiMode::Score);
        assert_eq!(derive_mode(&metrics_with(0, 0, 89, 0), 10, 20, 0.5), AiMode::Stack);
    }

    #[test]
    fn derive_mode_dig_triggers() {
        assert_eq!(derive_mode(&metrics_with(1, 0, 180, 0), 10, 20, 0.5), AiMode::Dig);
        assert_eq!(derive_mode(&metrics_with(0, 1, 0, 0), 10, 20, 0.75), AiMode::Dig);
        assert_eq!(derive_mode(&metrics_with(3, 5, 180, 0), 10, 20, 0.0), AiMode::Dig);
    }

    #[test]
    fn derive_mode_well_exemption_affects_fill() {
        assert_eq!(derive_mode(&metrics_with(0, 0, 90, 0), 10, 20, 0.5), AiMode::Score);
        // (90-18)/180 = 0.4 < 0.5 -> Stack
        assert_eq!(derive_mode(&metrics_with(0, 0, 90, 18), 10, 20, 0.5), AiMode::Stack);
    }

    // === Spin pricing paths ===

    fn spin_score(spin: u8, lines: u32, piece: u8, mode: AiMode) -> f64 {
        let m = board::BoardMetrics::default();
        evaluate_fast(
            &m, 10, 20, lines, 0, spin, mode, 18, piece, 0, 0.75,
            Strategy::Flat, &FlatParams::default(), &FourWideParams::default(),
        )
    }

    #[test]
    fn full_tspin_clear_prices_higher_than_mini() {
        let p = FlatParams::default();
        let full = spin_score(SPIN_FULL, 1, T, AiMode::Stack);
        let mini = spin_score(crate::movegen::SPIN_MINI, 1, T, AiMode::Stack);
        assert!((full - mini - (p.w_tspin_clear * 0.7)).abs() < 1e-9);
    }

    #[test]
    fn spin_without_a_clear_is_wasted_t() {
        let spun = spin_score(SPIN_FULL, 0, T, AiMode::Stack);
        let plain = spin_score(SPIN_NONE, 0, T, AiMode::Stack);
        assert_eq!(spun, plain, "no-clear T prices identically regardless of spin");
    }

    #[test]
    fn non_t_pieces_ignore_spin_flag() {
        assert_eq!(
            spin_score(SPIN_FULL, 2, I, AiMode::Stack),
            spin_score(SPIN_NONE, 2, I, AiMode::Stack)
        );
    }

    // === Mode clear pricing ===

    #[test]
    fn dig_mode_uses_w_dig_clear() {
        let p = FlatParams::default();
        let one = spin_score(SPIN_NONE, 1, I, AiMode::Dig);
        let zero = spin_score(SPIN_NONE, 0, I, AiMode::Dig);
        assert!((one - zero - p.w_dig_clear).abs() < 1e-9);
    }

    #[test]
    fn score_mode_clear_pricing_matches_per_size_table() {
        let p = FlatParams::default();
        let expected = [0.0, p.w_clear1, p.w_clear2, p.w_clear3, p.w_clear4];
        let baseline = spin_score(SPIN_NONE, 0, I, AiMode::Score);
        for lines in 0u32..=4 {
            let s = spin_score(SPIN_NONE, lines, I, AiMode::Score);
            assert!(
                (s - baseline - expected[lines as usize]).abs() < 1e-9,
                "lines={} expected {}",
                lines,
                expected[lines as usize]
            );
        }
    }
}
