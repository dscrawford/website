use crate::board;
use crate::pieces;
use crate::params::{FlatParams, FourWideParams};
use crate::strategy::Strategy;

/// Evaluate a board state after placement, dispatching on strategy (parameterized).
pub fn evaluate(
    cells: &[u8],
    width: u32,
    height: u32,
    lines_cleared: u32,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    scoring_urgency: f64,
    target_fill: f64,
    strategy: Strategy,
    flat_params: &FlatParams,
    fw_params: &FourWideParams,
) -> f64 {
    match strategy {
        Strategy::Flat => evaluate_flat_param(
            cells, width, height, lines_cleared, landing_row,
            piece_type, rotation, scoring_urgency, target_fill, flat_params,
        ),
        Strategy::FourWide => evaluate_four_wide_param(
            cells, width, height, lines_cleared, landing_row,
            piece_type, rotation, scoring_urgency, target_fill, fw_params,
        ),
    }
}

/// Flat strategy evaluation with runtime parameters.
pub fn evaluate_flat_param(
    cells: &[u8],
    width: u32,
    height: u32,
    lines_cleared: u32,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    _scoring_urgency: f64,
    target_fill: f64,
    p: &FlatParams,
) -> f64 {
    let landing_height = compute_landing_height(height, landing_row, piece_type, rotation);

    let row_trans = board::row_transitions(cells, width, height) as f64;
    let col_trans = board::column_transitions(cells, width, height) as f64;
    let holes = board::count_holes(cells, width, height) as f64;
    let wells = board::well_sums(cells, width, height) as f64;

    let avg_fill = board::aggregate_height(cells, width, height) as f64
        / (width as f64 * height as f64);

    let below_target = avg_fill < target_fill;

    let deviation = (avg_fill - target_fill).abs();
    let target_penalty = p.w_height_gap * deviation * deviation;

    if below_target {
        let landing_weight = p.w_landing_height * p.stacking_landing_scale;

        landing_weight * landing_height
            + p.w_stacking_rows * lines_cleared as f64
            + p.w_row_transitions * row_trans
            + p.w_column_transitions * col_trans
            + p.w_holes * holes
            + p.w_well_sums * wells
            + target_penalty
    } else {
        landing_height * p.w_landing_height
            + p.w_scoring_rows * lines_cleared as f64
            + p.w_row_transitions * row_trans * p.scoring_row_trans_scale
            + p.w_column_transitions * col_trans * p.scoring_col_trans_scale
            + p.w_holes * holes * p.scoring_holes_scale
            + p.w_well_sums * wells * p.scoring_wells_scale
            + target_penalty
    }
}

/// 4-Wide strategy evaluation with runtime parameters.
pub fn evaluate_four_wide_param(
    cells: &[u8],
    width: u32,
    height: u32,
    lines_cleared: u32,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    _scoring_urgency: f64,
    target_fill: f64,
    p: &FourWideParams,
) -> f64 {
    let landing_height = compute_landing_height(height, landing_row, piece_type, rotation);

    let (well_start, well_end) = board::well_column_range(width);
    let well_area = (well_end - well_start + 1) * height;
    let well_filled = board::well_fill_count(cells, width, height, well_start, well_end);
    let well_clean_ratio = 1.0 - (well_filled as f64 / well_area as f64);

    let holes = board::count_holes(cells, width, height) as f64;
    let col_trans = board::column_transitions(cells, width, height) as f64;
    let row_trans = board::row_transitions(cells, width, height) as f64;
    let wells = board::well_sums(cells, width, height) as f64;

    let (left_avg, right_avg) =
        board::tower_zone_avg_heights(cells, width, height, well_start, well_end);
    let balance_penalty = (left_avg - right_avg).abs();

    let avg_fill = board::aggregate_height(cells, width, height) as f64
        / (width as f64 * height as f64);
    let below_target = avg_fill < target_fill;

    let deviation = (avg_fill - target_fill).abs();
    let target_penalty = p.fw_height_gap * deviation * deviation;

    if below_target {
        p.fw_landing_height * p.fw_stacking_landing_scale * landing_height
            + p.fw_well_cleanliness * well_clean_ratio
            + p.fw_holes * holes
            + p.fw_column_transitions * col_trans
            + p.fw_row_transitions * row_trans
            + p.fw_well_sums * wells
            + p.fw_tower_balance * balance_penalty
            + p.fw_rows_stacking * lines_cleared as f64
            + target_penalty
    } else {
        p.fw_landing_height * landing_height
            + p.fw_well_cleanliness * well_clean_ratio * p.fw_scoring_well_clean_scale
            + p.fw_holes * holes * p.fw_scoring_holes_scale
            + p.fw_column_transitions * col_trans * p.fw_scoring_col_trans_scale
            + p.fw_row_transitions * row_trans * p.fw_scoring_row_trans_scale
            + p.fw_well_sums * wells * p.fw_scoring_wells_scale
            + p.fw_tower_balance * balance_penalty * p.fw_scoring_balance_scale
            + p.fw_rows_scoring * lines_cleared as f64
            + target_penalty
    }
}

