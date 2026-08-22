/// Runtime parameter structs for the Tetris AI evaluator and solver.
/// Flat/Solver defaults are the best evolved genome (k8s island run,
/// seed 2042, fitness 0.536 vs 0.331 baseline); regenerate via bin/evolve.

// === Flat strategy parameters ===

#[derive(Debug, Clone)]
pub struct FlatParams {
    pub w_landing_height: f64,
    pub w_row_transitions: f64,
    pub w_column_transitions: f64,
    pub w_holes: f64,
    pub w_covered_cells: f64,
    pub w_well_sums: f64,
    pub w_height_gap: f64,
    pub w_stacking_rows: f64,
    pub w_scoring_rows: f64,
    pub stacking_landing_scale: f64,
    pub scoring_row_trans_scale: f64,
    pub scoring_col_trans_scale: f64,
    pub scoring_holes_scale: f64,
    pub scoring_covered_scale: f64,
    pub scoring_wells_scale: f64,
    pub w_bumpiness: f64,
    pub w_bumpiness_sq: f64,
    pub w_cavities: f64,
    pub w_overhangs: f64,
    pub w_rows_with_holes: f64,
    pub w_notches: f64,
    pub w_top_half: f64,
    pub w_top_quarter: f64,
    pub w_eroded: f64,
    pub w_clear1: f64,
    pub w_clear2: f64,
    pub w_clear3: f64,
    pub w_clear4: f64,
    pub w_well_depth: f64,
    pub w_tetris_ready: f64,
    pub w_covered_well: f64,
    pub w_tspin_clear: f64,
    pub w_wasted_t: f64,
    pub w_dig_clear: f64,
}

impl Default for FlatParams {
    fn default() -> Self {
        Self {
            w_landing_height: -4.346495537893084,
            w_row_transitions: -3.157812446192785,
            w_column_transitions: -9.65770759991193,
            w_holes: -8.182837790012194,
            w_covered_cells: -3.255839051795568,
            w_well_sums: -3.071907761946263,
            w_height_gap: -8091.734084702696,
            w_stacking_rows: -20.342407666266226,
            w_scoring_rows: 28.95996094473998,
            stacking_landing_scale: 0.1965206603204468,
            // Full price in Score mode: mode is derived once from the
            // pre-placement board, so a discount would half-price holes for
            // every candidate at once
            scoring_row_trans_scale: 0.9831859890079319,
            scoring_col_trans_scale: 0.9486796408179504,
            scoring_holes_scale: 1.181986058763661,
            scoring_covered_scale: 1.0362011262891935,
            scoring_wells_scale: 0.9441341519986904,
            // Ratios from docs/TETRIS_AI_RESEARCH.md (cavity >> overhang,
            // eroded = El-Tetris); magnitudes are conservative placeholders
            w_bumpiness: -0.9907838329026596,
            w_bumpiness_sq: -0.09207873037618435,
            w_cavities: -3.6898893203828873,
            w_overhangs: -0.008732539834833956,
            w_rows_with_holes: -1.9047530400090813,
            w_notches: -9.913316966818263,
            w_top_half: -1.4066735583175813,
            w_top_quarter: -4.9059140604326,
            w_eroded: 3.4435983898596754,
            // Clear pricing follows cold-clear's shape (burns negative, quad
            // strongly positive); magnitudes scaled to this evaluator
            w_clear1: -15.735885798065345,
            w_clear2: -8.77071602774659,
            w_clear3: -2.814271552102226,
            w_clear4: 58.648471314221474,
            w_well_depth: 2.038587754690537,
            w_tetris_ready: 10.620374124088228,
            w_covered_well: -8.245736129026044,
            w_tspin_clear: 25.3073536941731,
            w_wasted_t: -0.9044216033670106,
            w_dig_clear: 7.050013164897415,
        }
    }
}

impl FlatParams {
    pub const GENE_COUNT: usize = 34;

