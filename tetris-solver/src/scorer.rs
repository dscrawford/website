//! Incremental placement scoring: caches per-column aggregates once per
//! solve, patching only the columns a candidate touches instead of
//! rescanning the board. Must equal the reference path (simulate_place +
//! compute_all_metrics) exactly, enforced by property tests; line clears
//! fall back to that reference path.

use crate::board::{self, BoardMetrics};
use crate::pieces;

const EMPTY: u8 = 0;

/// Row transitions attributable to boundary `c` (between col c-1 and c;
/// walls at c == 0 and c == w) — matches compute_all_metrics: wall
/// boundaries count EMPTY edge cells, interior boundaries count diffs.
fn pair_trans_at<F: Fn(usize, usize) -> bool>(w: usize, h: usize, c: usize, filled: &F) -> u32 {
    let mut t = 0u32;
    for row in 0..h {
        if c == 0 {
            if !filled(row, 0) {
                t += 1;
            }
        } else if c == w {
            if !filled(row, w - 1) {
                t += 1;
            }
        } else if filled(row, c - 1) != filled(row, c) {
            t += 1;
        }
    }
    t
}

/// Cumulative-well contribution of one column, replicating the reference
/// scan exactly: it starts one row above the column's own top (or row 0 for
/// empty columns) and re-counts the downward run from every scanned well
/// cell, so runs contribute overlapping depths and well cells above the
/// scan start are (deliberately, for parity) not counted.
fn well_sum_at<F: Fn(usize, usize) -> bool>(
    w: usize,
    h: usize,
    col: usize,
    col_height: u32,
    filled: &F,
) -> u32 {
    let is_well_cell = |row: usize| {
        !filled(row, col)
            && (col == 0 || filled(row, col - 1))
            && (col == w - 1 || filled(row, col + 1))
    };
    let scan_start = if col_height > 0 {
        let sr = h - col_height as usize;
        if sr > 0 { sr - 1 } else { 0 }
    } else {
        0
    };
    let mut sum = 0u32;
    for row in scan_start..h {
        if !is_well_cell(row) {
            continue;
        }
        let mut depth = 1u32;
        for r in (row + 1)..h {
            if is_well_cell(r) {
                depth += 1;
            } else {
                break;
            }
        }
        sum += depth;
    }
    sum
}

/// Cavity/overhang classification for holes in one column, given the
/// (possibly patched) heights array.
fn classify_at<F: Fn(usize, usize) -> bool>(
    w: usize,
    h: usize,
    col: usize,
    heights: &[u32],
    filled: &F,
) -> (u32, u32) {
    let ch = heights[col] as usize;
    if ch == 0 {
        return (0, 0);
    }
    let top = h - ch;
    let mut cav = 0u32;
    let mut ovh = 0u32;
    for row in (top + 1)..h {
        if filled(row, col) {
            continue;
        }
        let y = (h - 1 - row) as i64;
        let reachable_left =
            col >= 2 && (heights[col - 1] as i64) <= y - 1 && (heights[col - 2] as i64) <= y;
        let reachable_right =
            col + 2 < w && (heights[col + 1] as i64) <= y - 1 && (heights[col + 2] as i64) <= y;
        if reachable_left || reachable_right {
            ovh += 1;
        } else {
            cav += 1;
        }
    }
    (cav, ovh)
}

pub struct ScoreContext<'a> {
    cells: &'a [u8],
    w: usize,
    h: usize,
    width: u32,
    height: u32,
    well_start: u32,
    well_end: u32,
    base: BoardMetrics,
    // Per-column caches on the base board
    heights: Vec<u32>,
    holes_c: Vec<u32>,
    covered_c: Vec<u32>,
    col_trans_c: Vec<u32>,
    well_sum_c: Vec<u32>,
    cav_c: Vec<u32>,
    ovh_c: Vec<u32>,
    well_fill_c: Vec<u32>,
    hole_mask_c: Vec<u64>, // bit r set = hole at row r (valid while h <= 64)
    // Per-boundary row-transition contributions; index c = pair (c-1, c),
    // index 0 and w are the wall boundaries
    pair_trans: Vec<u32>,
    row_filled: Vec<u32>,
    // Scratch reused across score() calls
    scratch_heights: Vec<u32>,
    // Boards taller than the hole-mask width use the reference path per call
    fallback_only: bool,
    // A base board with an already-full row gets cleared by simulate_place
    // regardless of the piece; only the reference path handles that
    base_has_full_row: bool,
}

