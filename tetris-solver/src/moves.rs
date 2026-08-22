/// Move opcodes matching the JS side.
pub const MOVE_LEFT: u8 = 0;
pub const MOVE_RIGHT: u8 = 1;
pub const ROTATE_CW: u8 = 2;
pub const ROTATE_CCW: u8 = 3;
pub const HARD_DROP: u8 = 4;
pub const HOLD: u8 = 5;
pub const SOFT_DROP: u8 = 6;

/// Assemble the final opcode sequence for a solved placement: the path found
/// by reachability search, prefixed with HOLD when the solver swapped pieces.
pub fn assemble_moves(path: &[u8], use_hold: bool) -> Vec<u8> {
    let mut moves = Vec::with_capacity(path.len() + 1);
    if use_hold {
        moves.push(HOLD);
    }
    moves.extend_from_slice(path);
    moves
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_passes_through_unchanged() {
        let path = vec![ROTATE_CW, MOVE_LEFT, SOFT_DROP, SOFT_DROP];
        assert_eq!(assemble_moves(&path, false), path);
    }

    #[test]
    fn hold_is_prefixed() {
        let path = vec![MOVE_RIGHT, SOFT_DROP];
        assert_eq!(assemble_moves(&path, true), vec![HOLD, MOVE_RIGHT, SOFT_DROP]);
    }

    #[test]
    fn empty_path_with_hold() {
        assert_eq!(assemble_moves(&[], true), vec![HOLD]);
    }

    #[test]
    fn empty_path_no_hold() {
        assert!(assemble_moves(&[], false).is_empty());
    }
}