    pub fn to_vec(&self) -> Vec<f64> {
        vec![
            self.w_landing_height,
            self.w_row_transitions,
            self.w_column_transitions,
            self.w_holes,
            self.w_covered_cells,
            self.w_well_sums,
            self.w_height_gap,
            self.w_stacking_rows,
            self.w_scoring_rows,
            self.stacking_landing_scale,
            self.scoring_row_trans_scale,
            self.scoring_col_trans_scale,
            self.scoring_holes_scale,
            self.scoring_covered_scale,
            self.scoring_wells_scale,
            self.w_bumpiness,
            self.w_bumpiness_sq,
            self.w_cavities,
            self.w_overhangs,
            self.w_rows_with_holes,
            self.w_notches,
            self.w_top_half,
            self.w_top_quarter,
            self.w_eroded,
            self.w_clear1,
            self.w_clear2,
            self.w_clear3,
            self.w_clear4,
            self.w_well_depth,
            self.w_tetris_ready,
            self.w_covered_well,
            self.w_tspin_clear,
            self.w_wasted_t,
            self.w_dig_clear,
        ]
    }

    pub fn from_vec(v: &[f64]) -> Self {
        assert!(v.len() >= Self::GENE_COUNT);
        Self {
            w_landing_height: v[0],
            w_row_transitions: v[1],
            w_column_transitions: v[2],
            w_holes: v[3],
            w_covered_cells: v[4],
            w_well_sums: v[5],
            w_height_gap: v[6],
            w_stacking_rows: v[7],
            w_scoring_rows: v[8],
            stacking_landing_scale: v[9],
            scoring_row_trans_scale: v[10],
            scoring_col_trans_scale: v[11],
            scoring_holes_scale: v[12],
            scoring_covered_scale: v[13],
            scoring_wells_scale: v[14],
            w_bumpiness: v[15],
            w_bumpiness_sq: v[16],
            w_cavities: v[17],
            w_overhangs: v[18],
            w_rows_with_holes: v[19],
            w_notches: v[20],
            w_top_half: v[21],
            w_top_quarter: v[22],
            w_eroded: v[23],
            w_clear1: v[24],
            w_clear2: v[25],
            w_clear3: v[26],
            w_clear4: v[27],
            w_well_depth: v[28],
            w_tetris_ready: v[29],
            w_covered_well: v[30],
            w_tspin_clear: v[31],
            w_wasted_t: v[32],
            w_dig_clear: v[33],
        }
    }

    pub fn to_const_block(&self) -> String {
        format!(
            "\
const W_LANDING_HEIGHT: f64 = {:.15};
const W_ROW_TRANSITIONS: f64 = {:.15};
const W_COLUMN_TRANSITIONS: f64 = {:.15};
const W_HOLES: f64 = {:.15};
const W_WELL_SUMS: f64 = {:.15};
const W_HEIGHT_GAP: f64 = {:.1};
// Inside evaluate_flat stacking branch:
const W_STACKING_ROWS: f64 = {:.6};
let landing_weight = W_LANDING_HEIGHT * {:.6};
// Inside evaluate_flat scoring branch:
const W_SCORING_ROWS: f64 = {:.6};
// Scoring mode scale factors: row_trans*{:.4}, col_trans*{:.4}, holes*{:.4}, wells*{:.4}",
            self.w_landing_height,
            self.w_row_transitions,
            self.w_column_transitions,
            self.w_holes,
            self.w_well_sums,
            self.w_height_gap,
            self.w_stacking_rows,
            self.stacking_landing_scale,
            self.w_scoring_rows,
            self.scoring_row_trans_scale,
            self.scoring_col_trans_scale,
            self.scoring_holes_scale,
            self.scoring_wells_scale,
        )
    }
}

// === FourWide strategy parameters ===

