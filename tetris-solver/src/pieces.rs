/// Piece type constants matching src/game-engine/types.js
pub const EMPTY: u8 = 0;
pub const I: u8 = 1;
pub const O: u8 = 2;
pub const T: u8 = 3;
pub const S: u8 = 4;
pub const Z: u8 = 5;
pub const J: u8 = 6;
pub const L: u8 = 7;

pub const PIECE_COUNT: usize = 7;
pub const ROTATION_COUNT: usize = 4;
pub const CELLS_PER_PIECE: usize = 4;

/// Piece shapes indexed as PIECE_SHAPES[type-1][rotation] = [(row, col); 4]
/// Mirrors PIECE_SHAPES from src/game-engine/types.js exactly.
pub const PIECE_SHAPES: [[[( i8, i8); CELLS_PER_PIECE]; ROTATION_COUNT]; PIECE_COUNT] = [
    // I piece (type 1)
    [
        [(1, 0), (1, 1), (1, 2), (1, 3)], // 0: horizontal
        [(0, 2), (1, 2), (2, 2), (3, 2)], // R: vertical
        [(2, 0), (2, 1), (2, 2), (2, 3)], // 2: horizontal (shifted)
        [(0, 1), (1, 1), (2, 1), (3, 1)], // L: vertical (shifted)
    ],
    // O piece (type 2)
    [
        [(0, 1), (0, 2), (1, 1), (1, 2)],
        [(0, 1), (0, 2), (1, 1), (1, 2)],
        [(0, 1), (0, 2), (1, 1), (1, 2)],
        [(0, 1), (0, 2), (1, 1), (1, 2)],
    ],
    // T piece (type 3)
    [
        [(0, 1), (1, 0), (1, 1), (1, 2)], // 0
        [(0, 1), (1, 1), (1, 2), (2, 1)], // R
        [(1, 0), (1, 1), (1, 2), (2, 1)], // 2
        [(0, 1), (1, 0), (1, 1), (2, 1)], // L
    ],
    // S piece (type 4)
    [
        [(0, 1), (0, 2), (1, 0), (1, 1)], // 0
        [(0, 1), (1, 1), (1, 2), (2, 2)], // R
        [(1, 1), (1, 2), (2, 0), (2, 1)], // 2
        [(0, 0), (1, 0), (1, 1), (2, 1)], // L
    ],
    // Z piece (type 5)
    [
        [(0, 0), (0, 1), (1, 1), (1, 2)], // 0
        [(0, 2), (1, 1), (1, 2), (2, 1)], // R
        [(1, 0), (1, 1), (2, 1), (2, 2)], // 2
        [(0, 1), (1, 0), (1, 1), (2, 0)], // L
    ],
    // J piece (type 6)
    [
        [(0, 0), (1, 0), (1, 1), (1, 2)], // 0
        [(0, 1), (0, 2), (1, 1), (2, 1)], // R
        [(1, 0), (1, 1), (1, 2), (2, 2)], // 2
        [(0, 1), (1, 1), (2, 0), (2, 1)], // L
    ],
    // L piece (type 7)
    [
        [(0, 2), (1, 0), (1, 1), (1, 2)], // 0
        [(0, 1), (1, 1), (2, 1), (2, 2)], // R
        [(1, 0), (1, 1), (1, 2), (2, 0)], // 2
        [(0, 0), (0, 1), (1, 1), (2, 1)], // L
    ],
];

/// Get the shape offsets for a piece type and rotation.
/// piece_type is 1-7, rotation is 0-3.
#[inline]
pub fn get_shape(piece_type: u8, rotation: u8) -> &'static [(i8, i8); CELLS_PER_PIECE] {
    &PIECE_SHAPES[(piece_type - 1) as usize][rotation as usize]
}

/// Get the width span of a piece in a given rotation (max_col - min_col + 1).
pub fn piece_width(piece_type: u8, rotation: u8) -> i8 {
    let shape = get_shape(piece_type, rotation);
    let min_c = shape.iter().map(|&(_, c)| c).min().unwrap();
    let max_c = shape.iter().map(|&(_, c)| c).max().unwrap();
    max_c - min_c + 1
}

