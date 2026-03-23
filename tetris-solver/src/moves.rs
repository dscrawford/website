use crate::placement::Placement;

/// Move opcodes matching the JS side.
pub const MOVE_LEFT: u8 = 0;
pub const MOVE_RIGHT: u8 = 1;
pub const ROTATE_CW: u8 = 2;
pub const ROTATE_CCW: u8 = 3;
pub const HARD_DROP: u8 = 4;
pub const HOLD: u8 = 5;
pub const SOFT_DROP: u8 = 6;

/// Generate the sequence of move opcodes to reach the target placement
/// from the spawn position.
///
/// - `spawn_col`: the column where the piece spawns
/// - `spawn_rotation`: the rotation at spawn (always 0)
/// - `spawn_row`: the row where the piece spawns (0 for top)
/// - `use_hold`: whether to emit a hold opcode first
///
/// Emits soft drop opcodes (one per row) instead of hard drop so the
/// bot visibly fast-falls the piece to its landing position.
pub fn generate_moves(
    placement: &Placement,
    spawn_col: i32,
    spawn_rotation: u8,
    spawn_row: i32,
    use_hold: bool,
) -> Vec<u8> {
    let mut moves = Vec::with_capacity(64);

    // Hold first if needed
    if use_hold {
        moves.push(HOLD);
    }

    // Rotate to target rotation (shortest path)
    let rot_diff = (placement.rotation as i8 - spawn_rotation as i8).rem_euclid(4) as u8;
    match rot_diff {
        0 => {}
        1 => moves.push(ROTATE_CW),
        2 => {
            moves.push(ROTATE_CW);
            moves.push(ROTATE_CW);
        }
        3 => moves.push(ROTATE_CCW),
        _ => unreachable!(),
    }

    // Move to target column
    let col_diff = placement.col - spawn_col;
    if col_diff < 0 {
        for _ in 0..(-col_diff) {
            moves.push(MOVE_LEFT);
        }
    } else if col_diff > 0 {
        for _ in 0..col_diff {
            moves.push(MOVE_RIGHT);
        }
    }

    // Soft drop to landing row (one opcode per row)
    let drop_distance = placement.landing_row - spawn_row;
    if drop_distance > 0 {
        for _ in 0..drop_distance {
            moves.push(SOFT_DROP);
        }
    }

    moves
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::placement::Placement;
    use crate::pieces::T;

    #[test]
    fn no_movement_drops_to_landing() {
        let p = Placement { piece_type: T, rotation: 0, col: 3, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, 0, false);
        // 18 soft drops (from row 0 to row 18)
        let expected: Vec<u8> = vec![SOFT_DROP; 18];
        assert_eq!(moves, expected);
    }

    #[test]
    fn move_right_then_soft_drop() {
        let p = Placement { piece_type: T, rotation: 0, col: 5, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, 0, false);
        let mut expected = vec![MOVE_RIGHT, MOVE_RIGHT];
        expected.extend(vec![SOFT_DROP; 18]);
        assert_eq!(moves, expected);
    }

    #[test]
    fn move_left_then_soft_drop() {
        let p = Placement { piece_type: T, rotation: 0, col: 1, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, 0, false);
        let mut expected = vec![MOVE_LEFT, MOVE_LEFT];
        expected.extend(vec![SOFT_DROP; 18]);
        assert_eq!(moves, expected);
    }

    #[test]
    fn rotate_cw_once() {
        let p = Placement { piece_type: T, rotation: 1, col: 3, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, 0, false);
        let mut expected = vec![ROTATE_CW];
        expected.extend(vec![SOFT_DROP; 18]);
        assert_eq!(moves, expected);
    }

    #[test]
    fn rotate_ccw_for_3_steps() {
        // Rotation 3 is reachable by 1 CCW instead of 3 CW
        let p = Placement { piece_type: T, rotation: 3, col: 3, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, 0, false);
        let mut expected = vec![ROTATE_CCW];
        expected.extend(vec![SOFT_DROP; 18]);
        assert_eq!(moves, expected);
    }

    #[test]
    fn rotate_twice() {
        let p = Placement { piece_type: T, rotation: 2, col: 3, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, 0, false);
        let mut expected = vec![ROTATE_CW, ROTATE_CW];
        expected.extend(vec![SOFT_DROP; 18]);
        assert_eq!(moves, expected);
    }

    #[test]
    fn hold_then_move() {
        let p = Placement { piece_type: T, rotation: 0, col: 5, landing_row: 10 };
        let moves = generate_moves(&p, 3, 0, 0, true);
        let mut expected = vec![HOLD, MOVE_RIGHT, MOVE_RIGHT];
        expected.extend(vec![SOFT_DROP; 10]);
        assert_eq!(moves, expected);
    }

    #[test]
    fn full_sequence() {
        // Hold, rotate CCW, move left 2, soft drop to row 5
        let p = Placement { piece_type: T, rotation: 3, col: 1, landing_row: 5 };
        let moves = generate_moves(&p, 3, 0, 0, true);
        let mut expected = vec![HOLD, ROTATE_CCW, MOVE_LEFT, MOVE_LEFT];
        expected.extend(vec![SOFT_DROP; 5]);
        assert_eq!(moves, expected);
    }

    #[test]
    fn landing_at_spawn_row_no_drops() {
        // Piece lands at row 0 (e.g., board nearly full)
        let p = Placement { piece_type: T, rotation: 0, col: 3, landing_row: 0 };
        let moves = generate_moves(&p, 3, 0, 0, false);
        assert!(moves.is_empty(), "Expected no moves for same-row landing");
    }

    #[test]
    fn short_drop_distance() {
        let p = Placement { piece_type: T, rotation: 0, col: 3, landing_row: 2 };
        let moves = generate_moves(&p, 3, 0, 0, false);
        assert_eq!(moves, vec![SOFT_DROP, SOFT_DROP]);
    }
}