#[derive(Debug, Clone)]
pub struct FourWideParams {
    pub fw_landing_height: f64,
    pub fw_well_cleanliness: f64,
    pub fw_holes: f64,
    pub fw_covered_cells: f64,
    pub fw_column_transitions: f64,
    pub fw_row_transitions: f64,
    pub fw_well_sums: f64,
    pub fw_tower_balance: f64,
    pub fw_rows_stacking: f64,
    pub fw_rows_scoring: f64,
    pub fw_height_gap: f64,
    pub fw_stacking_landing_scale: f64,
    pub fw_scoring_well_clean_scale: f64,
    pub fw_scoring_holes_scale: f64,
    pub fw_scoring_covered_scale: f64,
    pub fw_scoring_col_trans_scale: f64,
    pub fw_scoring_row_trans_scale: f64,
    pub fw_scoring_wells_scale: f64,
    pub fw_scoring_balance_scale: f64,
    pub fw_bumpiness: f64,
    pub fw_bumpiness_sq: f64,
    pub fw_cavities: f64,
    pub fw_overhangs: f64,
    pub fw_rows_with_holes: f64,
    pub fw_notches: f64,
    pub fw_top_half: f64,
    pub fw_top_quarter: f64,
    pub fw_eroded: f64,
}

impl Default for FourWideParams {
    fn default() -> Self {
        Self {
            fw_landing_height: -4.619907751795365,
            fw_well_cleanliness: 52.99341859022994,
            fw_holes: -9.72489568596765,
            fw_covered_cells: -4.351932432749389,
            fw_column_transitions: -5.589327255252621,
            fw_row_transitions: -2.027472969306737,
            fw_well_sums: -1.0615751325003897,
            fw_tower_balance: -4.105864892972296,
            fw_rows_stacking: -18.71635105792104,
            fw_rows_scoring: 29.23492691349116,
            fw_height_gap: -7454.9530120404415,
            fw_stacking_landing_scale: 0.1826699937850997,
            fw_scoring_well_clean_scale: 0.29066127634027716,
            fw_scoring_holes_scale: 0.49832780744715893,
            fw_scoring_covered_scale: 0.46927768190868824,
            fw_scoring_col_trans_scale: 0.32270994714534706,
            fw_scoring_row_trans_scale: 0.3014322882423927,
            fw_scoring_wells_scale: 0.33376095105808523,
            fw_scoring_balance_scale: 0.33519585094408266,
            fw_bumpiness: -0.9744291820951854,
            fw_bumpiness_sq: -0.09470113061932106,
            fw_cavities: -4.456713179909095,
            fw_overhangs: -0.004809966801886721,
            fw_rows_with_holes: -2.147022179096243,
            fw_notches: -4.594455309142193,
            fw_top_half: -1.487558003147527,
            fw_top_quarter: -5.036063693836301,
            fw_eroded: 3.434545236651424,
        }
    }
}

impl FourWideParams {
    pub const GENE_COUNT: usize = 28;

    pub fn to_vec(&self) -> Vec<f64> {
        vec![
            self.fw_landing_height,
            self.fw_well_cleanliness,
            self.fw_holes,
            self.fw_covered_cells,
            self.fw_column_transitions,
            self.fw_row_transitions,
            self.fw_well_sums,
            self.fw_tower_balance,
            self.fw_rows_stacking,
            self.fw_rows_scoring,
            self.fw_height_gap,
            self.fw_stacking_landing_scale,
            self.fw_scoring_well_clean_scale,
            self.fw_scoring_holes_scale,
            self.fw_scoring_covered_scale,
            self.fw_scoring_col_trans_scale,
            self.fw_scoring_row_trans_scale,
            self.fw_scoring_wells_scale,
            self.fw_scoring_balance_scale,
            self.fw_bumpiness,
            self.fw_bumpiness_sq,
            self.fw_cavities,
            self.fw_overhangs,
            self.fw_rows_with_holes,
            self.fw_notches,
            self.fw_top_half,
            self.fw_top_quarter,
            self.fw_eroded,
        ]
    }