/// Get the min column offset of a piece shape.
pub fn min_col_offset(piece_type: u8, rotation: u8) -> i8 {
    let shape = get_shape(piece_type, rotation);
    shape.iter().map(|&(_, c)| c).min().unwrap()
}

/// Get the max column offset of a piece shape.
pub fn max_col_offset(piece_type: u8, rotation: u8) -> i8 {
    let shape = get_shape(piece_type, rotation);
    shape.iter().map(|&(_, c)| c).max().unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn piece_type_constants_match_js() {
        assert_eq!(EMPTY, 0);
        assert_eq!(I, 1);
        assert_eq!(O, 2);
        assert_eq!(T, 3);
        assert_eq!(S, 4);
        assert_eq!(Z, 5);
        assert_eq!(J, 6);
        assert_eq!(L, 7);
    }

    #[test]
    fn all_shapes_have_4_cells() {
        for piece_idx in 0..PIECE_COUNT {
            for rot in 0..ROTATION_COUNT {
                assert_eq!(
                    PIECE_SHAPES[piece_idx][rot].len(),
                    4,
                    "piece {} rot {} should have 4 cells",
                    piece_idx + 1,
                    rot
                );
            }
        }
    }

    #[test]
    fn i_piece_rotation_0_is_horizontal() {
        let shape = get_shape(I, 0);
        // All cells at row 1, columns 0-3
        assert_eq!(shape, &[(1, 0), (1, 1), (1, 2), (1, 3)]);
    }

    #[test]
    fn i_piece_rotation_1_is_vertical() {
        let shape = get_shape(I, 1);
        // Column 2, rows 0-3
        assert_eq!(shape, &[(0, 2), (1, 2), (2, 2), (3, 2)]);
    }

    #[test]
    fn o_piece_same_all_rotations() {
        let base = get_shape(O, 0);
        for rot in 1..4 {
            assert_eq!(get_shape(O, rot as u8), base, "O rotation {} should match rotation 0", rot);
        }
    }

    #[test]
    fn piece_width_i_horizontal() {
        assert_eq!(piece_width(I, 0), 4);
    }

    #[test]
    fn piece_width_i_vertical() {
        assert_eq!(piece_width(I, 1), 1);
    }

    #[test]
    fn piece_width_o() {
        assert_eq!(piece_width(O, 0), 2);
    }

    #[test]
    fn piece_width_t_rotation_0() {
        assert_eq!(piece_width(T, 0), 3);
    }

    #[test]
    fn min_col_offset_i_rot0() {
        assert_eq!(min_col_offset(I, 0), 0);
    }

    #[test]
    fn max_col_offset_i_rot0() {
        assert_eq!(max_col_offset(I, 0), 3);
    }

    #[test]
    fn t_piece_shapes_match_js() {
        // T rotation 0: T pointing up
        assert_eq!(get_shape(T, 0), &[(0, 1), (1, 0), (1, 1), (1, 2)]);
        // T rotation 1: R
        assert_eq!(get_shape(T, 1), &[(0, 1), (1, 1), (1, 2), (2, 1)]);
        // T rotation 2
        assert_eq!(get_shape(T, 2), &[(1, 0), (1, 1), (1, 2), (2, 1)]);
        // T rotation 3: L
        assert_eq!(get_shape(T, 3), &[(0, 1), (1, 0), (1, 1), (2, 1)]);
    }

    #[test]
    fn s_piece_shapes_match_js() {
        assert_eq!(get_shape(S, 0), &[(0, 1), (0, 2), (1, 0), (1, 1)]);
    }

    #[test]
    fn z_piece_shapes_match_js() {
        assert_eq!(get_shape(Z, 0), &[(0, 0), (0, 1), (1, 1), (1, 2)]);
    }

    #[test]
    fn j_piece_shapes_match_js() {
        assert_eq!(get_shape(J, 0), &[(0, 0), (1, 0), (1, 1), (1, 2)]);
    }

    #[test]
    fn l_piece_shapes_match_js() {
        assert_eq!(get_shape(L, 0), &[(0, 2), (1, 0), (1, 1), (1, 2)]);
    }
}
