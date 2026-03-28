/// Runtime parameter structs for the Tetris AI evaluator and solver.
/// Each struct's `Default` impl returns the current hardcoded constants,
/// ensuring zero behavior change when delegating through these.

// === Flat strategy parameters ===

#[derive(Debug, Clone)]
pub struct FlatParams {
    pub w_landing_height: f64,
    pub w_row_transitions: f64,
    pub w_column_transitions: f64,
    pub w_holes: f64,
    pub w_well_sums: f64,
    pub w_height_gap: f64,
    pub w_stacking_rows: f64,
    pub w_scoring_rows: f64,
    pub stacking_landing_scale: f64,
    pub scoring_row_trans_scale: f64,
    pub scoring_col_trans_scale: f64,
    pub scoring_holes_scale: f64,
    pub scoring_wells_scale: f64,
}

impl Default for FlatParams {
    fn default() -> Self {
        Self {
            w_landing_height: -4.500158825082766,
            w_row_transitions: -3.2178882868487753,
            w_column_transitions: -9.348695305445199,
            w_holes: -7.899265427351652,
            w_well_sums: -3.3855972247263626,
            w_height_gap: -8000.0,
            w_stacking_rows: -20.0,
            w_scoring_rows: 30.0,
            stacking_landing_scale: 0.2,
            scoring_row_trans_scale: 0.3,
            scoring_col_trans_scale: 0.3,
            scoring_holes_scale: 0.5,
            scoring_wells_scale: 0.3,
        }
    }
}

impl FlatParams {
    pub const GENE_COUNT: usize = 13;

    pub fn to_vec(&self) -> Vec<f64> {
        vec![
            self.w_landing_height,
            self.w_row_transitions,
            self.w_column_transitions,
            self.w_holes,
            self.w_well_sums,
            self.w_height_gap,
            self.w_stacking_rows,
            self.w_scoring_rows,
            self.stacking_landing_scale,
            self.scoring_row_trans_scale,
            self.scoring_col_trans_scale,
            self.scoring_holes_scale,
            self.scoring_wells_scale,
        ]
    }

    pub fn from_vec(v: &[f64]) -> Self {
        assert!(v.len() >= Self::GENE_COUNT);
        Self {
            w_landing_height: v[0],
            w_row_transitions: v[1],
            w_column_transitions: v[2],
            w_holes: v[3],
            w_well_sums: v[4],
            w_height_gap: v[5],
            w_stacking_rows: v[6],
            w_scoring_rows: v[7],
            stacking_landing_scale: v[8],
            scoring_row_trans_scale: v[9],
            scoring_col_trans_scale: v[10],
            scoring_holes_scale: v[11],
            scoring_wells_scale: v[12],
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
    pub fw_scoring_col_trans_scale: f64,
    pub fw_scoring_row_trans_scale: f64,
    pub fw_scoring_wells_scale: f64,
    pub fw_scoring_balance_scale: f64,
}

impl Default for FourWideParams {
    fn default() -> Self {
        Self {
            fw_landing_height: -4.5,
            fw_well_cleanliness: 50.0,
            fw_holes: -10.0,
            fw_column_transitions: -6.0,
            fw_row_transitions: -2.0,
            fw_well_sums: -1.0,
            fw_tower_balance: -4.0,
            fw_rows_stacking: -20.0,
            fw_rows_scoring: 30.0,
            fw_height_gap: -8000.0,
            fw_stacking_landing_scale: 0.2,
            fw_scoring_well_clean_scale: 0.3,
            fw_scoring_holes_scale: 0.5,
            fw_scoring_col_trans_scale: 0.3,
            fw_scoring_row_trans_scale: 0.3,
            fw_scoring_wells_scale: 0.3,
            fw_scoring_balance_scale: 0.3,
        }
    }
}

impl FourWideParams {
    pub const GENE_COUNT: usize = 17;

    pub fn to_vec(&self) -> Vec<f64> {
        vec![
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
        ]
    }

    pub fn from_vec(v: &[f64]) -> Self {
        assert!(v.len() >= Self::GENE_COUNT);
        Self {
            fw_landing_height: v[0],
            fw_well_cleanliness: v[1],
            fw_holes: v[2],
            fw_column_transitions: v[3],
            fw_row_transitions: v[4],
            fw_well_sums: v[5],
            fw_tower_balance: v[6],
            fw_rows_stacking: v[7],
            fw_rows_scoring: v[8],
            fw_height_gap: v[9],
            fw_stacking_landing_scale: v[10],
            fw_scoring_well_clean_scale: v[11],
            fw_scoring_holes_scale: v[12],
            fw_scoring_col_trans_scale: v[13],
            fw_scoring_row_trans_scale: v[14],
            fw_scoring_wells_scale: v[15],
            fw_scoring_balance_scale: v[16],
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
}

impl Default for SolverParams {
    fn default() -> Self {
        Self {
            sigmoid_k: 10.0,
            flat_tetris_bonus_max: 80.0,
            fw_tetris_bonus_max: 80.0,
            fw_well_cell_penalty: -8.0,
        }
    }
}

impl SolverParams {
    pub const GENE_COUNT: usize = 4;

    pub fn to_vec(&self) -> Vec<f64> {
        vec![
            self.sigmoid_k,
            self.flat_tetris_bonus_max,
            self.fw_tetris_bonus_max,
            self.fw_well_cell_penalty,
        ]
    }

    pub fn from_vec(v: &[f64]) -> Self {
        assert!(v.len() >= Self::GENE_COUNT);
        Self {
            sigmoid_k: v[0],
            flat_tetris_bonus_max: v[1],
            fw_tetris_bonus_max: v[2],
            fw_well_cell_penalty: v[3],
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
    fn flat_default_matches_constants() {
        let p = FlatParams::default();
        assert_eq!(p.w_landing_height, -4.500158825082766);
        assert_eq!(p.w_holes, -7.899265427351652);
        assert_eq!(p.w_height_gap, -8000.0);
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
    fn four_wide_default_matches_constants() {
        let p = FourWideParams::default();
        assert_eq!(p.fw_well_cleanliness, 50.0);
        assert_eq!(p.fw_tower_balance, -4.0);
        assert_eq!(p.fw_height_gap, -8000.0);
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
    fn to_const_block_contains_values() {
        let p = FlatParams::default();
        let block = p.to_const_block();
        assert!(block.contains("W_LANDING_HEIGHT"));
        assert!(block.contains("W_HOLES"));
    }
}
