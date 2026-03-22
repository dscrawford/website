use crate::placement::Placement;

/// Move opcodes matching the JS side.
pub const MOVE_LEFT: u8 = 0;
pub const MOVE_RIGHT: u8 = 1;
pub const ROTATE_CW: u8 = 2;
pub const ROTATE_CCW: u8 = 3;
pub const HARD_DROP: u8 = 4;
pub const HOLD: u8 = 5;

/// Generate the sequence of move opcodes to reach the target placement
/// from the spawn position.
///
/// - `spawn_col`: the column where the piece spawns
/// - `spawn_rotation`: the rotation at spawn (always 0)
/// - `use_hold`: whether to emit a hold opcode first
pub fn generate_moves(
    placement: &Placement,
    spawn_col: i32,
    spawn_rotation: u8,
    use_hold: bool,
) -> Vec<u8> {
    let mut moves = Vec::with_capacity(16);

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

    // Hard drop
    moves.push(HARD_DROP);

    moves
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::placement::Placement;
    use crate::pieces::T;

    #[test]
    fn no_movement_needed() {
        let p = Placement { piece_type: T, rotation: 0, col: 3, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, false);
        assert_eq!(moves, vec![HARD_DROP]);
    }

    #[test]
    fn move_right() {
        let p = Placement { piece_type: T, rotation: 0, col: 5, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, false);
        assert_eq!(moves, vec![MOVE_RIGHT, MOVE_RIGHT, HARD_DROP]);
    }

    #[test]
    fn move_left() {
        let p = Placement { piece_type: T, rotation: 0, col: 1, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, false);
        assert_eq!(moves, vec![MOVE_LEFT, MOVE_LEFT, HARD_DROP]);
    }

    #[test]
    fn rotate_cw_once() {
        let p = Placement { piece_type: T, rotation: 1, col: 3, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, false);
        assert_eq!(moves, vec![ROTATE_CW, HARD_DROP]);
    }

    #[test]
    fn rotate_ccw_for_3_steps() {
        // Rotation 3 is reachable by 1 CCW instead of 3 CW
        let p = Placement { piece_type: T, rotation: 3, col: 3, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, false);
        assert_eq!(moves, vec![ROTATE_CCW, HARD_DROP]);
    }

    #[test]
    fn rotate_twice() {
        let p = Placement { piece_type: T, rotation: 2, col: 3, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, false);
        assert_eq!(moves, vec![ROTATE_CW, ROTATE_CW, HARD_DROP]);
    }

    #[test]
    fn hold_then_move() {
        let p = Placement { piece_type: T, rotation: 0, col: 5, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, true);
        assert_eq!(moves, vec![HOLD, MOVE_RIGHT, MOVE_RIGHT, HARD_DROP]);
    }

    #[test]
    fn full_sequence() {
        // Hold, rotate CCW, move left 2, hard drop
        let p = Placement { piece_type: T, rotation: 3, col: 1, landing_row: 18 };
        let moves = generate_moves(&p, 3, 0, true);
        assert_eq!(moves, vec![HOLD, ROTATE_CCW, MOVE_LEFT, MOVE_LEFT, HARD_DROP]);
    }
}