    pub fn from_vec(v: &[f64]) -> Self {
        assert!(v.len() >= Self::GENE_COUNT);
        Self {
            fw_landing_height: v[0],
            fw_well_cleanliness: v[1],
            fw_holes: v[2],
            fw_covered_cells: v[3],
            fw_column_transitions: v[4],
            fw_row_transitions: v[5],
            fw_well_sums: v[6],
            fw_tower_balance: v[7],
            fw_rows_stacking: v[8],
            fw_rows_scoring: v[9],
            fw_height_gap: v[10],
            fw_stacking_landing_scale: v[11],
            fw_scoring_well_clean_scale: v[12],
            fw_scoring_holes_scale: v[13],
            fw_scoring_covered_scale: v[14],
            fw_scoring_col_trans_scale: v[15],
            fw_scoring_row_trans_scale: v[16],
            fw_scoring_wells_scale: v[17],
            fw_scoring_balance_scale: v[18],
            fw_bumpiness: v[19],
            fw_bumpiness_sq: v[20],
            fw_cavities: v[21],
            fw_overhangs: v[22],
            fw_rows_with_holes: v[23],
            fw_notches: v[24],
            fw_top_half: v[25],
            fw_top_quarter: v[26],
            fw_eroded: v[27],
        }
    }

    pub fn to_const_block(&self) -> String {
        format!(
            "\
const FW_LANDING_HEIGHT: f64 = {:.6};
const FW_WELL_CLEANLINESS: f64 = {:.6};
const FW_HOLES: f64 = {:.6};
const FW_COLUMN_TRANSITIONS: f64 = {:.6};
const FW_ROW_TRANSITIONS: f64 = {:.6};
const FW_WELL_SUMS: f64 = {:.6};
const FW_TOWER_BALANCE: f64 = {:.6};
const FW_ROWS_STACKING: f64 = {:.6};
const FW_ROWS_SCORING: f64 = {:.6};
const FW_HEIGHT_GAP: f64 = {:.1};
// Stacking branch: landing_height * {:.6}
// Scoring branch scale factors: well_clean*{:.4}, holes*{:.4}, col_trans*{:.4}, row_trans*{:.4}, wells*{:.4}, balance*{:.4}",
            self.fw_landing_height,
            self.fw_well_cleanliness,
            self.fw_holes,
            self.fw_column_transitions,
            self.fw_row_transitions,
            self.fw_well_sums,
            self.fw_tower_balance,
            self.fw_rows_stacking,
            self.fw_rows_scoring,
            self.fw_height_gap,
            self.fw_stacking_landing_scale,
            self.fw_scoring_well_clean_scale,
            self.fw_scoring_holes_scale,
            self.fw_scoring_col_trans_scale,
            self.fw_scoring_row_trans_scale,
            self.fw_scoring_wells_scale,
            self.fw_scoring_balance_scale,
        )
    }
}

// === Solver-level parameters (shared across strategies) ===

#[derive(Debug, Clone)]
pub struct SolverParams {
    pub sigmoid_k: f64,
    pub flat_tetris_bonus_max: f64,
    pub fw_tetris_bonus_max: f64,
    pub fw_well_cell_penalty: f64,
    pub flat_well_cell_penalty: f64,
    // lookahead_breadth == 0 disables lookahead; weight scales the second-ply bonus
    pub lookahead_breadth: f64,
    pub lookahead_weight: f64,
}

impl Default for SolverParams {
    fn default() -> Self {
        Self {
            sigmoid_k: 10.645718469308866,
            flat_tetris_bonus_max: 80.2261351941354,
            fw_tetris_bonus_max: 97.73804103604388,
            fw_well_cell_penalty: -7.5037058458316706,
            flat_well_cell_penalty: -5.301629972675438,
            lookahead_breadth: 8.90710380842394,
            lookahead_weight: 0.4441701732123455,
        }
    }
}

impl SolverParams {
    pub const GENE_COUNT: usize = 7;
    pub const MAX_LOOKAHEAD_BREADTH: f64 = 16.0;

    /// Breadth as usize, hardened against NaN/negative/huge evolved genes.
    pub fn breadth(&self) -> usize {
        if !self.lookahead_breadth.is_finite() {
            return 0;
        }
        self.lookahead_breadth.clamp(0.0, Self::MAX_LOOKAHEAD_BREADTH).round() as usize
    }

    pub fn to_vec(&self) -> Vec<f64> {
        vec![
            self.sigmoid_k,
            self.flat_tetris_bonus_max,
            self.fw_tetris_bonus_max,
            self.fw_well_cell_penalty,
            self.flat_well_cell_penalty,
            self.lookahead_breadth,
            self.lookahead_weight,
        ]
    }