impl<'a> ScoreContext<'a> {
    pub fn new(cells: &'a [u8], width: u32, height: u32, well_start: u32, well_end: u32) -> Self {
        let w = width as usize;
        let h = height as usize;
        let base = board::compute_all_metrics(cells, width, height, well_start, well_end);
        let fallback_only = match w.checked_mul(h) {
            None => true,
            Some(size) => w == 0 || h == 0 || h > 64 || cells.len() < size,
        };

        let mut ctx = ScoreContext {
            cells,
            w,
            h,
            width,
            height,
            well_start,
            well_end,
            base,
            heights: vec![0; w],
            holes_c: vec![0; w],
            covered_c: vec![0; w],
            col_trans_c: vec![0; w],
            well_sum_c: vec![0; w],
            cav_c: vec![0; w],
            ovh_c: vec![0; w],
            well_fill_c: vec![0; w],
            hole_mask_c: vec![0; w],
            pair_trans: vec![0; w + 1],
            row_filled: vec![0; h.max(1)],
            scratch_heights: vec![0; w],
            fallback_only,
            base_has_full_row: false,
        };
        if !ctx.fallback_only {
            ctx.build_caches();
            ctx.base_has_full_row = ctx.row_filled.iter().any(|&c| c == width);
        }
        ctx
    }

    fn filled(&self, row: usize, col: usize) -> bool {
        self.cells[row * self.w + col] != EMPTY
    }

    fn build_caches(&mut self) {
        let (w, h) = (self.w, self.h);
        for col in 0..w {
            let mut filled_above = 0u32;
            let mut height_set = false;
            let mut col_trans = 0u32;
            if self.filled(0, col) {
                col_trans += 1;
            }
            for row in 0..h {
                let f = self.filled(row, col);
                if f {
                    if !height_set {
                        self.heights[col] = (h - row) as u32;
                        height_set = true;
                    }
                    filled_above += 1;
                    self.row_filled[row] += 1;
                    if (col as u32) >= self.well_start && (col as u32) <= self.well_end {
                        self.well_fill_c[col] += 1;
                    }
                } else if filled_above > 0 {
                    self.holes_c[col] += 1;
                    self.covered_c[col] = self.covered_c[col].saturating_add(filled_above);
                    self.hole_mask_c[col] |= 1u64 << row;
                }
                if row > 0 && (self.filled(row - 1, col) != f) {
                    col_trans += 1;
                }
            }
            if !self.filled(h - 1, col) {
                col_trans += 1;
            }
            self.col_trans_c[col] = col_trans;
        }
        let cells = self.cells;
        let base_filled = move |r: usize, c: usize| cells[r * w + c] != EMPTY;
        for c in 0..=w {
            self.pair_trans[c] = pair_trans_at(w, h, c, &base_filled);
        }
        for col in 0..w {
            self.well_sum_c[col] = well_sum_at(w, h, col, self.heights[col], &base_filled);
            let (cav, ovh) = classify_at(w, h, col, &self.heights, &base_filled);
            self.cav_c[col] = cav;
            self.ovh_c[col] = ovh;
        }
    }