// === Fast evaluation using pre-computed BoardMetrics (for evolution) ===

/// Evaluate using pre-computed metrics — avoids redundant board scans.
pub fn evaluate_fast(
    metrics: &board::BoardMetrics,
    width: u32,
    height: u32,
    lines_cleared: u32,
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
            metrics, width, height, lines_cleared, landing_row,
            piece_type, rotation, target_fill, flat_params,
        ),
        Strategy::FourWide => evaluate_fw_fast(
            metrics, width, height, lines_cleared, landing_row,
            piece_type, rotation, target_fill, fw_params,
        ),
    }
}

fn evaluate_flat_fast(
    m: &board::BoardMetrics,
    width: u32,
    height: u32,
    lines_cleared: u32,
    landing_row: i32,
    piece_type: u8,
    rotation: u8,
    target_fill: f64,
    p: &FlatParams,
) -> f64 {
    let landing_height = compute_landing_height(height, landing_row, piece_type, rotation);
    let avg_fill = m.aggregate_height as f64 / (width as f64 * height as f64);
    let below_target = avg_fill < target_fill;
    let deviation = (avg_fill - target_fill).abs();
    let target_penalty = p.w_height_gap * deviation * deviation;

    let row_trans = m.row_transitions as f64;
    let col_trans = m.column_transitions as f64;
    let holes = m.holes as f64;
    let wells = m.well_sums as f64;

    if below_target {
        let landing_weight = p.w_landing_height * p.stacking_landing_scale;
        landing_weight * landing_height
            + p.w_stacking_rows * lines_cleared as f64
            + p.w_row_transitions * row_trans
            + p.w_column_transitions * col_trans
            + p.w_holes * holes
            + p.w_well_sums * wells
            + target_penalty
    } else {
        landing_height * p.w_landing_height
            + p.w_scoring_rows * lines_cleared as f64
            + p.w_row_transitions * row_trans * p.scoring_row_trans_scale
            + p.w_column_transitions * col_trans * p.scoring_col_trans_scale
            + p.w_holes * holes * p.scoring_holes_scale
            + p.w_well_sums * wells * p.scoring_wells_scale
            + target_penalty
    }
}

fn evaluate_fw_fast(
    m: &board::BoardMetrics,
    width: u32,
    height: u32,
    lines_cleared: u32,
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
    let col_trans = m.column_transitions as f64;
    let row_trans = m.row_transitions as f64;
    let wells = m.well_sums as f64;

    if below_target {
        p.fw_landing_height * p.fw_stacking_landing_scale * landing_height
            + p.fw_well_cleanliness * well_clean_ratio
            + p.fw_holes * holes
            + p.fw_column_transitions * col_trans
            + p.fw_row_transitions * row_trans
            + p.fw_well_sums * wells
            + p.fw_tower_balance * balance_penalty
            + p.fw_rows_stacking * lines_cleared as f64
            + target_penalty
    } else {
        p.fw_landing_height * landing_height
            + p.fw_well_cleanliness * well_clean_ratio * p.fw_scoring_well_clean_scale
            + p.fw_holes * holes * p.fw_scoring_holes_scale
            + p.fw_column_transitions * col_trans * p.fw_scoring_col_trans_scale
            + p.fw_row_transitions * row_trans * p.fw_scoring_row_trans_scale
            + p.fw_well_sums * wells * p.fw_scoring_wells_scale
            + p.fw_tower_balance * balance_penalty * p.fw_scoring_balance_scale
            + p.fw_rows_scoring * lines_cleared as f64
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
