use crate::board;
use crate::pieces;

#[derive(Debug, Clone, PartialEq)]
pub struct Placement {
    pub piece_type: u8,
    pub rotation: u8,
    pub col: i32,
    pub landing_row: i32,
}

/// Enumerate all valid placements for a given piece type on the board.
pub fn enumerate_placements(
    cells: &[u8],
    width: u32,
    height: u32,
    piece_type: u8,
) -> Vec<Placement> {
    let mut placements = Vec::new();

    for rotation in 0..4u8 {
        let min_c = pieces::min_col_offset(piece_type, rotation) as i32;
        let max_c = pieces::max_col_offset(piece_type, rotation) as i32;

        // Valid column range: piece must fit within [0, width)
        let col_start = -min_c;
        let col_end = width as i32 - max_c;

        for col in col_start..col_end {
            // Check if piece can exist at spawn (row 0)
            if board::check_collision(cells, width, height, piece_type, rotation, 0, col) {
                continue;
            }

            let landing_row = board::drop_row(cells, width, height, piece_type, rotation, col);

            placements.push(Placement {
                piece_type,
                rotation,
                col,
                landing_row,
            });
        }
    }

    placements
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pieces::{I, O, T, EMPTY};

    fn empty_board(width: u32, height: u32) -> Vec<u8> {
        vec![EMPTY; (width * height) as usize]
    }

    #[test]
    fn placements_on_empty_10_wide_board() {
        let cells = empty_board(10, 20);
        let placements = enumerate_placements(&cells, 10, 20, T);
        // T piece has 4 rotations, each fitting in various columns
        assert!(!placements.is_empty());
        // All placements should have valid landing rows
        for p in &placements {
            assert!(p.landing_row >= 0);
            assert!(p.landing_row < 20);
        }
    }

    #[test]
    fn i_piece_has_placements_for_all_rotations() {
        let cells = empty_board(10, 20);
        let placements = enumerate_placements(&cells, 10, 20, I);
        let rotations: Vec<u8> = placements.iter().map(|p| p.rotation).collect();
        for rot in 0..4 {
            assert!(rotations.contains(&rot), "I piece should have rotation {}", rot);
        }
    }

    #[test]
    fn o_piece_placements() {
        let cells = empty_board(10, 20);
        let placements = enumerate_placements(&cells, 10, 20, O);
        // O piece: all 4 rotations identical. Min col offset=1, max=2
        // Valid cols: -1 to 7 (col_start = -1, col_end = 8)
        // But wait, O shape has min_col=1, so col_start = -1
        // At col=-1, cells would be at cols 0,1 — valid
        // All 4 rotations give same placements, so we get 4x the count
        // Actually each rotation is enumerated separately
        let unique_cols: std::collections::HashSet<i32> = placements.iter().map(|p| p.col).collect();
        assert!(unique_cols.len() >= 9); // -1 through 7
    }

    #[test]
    fn no_placements_on_full_board() {
        let cells = vec![I; 10 * 20]; // completely filled
        let placements = enumerate_placements(&cells, 10, 20, T);
        assert!(placements.is_empty());
    }

    #[test]
    fn placement_landing_row_on_empty_board() {
        let cells = empty_board(10, 20);
        let placements = enumerate_placements(&cells, 10, 20, T);
        // T rotation 0 at col 3: lowest shape row is row+1, so lands at row 18
        let p = placements.iter().find(|p| p.rotation == 0 && p.col == 3).unwrap();
        assert_eq!(p.landing_row, 18);
    }
}