    /// Whole-board metrics of the base board (no piece placed).
    pub fn base(&self) -> &BoardMetrics {
        &self.base
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    /// Score a placement: (lines_cleared, eroded_cells, post-board metrics).
    pub fn score(&mut self, piece_type: u8, rotation: u8, row: i32, col: i32) -> (u32, u32, BoardMetrics) {
        let shape = pieces::get_shape(piece_type, rotation);

        let mut lines = 0u32;
        if !self.fallback_only {
            let mut rows_seen = [i32::MIN; 4];
            let mut n_seen = 0usize;
            for &(dr, _) in shape.iter() {
                let Some(r) = row.checked_add(dr as i32) else { continue };
                if r < 0 || r >= self.h as i32 || rows_seen[..n_seen].contains(&r) {
                    continue;
                }
                rows_seen[n_seen] = r;
                n_seen += 1;
                let piece_cells_in_row = shape
                    .iter()
                    .filter(|&&(dr2, _)| row + (dr2 as i32) == r)
                    .count() as u32;
                if self.row_filled[r as usize] + piece_cells_in_row == self.width {
                    lines += 1;
                }
            }
        }

        if self.fallback_only || self.base_has_full_row || lines > 0 {
            return self.score_fallback(piece_type, rotation, row, col);
        }

        let metrics = self.metrics_with_piece(shape, row, col);
        (0, 0, metrics)
    }

    fn score_fallback(&self, piece_type: u8, rotation: u8, row: i32, col: i32) -> (u32, u32, BoardMetrics) {
        let (lines, eroded) = board::clears_and_eroded(
            self.cells, self.width, self.height, piece_type, rotation, row, col,
        );
        let (board2, _) = board::simulate_place(
            self.cells, self.width, self.height, piece_type, rotation, row, col,
        );
        let metrics =
            board::compute_all_metrics(&board2, self.width, self.height, self.well_start, self.well_end);
        (lines, eroded, metrics)
    }

    fn metrics_with_piece(&mut self, shape: &[(i8, i8); 4], row: i32, col: i32) -> BoardMetrics {
        let (w, h) = (self.w, self.h);

        // Affected column range (cells are in-bounds for legal placements)
        let mut pa = usize::MAX;
        let mut pb = 0usize;
        for &(_, dc) in shape.iter() {
            let c = (col + dc as i32).clamp(0, w as i32 - 1) as usize;
            pa = pa.min(c);
            pb = pb.max(c);
        }

        let cells = self.cells;
        let piece_covers = move |r: usize, c: usize| -> bool {
            shape.iter().any(|&(dr, dc)| {
                row + (dr as i32) == r as i32 && col + (dc as i32) == c as i32
            })
        };
        let filled2 = move |r: usize, c: usize| -> bool {
            cells[r * w + c] != EMPTY || piece_covers(r, c)
        };

        self.scratch_heights.copy_from_slice(&self.heights);
        for c in pa..=pb {
            let mut height = 0u32;
            for r in 0..h {
                if filled2(r, c) {
                    height = (h - r) as u32;
                    break;
                }
            }
            self.scratch_heights[c] = height;
        }

        // Column-decomposable metrics: base total - old + new over affected
        let mut holes = self.base.holes;
        let mut covered = self.base.covered_cells;
        let mut col_trans = self.base.column_transitions;
        let mut agg = self.base.aggregate_height;
        let mut well_fill = self.base.well_fill_count;
        let mut new_masks = [0u64; 4];

        for c in pa..=pb {
            let mut filled_above = 0u32;
            let mut nh = 0u32;
            let mut ncov = 0u32;
            let mut nmask = 0u64;
            let mut nct = 0u32;
            let mut nwf = 0u32;
            if filled2(0, c) {
                nct += 1;
            }
            let mut prev = filled2(0, c);
            for r in 0..h {
                let f = if r == 0 { prev } else { filled2(r, c) };
                if f {
                    filled_above += 1;
                    if (c as u32) >= self.well_start && (c as u32) <= self.well_end {
                        nwf += 1;
                    }
                } else if filled_above > 0 {
                    nh += 1;
                    ncov = ncov.saturating_add(filled_above);
                    nmask |= 1u64 << r;
                }
                if r > 0 && f != prev {
                    nct += 1;
                }
                prev = f;
            }
            if !filled2(h - 1, c) {
                nct += 1;
            }

            holes = holes - self.holes_c[c] + nh;
            covered = covered - self.covered_c[c] + ncov;
            col_trans = col_trans - self.col_trans_c[c] + nct;
            agg = agg - self.heights[c] + self.scratch_heights[c];
            well_fill = well_fill - self.well_fill_c[c] + nwf;
            new_masks[c - pa] = nmask;
        }

        // Row transitions: boundaries pa..=pb+1 change
        let mut row_trans = self.base.row_transitions;
        for c in pa..=(pb + 1).min(w) {
            row_trans = row_trans - self.pair_trans[c] + pair_trans_at(w, h, c, &filled2);
        }

        // Well sums: neighbor fill matters, so pa-1..=pb+1; the scan start
        // depends on the column's own (patched) height
        let mut well_sums = self.base.well_sums;
        for c in pa.saturating_sub(1)..=(pb + 1).min(w - 1) {
            well_sums = well_sums - self.well_sum_c[c]
                + well_sum_at(w, h, c, self.scratch_heights[c], &filled2);
        }

        // Cavity/overhang: classification reads heights at +-2
        let mut cav = self.base.cavities;
        let mut ovh = self.base.overhangs;
        for c in pa.saturating_sub(2)..=(pb + 2).min(w - 1) {
            let (nc, no) = classify_at(w, h, c, &self.scratch_heights, &filled2);
            cav = cav - self.cav_c[c] + nc;
            ovh = ovh - self.ovh_c[c] + no;
        }

        // rows_with_holes: OR of per-col masks with affected cols patched
        let mut rows_mask = 0u64;
        for c in 0..w {
            rows_mask |= if (pa..=pb).contains(&c) {
                new_masks[c - pa]
            } else {
                self.hole_mask_c[c]
            };
        }
        let rows_with_holes = rows_mask.count_ones();

        let heights = &self.scratch_heights;
        let mut bumpiness = 0u32;
        let mut bumpiness_sq = 0u32;
        for c in 1..w {
            let d = heights[c - 1].abs_diff(heights[c]);
            bumpiness = bumpiness.saturating_add(d);
            bumpiness_sq = bumpiness_sq.saturating_add(d.saturating_mul(d));
        }
        let mut notches = 0u32;
        let half = self.height / 2;
        let three_quarter = ((self.height as u64) * 3 / 4) as u32;
        let mut top_half = 0u32;
        let mut top_quarter = 0u32;
        for c in 0..w {
            let ch = heights[c];
            let hl = if c == 0 { u32::MAX } else { heights[c - 1] };
            let hr = if c == w - 1 { u32::MAX } else { heights[c + 1] };
            if w >= 2 && hl.min(hr) >= ch.saturating_add(3) {
                notches += 1;
            }
            top_half += ch.saturating_sub(half);
            top_quarter += ch.saturating_sub(three_quarter);
        }

        // Dynamic well: rightmost lowest column of the patched board
        let mut wc = 0usize;
        for c in 0..w {
            if heights[c] <= heights[wc] {
                wc = c;
            }
        }
        let h_wc = heights[wc];
        let mut well_depth = 0u32;
        if w > 1 {
            let mut r = h as i32 - 1 - h_wc as i32;
            while r >= 0 && well_depth < 8 {
                let ru = r as usize;
                // Full except the well column, via row counts + piece overlay
                let mut cnt = self.row_filled[ru];
                for &(dr, dc) in shape.iter() {
                    if row + (dr as i32) == r && !(col + (dc as i32) == wc as i32) {
                        cnt += 1;
                    }
                }
                let well_cell_filled = filled2(ru, wc);
                if cnt == self.width - 1 && !well_cell_filled {
                    well_depth += 1;
                    r -= 1;
                } else {
                    break;
                }
            }
        }
        let mut covered_well = 0u32;
        if h_wc > 0 {
            let top = h - h_wc as usize;
            let mut filled_above = 0u32;
            for r in top..h {
                if filled2(r, wc) {
                    filled_above += 1;
                } else {
                    covered_well = covered_well.saturating_add(filled_above);
                }
            }
        }

        let mut left_sum = 0u32;
        let mut right_sum = 0u32;
        for c in 0..w {
            if (c as u32) < self.well_start {
                left_sum += heights[c];
            } else if (c as u32) > self.well_end {
                right_sum += heights[c];
            }
        }
        let left_cols = self.well_start;
        let right_cols = self.width - self.well_end - 1;

        BoardMetrics {
            row_transitions: row_trans,
            column_transitions: col_trans,
            holes,
            covered_cells: covered,
            well_sums,
            aggregate_height: agg,
            bumpiness,
            bumpiness_sq,
            cavities: cav,
            overhangs: ovh,
            rows_with_holes,
            notches,
            top_half_cells: top_half,
            top_quarter_cells: top_quarter,
            well_col: wc as u32,
            well_col_height: h_wc,
            well_depth,
            covered_well,
            well_fill_count: well_fill,
            left_tower_avg_height: if left_cols > 0 {
                left_sum as f64 / left_cols as f64
            } else {
                0.0
            },
            right_tower_avg_height: if right_cols > 0 {
                right_sum as f64 / right_cols as f64
            } else {
                0.0
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::movegen;

    fn reference(
        cells: &[u8],
        width: u32,
        height: u32,
        ws: u32,
        we: u32,
        piece: u8,
        rot: u8,
        row: i32,
        col: i32,
    ) -> (u32, u32, BoardMetrics) {
        let (lines, eroded) = board::clears_and_eroded(cells, width, height, piece, rot, row, col);
        let (b2, _) = board::simulate_place(cells, width, height, piece, rot, row, col);
        let m = board::compute_all_metrics(&b2, width, height, ws, we);
        (lines, eroded, m)
    }

    struct Xorshift32(u32);
    impl Xorshift32 {
        fn next(&mut self) -> u32 {
            let mut x = self.0;
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            self.0 = x;
            x
        }
    }

    fn random_board(rng: &mut Xorshift32, w: u32, h: u32, density: u32) -> Vec<u8> {
        let mut cells = vec![EMPTY; (w * h) as usize];
        // Fill the bottom part with gravity-plausible noise plus floaters
        for row in (h / 3)..h {
            for col in 0..w {
                if rng.next() % 100 < density {
                    cells[(row * w + col) as usize] = 1 + (rng.next() % 7) as u8;
                }
            }
        }
        cells
    }

    #[test]
    fn matches_reference_on_all_reachable_placements() {
        let mut rng = Xorshift32(0xC0FFEE11);
        for &(w, h) in &[
            (10u32, 20u32),
            (7, 14),
            (24, 20),
            (40, 40),
            (71, 40),
            (4, 20),  // well spans the whole board
            (10, 64), // hole-mask boundary: still the fast path
            (10, 65), // one past the boundary: fallback_only
        ] {
            let (ws, we) = board::well_column_range(w);
            for trial in 0..8 {
                let density = 25 + (trial * 9) % 60;
                let cells = random_board(&mut rng, w, h, density);
                let mut ctx = ScoreContext::new(&cells, w, h, ws, we);
                for piece in 1..=7u8 {
                    for f in movegen::find_placements(&cells, w, h, piece) {
                        let p = &f.placement;
                        let got = ctx.score(p.piece_type, p.rotation, p.landing_row, p.col);
                        let want =
                            reference(&cells, w, h, ws, we, p.piece_type, p.rotation, p.landing_row, p.col);
                        assert_eq!(
                            got, want,
                            "w={} h={} trial={} piece={} rot={} col={} row={}",
                            w, h, trial, piece, p.rotation, p.col, p.landing_row
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn matches_reference_on_line_clears() {
        // Boards engineered so many placements clear lines (fallback path)
        let (w, h) = (10u32, 20u32);
        let (ws, we) = board::well_column_range(w);
        let mut cells = vec![EMPTY; (w * h) as usize];
        for r in 16..20u32 {
            for c in 0..10u32 {
                if c != 4 && !(r == 16 && c == 5) {
                    cells[(r * w + c) as usize] = 1;
                }
            }
        }
        let mut ctx = ScoreContext::new(&cells, w, h, ws, we);
        for piece in 1..=7u8 {
            for f in movegen::find_placements(&cells, w, h, piece) {
                let p = &f.placement;
                let got = ctx.score(p.piece_type, p.rotation, p.landing_row, p.col);
                let want = reference(&cells, w, h, ws, we, p.piece_type, p.rotation, p.landing_row, p.col);
                assert_eq!(got, want, "piece={} rot={} col={}", piece, p.rotation, p.col);
            }
        }
    }

    #[test]
    fn tall_boards_use_fallback_and_still_match() {
        let (w, h) = (10u32, 80u32);
        let (ws, we) = board::well_column_range(w);
        let mut rng = Xorshift32(42);
        let cells = random_board(&mut rng, w, h, 40);
        let mut ctx = ScoreContext::new(&cells, w, h, ws, we);
        for f in movegen::find_placements(&cells, w, h, 3) {
            let p = &f.placement;
            let got = ctx.score(p.piece_type, p.rotation, p.landing_row, p.col);
            let want = reference(&cells, w, h, ws, we, p.piece_type, p.rotation, p.landing_row, p.col);
            assert_eq!(got, want);
        }
    }

    #[test]
    fn fallback_flag_flips_exactly_at_height_64() {
        let cells_64 = vec![EMPTY; 10 * 64];
        let ctx64 = ScoreContext::new(&cells_64, 10, 64, 3, 6);
        assert!(!ctx64.fallback_only, "h=64 must use the fast path");

        let cells_65 = vec![EMPTY; 10 * 65];
        let ctx65 = ScoreContext::new(&cells_65, 10, 65, 3, 6);
        assert!(ctx65.fallback_only, "h=65 exceeds the u64 hole-mask width");
    }

    #[test]
    fn base_board_with_pre_existing_full_row_uses_fallback() {
        let (w, h) = (10u32, 20u32);
        let (ws, we) = board::well_column_range(w);
        let mut cells = vec![EMPTY; (w * h) as usize];
        for c in 0..w {
            cells[((h - 1) * w + c) as usize] = 1;
        }
        let mut ctx = ScoreContext::new(&cells, w, h, ws, we);
        assert!(ctx.base_has_full_row);

        // The O piece completes nothing itself; simulate_place still clears
        // the pre-existing full row (which clears_and_eroded does not count),
        // so only the reference path is correct — exact equality is the claim
        let got = ctx.score(pieces::O, 0, 0, 0);
        let want = reference(&cells, w, h, ws, we, pieces::O, 0, 0, 0);
        assert_eq!(got, want);
    }

    #[test]
    fn matches_reference_for_i_piece_touching_walls() {
        let (w, h) = (10u32, 20u32);
        let (ws, we) = board::well_column_range(w);
        let mut rng = Xorshift32(0xBADC0FFE);
        let cells = random_board(&mut rng, w, h, 45);
        let mut ctx = ScoreContext::new(&cells, w, h, ws, we);

        let mut checked = 0;
        for f in movegen::find_placements(&cells, w, h, crate::pieces::I) {
            let p = &f.placement;
            let shape = pieces::get_shape(p.piece_type, p.rotation);
            let touches_wall = shape.iter().any(|&(_, dc)| {
                let c = p.col + dc as i32;
                c == 0 || c == (w - 1) as i32
            });
            if !touches_wall {
                continue;
            }
            let got = ctx.score(p.piece_type, p.rotation, p.landing_row, p.col);
            let want = reference(&cells, w, h, ws, we, p.piece_type, p.rotation, p.landing_row, p.col);
            assert_eq!(got, want, "wall I: rot={} col={}", p.rotation, p.col);
            checked += 1;
        }
        assert!(checked > 0, "must exercise at least one wall-touching I placement");
    }
}