    pub fn from_vec(v: &[f64]) -> Self {
        assert!(v.len() >= Self::GENE_COUNT);
        Self {
            sigmoid_k: v[0],
            flat_tetris_bonus_max: v[1],
            fw_tetris_bonus_max: v[2],
            fw_well_cell_penalty: v[3],
            flat_well_cell_penalty: v[4],
            lookahead_breadth: v[5],
            lookahead_weight: v[6],
        }
    }

    pub fn to_const_block(&self) -> String {
        format!(
            "\
const SIGMOID_K: f64 = {:.6};
const FLAT_TETRIS_BONUS_MAX: f64 = {:.6};
const FW_TETRIS_BONUS_MAX: f64 = {:.6};
const FW_WELL_CELL_PENALTY: f64 = {:.6};",
            self.sigmoid_k,
            self.flat_tetris_bonus_max,
            self.fw_tetris_bonus_max,
            self.fw_well_cell_penalty,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flat_defaults_have_sane_signs() {
        // Values come from evolved genomes and change on retune; pin the
        // structure (signs/ordering), not exact numbers
        let p = FlatParams::default();
        assert!(p.w_landing_height < 0.0);
        assert!(p.w_holes < 0.0);
        assert!(p.w_height_gap < -1000.0);
        assert!(p.w_clear4 > 0.0 && p.w_clear1 < 0.0, "quad rewarded, single priced");
        assert!(p.w_cavities < 0.0);
    }

    #[test]
    fn flat_roundtrip_vec() {
        let p = FlatParams::default();
        let v = p.to_vec();
        assert_eq!(v.len(), FlatParams::GENE_COUNT);
        let p2 = FlatParams::from_vec(&v);
        assert_eq!(p2.to_vec(), v);
    }

    #[test]
    fn four_wide_defaults_have_sane_signs() {
        // Evolved values change on retune; pin structure, not numbers
        let p = FourWideParams::default();
        assert!(p.fw_well_cleanliness > 0.0);
        assert!(p.fw_holes < 0.0);
        assert!(p.fw_height_gap < -1000.0);
        assert!(p.fw_rows_scoring > 0.0 && p.fw_rows_stacking < 0.0);
    }

    #[test]
    fn four_wide_roundtrip_vec() {
        let p = FourWideParams::default();
        let v = p.to_vec();
        assert_eq!(v.len(), FourWideParams::GENE_COUNT);
        let p2 = FourWideParams::from_vec(&v);
        assert_eq!(p2.to_vec(), v);
    }

    #[test]
    fn solver_roundtrip_vec() {
        let p = SolverParams::default();
        let v = p.to_vec();
        assert_eq!(v.len(), SolverParams::GENE_COUNT);
        let p2 = SolverParams::from_vec(&v);
        assert_eq!(p2.to_vec(), v);
    }

    #[test]
    fn gene_counts_are_pinned() {
        // evolve::Individual sizes genomes from these; silent drift corrupts
        // gene-index math for every from_vec/to_vec caller
        assert_eq!(FlatParams::GENE_COUNT, 34);
        assert_eq!(FourWideParams::GENE_COUNT, 28);
        assert_eq!(SolverParams::GENE_COUNT, 7);
    }

    #[test]
    #[should_panic]
    fn flat_from_vec_panics_on_pre_phase2_vector() {
        let _ = FlatParams::from_vec(&vec![0.0_f64; 15]);
    }

    #[test]
    #[should_panic]
    fn four_wide_from_vec_panics_on_pre_phase2_vector() {
        let _ = FourWideParams::from_vec(&vec![0.0_f64; 19]);
    }

    #[test]
    fn solver_default_lookahead_sane() {
        let p = SolverParams::default();
        assert!(p.breadth() >= 1 && p.breadth() <= 16);
        assert!(p.lookahead_weight > 0.0 && p.lookahead_weight <= 2.0);
    }

    #[test]
    fn to_const_block_contains_values() {
        let p = FlatParams::default();
        let block = p.to_const_block();
        assert!(block.contains("W_LANDING_HEIGHT"));
        assert!(block.contains("W_HOLES"));
    }
}
