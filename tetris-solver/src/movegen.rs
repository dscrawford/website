use std::collections::{HashMap, VecDeque};

use crate::board;
use crate::moves::{MOVE_LEFT, MOVE_RIGHT, ROTATE_CCW, ROTATE_CW, SOFT_DROP};
use crate::pieces;
use crate::placement::Placement;

pub const SPIN_NONE: u8 = 0;
pub const SPIN_MINI: u8 = 1;
pub const SPIN_FULL: u8 = 2;

/// A placement discovered by reachability search, with the input path that
/// reaches it from spawn and its T-spin status at lock.
#[derive(Debug, Clone, PartialEq)]
pub struct FoundPlacement {
    pub placement: Placement,
    pub path: Vec<u8>,
    pub spin: u8,
}

/// Spawn position matching src/game-engine/engine.js spawnPiece():
/// rotation 0, row 0, col = floor((width - piece_extent) / 2).
/// div_euclid matches JS Math.floor if width is ever below the piece extent.
pub fn spawn_state(width: u32, piece_type: u8) -> (i32, i32) {
    let extent = pieces::piece_width(piece_type, 0) as i32;
    (0, (width as i32 - extent).div_euclid(2))
}

// Padding so origin coordinates slightly outside the board (negative rows
// above the field, shape offsets past the walls) stay indexable.
const PAD: i32 = 4;
const SPIN_STATES: usize = 3;
// Allocation cap for attacker-controlled width/height at the WASM boundary;
// the sanctioned maximum board (999x40) needs ~580K states.
const MAX_STATES: usize = 4_000_000;

struct StateSpace {
    rows_span: usize,
    cols_span: usize,
    col_lo: i32,
    len: usize,
}

impl StateSpace {
    /// Column-windowed state space over origin columns [col_lo, col_hi].
    /// None if the space would exceed MAX_STATES or overflow usize (wasm32
    /// usize is 32-bit).
    fn new(height: u32, col_lo: i32, col_hi: i32) -> Option<Self> {
        let pad = 2 * PAD as usize;
        let rows_span = (height as usize).checked_add(pad)?;
        let cols_span = usize::try_from(col_hi.checked_sub(col_lo)? + 1)
            .ok()?
            .checked_add(pad)?;
        let len = 4usize
            .checked_mul(rows_span)?
            .checked_mul(cols_span)?
            .checked_mul(SPIN_STATES)?;
        (len <= MAX_STATES).then_some(StateSpace { rows_span, cols_span, col_lo, len })
    }

    fn len(&self) -> usize {
        self.len
    }

    fn index(&self, rot: u8, row: i32, col: i32, spin: u8) -> Option<usize> {
        let r = row + PAD;
        let c = col - self.col_lo + PAD;
        if r < 0 || c < 0 || r as usize >= self.rows_span || c as usize >= self.cols_span {
            return None;
        }
        Some(
            ((rot as usize * self.rows_span + r as usize) * self.cols_span + c as usize)
                * SPIN_STATES
                + spin as usize,
        )
    }
}

fn occupied_or_wall(cells: &[u8], width: u32, height: u32, row: i32, col: i32) -> bool {
    match board::get_cell(cells, width, height, row, col) {
        None => true,
        Some(v) => v != pieces::EMPTY,
    }
}

/// Stricter than board::check_collision: walls extend above the board, so
/// cells at row < 0 must still have their column in bounds. Prevents pieces
/// from drifting past the walls (and "locking" there) while above the field.
/// Paths valid under this check are always valid in the JS engine.
fn piece_fits(
    cells: &[u8],
    width: u32,
    height: u32,
    piece_type: u8,
    rotation: u8,
    row: i32,
    col: i32,
) -> bool {
    let shape = pieces::get_shape(piece_type, rotation);
    for &(dr, dc) in shape.iter() {
        let r = row + dr as i32;
        let c = col + dc as i32;
        if c < 0 || c >= width as i32 || r >= height as i32 {
            return false;
        }
        if r >= 0 && cells[(r as u32 * width + c as u32) as usize] != pieces::EMPTY {
            return false;
        }
    }
    true
}

/// A piece may only lock as a placement when every cell is on the visible
/// board (locking partially above the field is a topout, not a candidate).
fn fully_on_board(piece_type: u8, rotation: u8, row: i32) -> bool {
    let shape = pieces::get_shape(piece_type, rotation);
    shape.iter().all(|&(dr, _)| row + dr as i32 >= 0)
}

/// T-spin status per guideline rules: 3-corner rule with walls counting as
/// filled, full vs mini decided by the two front corners, and the test-5
/// kick exception promoting to full.
fn t_spin_status(
    cells: &[u8],
    width: u32,
    height: u32,
    row: i32,
    col: i32,
    rotation: u8,
    kick_idx: usize,
) -> u8 {
    let tl = occupied_or_wall(cells, width, height, row, col);
    let tr = occupied_or_wall(cells, width, height, row, col + 2);
    let bl = occupied_or_wall(cells, width, height, row + 2, col);
    let br = occupied_or_wall(cells, width, height, row + 2, col + 2);

    let total = tl as u8 + tr as u8 + bl as u8 + br as u8;
    if total < 3 {
        return SPIN_NONE;
    }

    let front_filled = match rotation {
        0 => tl && tr,
        1 => tr && br,
        2 => bl && br,
        _ => tl && bl,
    };

    if front_filled || kick_idx == pieces::KICK_TESTS - 1 {
        SPIN_FULL
    } else {
        SPIN_MINI
    }
}

/// Apply a rotation with SRS kicks. Returns (row, col, kick_idx) of the first
/// non-colliding kick candidate, or None if all five fail.
fn try_rotate(
    cells: &[u8],
    width: u32,
    height: u32,
    piece_type: u8,
    from_rot: u8,
    row: i32,
    col: i32,
    clockwise: bool,
) -> Option<(u8, i32, i32, usize)> {
    let to_rot = if clockwise { (from_rot + 1) % 4 } else { (from_rot + 3) % 4 };
    let kicks = pieces::kick_table(piece_type, from_rot, clockwise);
    for (i, &(dr, dc)) in kicks.iter().enumerate() {
        let r = row + dr as i32;
        let c = col + dc as i32;
        if piece_fits(cells, width, height, piece_type, to_rot, r, c) {
            return Some((to_rot, r, c, i));
        }
    }
    None
}

/// Enumerate every placement reachable from spawn via left/right/rotate
/// (with SRS kicks)/soft-drop, BFS over (rotation, row, col, spin) states.
/// Finds tucks, slides, and spins that straight-drop enumeration misses.
/// Paths are shortest-input; duplicate lock positions (identical cell sets)
/// keep the first found unless a later one has higher spin status.
pub fn find_placements(
    cells: &[u8],
    width: u32,
    height: u32,
    piece_type: u8,
) -> Vec<FoundPlacement> {
    find_placements_windowed(cells, width, height, piece_type, 0, width.saturating_sub(1))
}

/// Like find_placements, but restricts the BFS to origin columns near
/// [col_min, col_max] (always widened to include the spawn column). On wide
/// boards this keeps cost proportional to the active region, matching the
/// windowing the evaluator already does.
pub fn find_placements_windowed(
    cells: &[u8],
    width: u32,
    height: u32,
    piece_type: u8,
    col_min: u32,
    col_max: u32,
) -> Vec<FoundPlacement> {
    let (spawn_row, spawn_col) = spawn_state(width, piece_type);
    if !piece_fits(cells, width, height, piece_type, 0, spawn_row, spawn_col) {
        return Vec::new();
    }

    let col_lo = (col_min as i32).min(spawn_col);
    let col_hi = (col_max as i32).min(width as i32 - 1).max(spawn_col);
    let space = match StateSpace::new(height, col_lo, col_hi) {
        Some(s) => s,
        None => return Vec::new(),
    };
    let mut visited = vec![false; space.len()];
    let mut prev = vec![u32::MAX; space.len()];
    let mut prev_op = vec![0u8; space.len()];

    let start_idx = space
        .index(0, spawn_row, spawn_col, SPIN_NONE)
        .expect("spawn state in bounds");
    visited[start_idx] = true;

    let mut queue = VecDeque::with_capacity(256);
    queue.push_back((0u8, spawn_row, spawn_col, SPIN_NONE, start_idx));

    // Lock positions keyed by their absolute cell set (canonical dedup across
    // symmetric rotations of S/Z/I/O).
    let mut locks: HashMap<[(i32, i32); 4], (usize, u8, u8, i32, i32)> = HashMap::new();
    let mut lock_order: Vec<[(i32, i32); 4]> = Vec::new();

    let rotates = piece_type != pieces::O;

    while let Some((rot, row, col, spin, idx)) = queue.pop_front() {
        if !piece_fits(cells, width, height, piece_type, rot, row + 1, col)
            && fully_on_board(piece_type, rot, row)
        {
            let shape = pieces::get_shape(piece_type, rot);
            let mut key = [(0i32, 0i32); 4];
            for (i, &(dr, dc)) in shape.iter().enumerate() {
                key[i] = (row + dr as i32, col + dc as i32);
            }
            key.sort_unstable();
            match locks.get_mut(&key) {
                None => {
                    locks.insert(key, (idx, rot, spin, row, col));
                    lock_order.push(key);
                }
                Some(entry) if spin > entry.2 => {
                    *entry = (idx, rot, spin, row, col);
                }
                _ => {}
            }
        }

        let push = |op: u8,
                        n_rot: u8,
                        n_row: i32,
                        n_col: i32,
                        n_spin: u8,
                        visited: &mut Vec<bool>,
                        prev: &mut Vec<u32>,
                        prev_op: &mut Vec<u8>,
                        queue: &mut VecDeque<(u8, i32, i32, u8, usize)>| {
            if let Some(n_idx) = space.index(n_rot, n_row, n_col, n_spin) {
                if !visited[n_idx] {
                    visited[n_idx] = true;
                    prev[n_idx] = idx as u32;
                    prev_op[n_idx] = op;
                    queue.push_back((n_rot, n_row, n_col, n_spin, n_idx));
                }
            }
        };

        // Shifts and soft drop reset spin status (last-maneuver-rotation rule)
        if piece_fits(cells, width, height, piece_type, rot, row, col - 1) {
            push(MOVE_LEFT, rot, row, col - 1, SPIN_NONE, &mut visited, &mut prev, &mut prev_op, &mut queue);
        }
        if piece_fits(cells, width, height, piece_type, rot, row, col + 1) {
            push(MOVE_RIGHT, rot, row, col + 1, SPIN_NONE, &mut visited, &mut prev, &mut prev_op, &mut queue);
        }
        if piece_fits(cells, width, height, piece_type, rot, row + 1, col) {
            push(SOFT_DROP, rot, row + 1, col, SPIN_NONE, &mut visited, &mut prev, &mut prev_op, &mut queue);
        }

        if rotates {
            for &(op, cw) in &[(ROTATE_CW, true), (ROTATE_CCW, false)] {
                if let Some((n_rot, n_row, n_col, kick_idx)) =
                    try_rotate(cells, width, height, piece_type, rot, row, col, cw)
                {
                    let n_spin = if piece_type == pieces::T {
                        t_spin_status(cells, width, height, n_row, n_col, n_rot, kick_idx)
                    } else {
                        SPIN_NONE
                    };
                    push(op, n_rot, n_row, n_col, n_spin, &mut visited, &mut prev, &mut prev_op, &mut queue);
                }
            }
        }
    }

    lock_order
        .iter()
        .map(|key| {
            let &(idx, rot, spin, row, col) = locks.get(key).expect("lock recorded");
            let mut path = Vec::new();
            let mut cur = idx;
            while cur != start_idx {
                path.push(prev_op[cur]);
                cur = prev[cur] as usize;
            }
            path.reverse();
            FoundPlacement {
                placement: Placement {
                    piece_type,
                    rotation: rot,
                    col,
                    landing_row: row,
                },
                path,
                spin,
            }
        })
        .collect()
}

/// Replay a move path from spawn, mirroring engine semantics (shifts, SRS
/// rotations, one-row soft drops). Returns the final (rotation, row, col),
/// or None if any input is illegal from its position. Test/verification aid.
pub fn replay_path(
    cells: &[u8],
    width: u32,
    height: u32,
    piece_type: u8,
    path: &[u8],
) -> Option<(u8, i32, i32)> {
    let (mut row, mut col) = spawn_state(width, piece_type);
    let mut rot = 0u8;
    if !piece_fits(cells, width, height, piece_type, rot, row, col) {
        return None;
    }
    for &op in path {
        match op {
            MOVE_LEFT | MOVE_RIGHT => {
                let c = if op == MOVE_LEFT { col - 1 } else { col + 1 };
                if !piece_fits(cells, width, height, piece_type, rot, row, c) {
                    return None;
                }
                col = c;
            }
            SOFT_DROP => {
                if !piece_fits(cells, width, height, piece_type, rot, row + 1, col) {
                    return None;
                }
                row += 1;
            }
            ROTATE_CW | ROTATE_CCW => {
                let (n_rot, n_row, n_col, _) =
                    try_rotate(cells, width, height, piece_type, rot, row, col, op == ROTATE_CW)?;
                rot = n_rot;
                row = n_row;
                col = n_col;
            }
            _ => return None,
        }
    }
    Some((rot, row, col))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pieces::{EMPTY, I, J, L, O, S, T, Z};
    use crate::placement::enumerate_placements;

    const ALL_PIECES: [u8; 7] = [I, O, T, S, Z, J, L];

    const W: u32 = 10;
    const H: u32 = 20;

    fn empty_board() -> Vec<u8> {
        vec![EMPTY; (W * H) as usize]
    }

    fn set(cells: &mut [u8], row: u32, col: u32) {
        cells[(row * W + col) as usize] = I;
    }

    fn fill_row_except(cells: &mut [u8], row: u32, open: &[u32]) {
        for c in 0..W {
            if !open.contains(&c) {
                set(cells, row, c);
            }
        }
    }

    #[test]
    fn finds_all_hard_drop_placements_on_empty_board() {
        let cells = empty_board();
        for piece in ALL_PIECES {
            let found = find_placements(&cells, W, H, piece);
            for p in enumerate_placements(&cells, W, H, piece) {
                let shape = pieces::get_shape(piece, p.rotation);
                let mut key: Vec<(i32, i32)> = shape
                    .iter()
                    .map(|&(dr, dc)| (p.landing_row + dr as i32, p.col + dc as i32))
                    .collect();
                key.sort_unstable();
                let hit = found.iter().any(|f| {
                    let fs = pieces::get_shape(piece, f.placement.rotation);
                    let mut fk: Vec<(i32, i32)> = fs
                        .iter()
                        .map(|&(dr, dc)| {
                            (f.placement.landing_row + dr as i32, f.placement.col + dc as i32)
                        })
                        .collect();
                    fk.sort_unstable();
                    fk == key
                });
                assert!(hit, "piece {} rot {} col {} missing", piece, p.rotation, p.col);
            }
        }
    }

    #[test]
    fn finds_tuck_under_overhang() {
        let mut cells = empty_board();
        // Roof at row 16 over cols 4-9, supported at col 9; rows 17-19 open
        for c in 4..W {
            set(&mut cells, 16, c);
        }
        for r in 17..H {
            set(&mut cells, r, 9);
        }

        let found = find_placements(&cells, W, H, T);
        let tuck = found
            .iter()
            .find(|f| f.placement.rotation == 0 && f.placement.col == 5 && f.placement.landing_row == 18);
        assert!(tuck.is_some(), "tuck under roof not found");
        assert_eq!(tuck.unwrap().spin, SPIN_NONE, "a pure shift-tuck must never be credited as a spin");

        // Hard-drop enumeration cannot see it
        let plain = enumerate_placements(&cells, W, H, T);
        assert!(
            !plain.iter().any(|p| p.rotation == 0 && p.col == 5 && p.landing_row == 18),
            "hard-drop enumeration unexpectedly found the tuck"
        );
    }

    #[test]
    fn finds_tspin_double_with_full_status() {
        let mut cells = empty_board();
        set(&mut cells, 17, 5); // lip forcing the spin
        fill_row_except(&mut cells, 18, &[3, 4, 5]);
        fill_row_except(&mut cells, 19, &[4]);

        let found = find_placements(&cells, W, H, T);
        let tsd = found
            .iter()
            .find(|f| f.placement.rotation == 2 && f.placement.col == 3 && f.placement.landing_row == 17)
            .expect("TSD placement not found");
        assert_eq!(tsd.spin, SPIN_FULL, "TSD should be a full T-spin");

        let (_, lines) = board::simulate_place(&cells, W, H, T, 2, 17, 3);
        assert_eq!(lines, 2, "TSD should clear two lines");

        let plain = enumerate_placements(&cells, W, H, T);
        assert!(
            !plain.iter().any(|p| p.rotation == 2 && p.col == 3 && p.landing_row == 17),
            "hard-drop enumeration unexpectedly reached the slot"
        );
    }

    #[test]
    fn drop_reached_slot_is_not_a_spin() {
        let mut cells = empty_board();
        // Same notch but no lip: T can drop straight in, so no spin status
        fill_row_except(&mut cells, 18, &[3, 4, 5]);
        fill_row_except(&mut cells, 19, &[4]);

        let found = find_placements(&cells, W, H, T);
        let slot = found
            .iter()
            .find(|f| f.placement.rotation == 2 && f.placement.col == 3 && f.placement.landing_row == 17)
            .expect("slot placement not found");
        assert_eq!(slot.spin, SPIN_NONE, "straight drop must not count as a spin");
    }

    #[test]
    fn sealed_cavity_is_unreachable() {
        let mut cells = empty_board();
        // Row 18 fully sealed roof, cavity row 19 cols 3-5
        fill_row_except(&mut cells, 18, &[]);
        fill_row_except(&mut cells, 19, &[3, 4, 5]);

        for piece in ALL_PIECES {
            let found = find_placements(&cells, W, H, piece);
            for f in &found {
                assert!(
                    f.placement.landing_row < 18,
                    "piece {} reached sealed cavity at row {}",
                    piece,
                    f.placement.landing_row
                );
            }
        }
    }

    #[test]
    fn paths_replay_to_their_placements() {
        // Deterministic LCG boards; every found path must replay exactly
        let mut seed: u64 = 0x9E3779B97F4A7C15;
        let mut next = move || {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            (seed >> 33) as u32
        };

        for _ in 0..20 {
            let mut cells = empty_board();
            for row in 12..H {
                for col in 0..W {
                    if next() % 100 < 45 {
                        set(&mut cells, row, col);
                    }
                }
            }
            for piece in ALL_PIECES {
                for f in find_placements(&cells, W, H, piece) {
                    let end = replay_path(&cells, W, H, piece, &f.path)
                        .expect("path must be legal");
                    assert_eq!(
                        end,
                        (f.placement.rotation, f.placement.landing_row, f.placement.col),
                        "path did not arrive at placement"
                    );
                    assert!(
                        board::check_collision(
                            &cells, W, H, piece, f.placement.rotation,
                            f.placement.landing_row + 1, f.placement.col
                        ),
                        "placement is not locked"
                    );
                }
            }
        }
    }

    #[test]
    fn high_stack_placements_stay_fully_on_board() {
        let mut cells = empty_board();
        // Stack up to row 2, leaving a jagged top: locks happen near row 0
        for row in 2..H {
            for col in 0..W {
                if (row + col) % 4 != 0 {
                    set(&mut cells, row, col);
                }
            }
        }
        for piece in ALL_PIECES {
            for f in find_placements(&cells, W, H, piece) {
                let shape = pieces::get_shape(piece, f.placement.rotation);
                for &(dr, dc) in shape.iter() {
                    let r = f.placement.landing_row + dr as i32;
                    let c = f.placement.col + dc as i32;
                    assert!(r >= 0 && r < H as i32, "cell row {} out of bounds", r);
                    assert!(c >= 0 && c < W as i32, "cell col {} out of bounds", c);
                }
            }
        }
    }

    #[test]
    fn t_spin_status_table() {
        // Corner order (tl, tr, bl, br); front pair by rotation:
        // rot0=tl&tr, rot1=tr&br, rot2=bl&br, rot3=tl&bl
        struct Case {
            name: &'static str,
            corners: (bool, bool, bool, bool),
            rotation: u8,
            kick_idx: usize,
            expected: u8,
        }
        let cases = [
            Case { name: "no corners", corners: (false, false, false, false), rotation: 0, kick_idx: 0, expected: SPIN_NONE },
            Case { name: "two corners", corners: (true, true, false, false), rotation: 0, kick_idx: 0, expected: SPIN_NONE },
            Case { name: "rot0 front pair full", corners: (true, true, true, false), rotation: 0, kick_idx: 0, expected: SPIN_FULL },
            Case { name: "rot0 one front is mini", corners: (true, false, true, true), rotation: 0, kick_idx: 0, expected: SPIN_MINI },
            Case { name: "rot0 mini promoted by test-5", corners: (true, false, true, true), rotation: 0, kick_idx: pieces::KICK_TESTS - 1, expected: SPIN_FULL },
            Case { name: "all corners always full", corners: (true, true, true, true), rotation: 1, kick_idx: 0, expected: SPIN_FULL },
            Case { name: "rot1 one front is mini", corners: (true, true, true, false), rotation: 1, kick_idx: 0, expected: SPIN_MINI },
            Case { name: "rot1 mini promoted by test-5", corners: (true, true, true, false), rotation: 1, kick_idx: pieces::KICK_TESTS - 1, expected: SPIN_FULL },
            Case { name: "rot2 one front is mini", corners: (true, true, true, false), rotation: 2, kick_idx: 0, expected: SPIN_MINI },
            Case { name: "rot3 one front is mini", corners: (true, true, false, true), rotation: 3, kick_idx: 0, expected: SPIN_MINI },
            Case { name: "rot3 mini promoted by test-5", corners: (true, true, false, true), rotation: 3, kick_idx: pieces::KICK_TESTS - 1, expected: SPIN_FULL },
        ];
        for c in cases {
            let mut cells = empty_board();
            let (row, col) = (5i32, 5i32);
            let (tl, tr, bl, br) = c.corners;
            if tl { set(&mut cells, row as u32, col as u32); }
            if tr { set(&mut cells, row as u32, (col + 2) as u32); }
            if bl { set(&mut cells, (row + 2) as u32, col as u32); }
            if br { set(&mut cells, (row + 2) as u32, (col + 2) as u32); }
            let status = t_spin_status(&cells, W, H, row, col, c.rotation, c.kick_idx);
            assert_eq!(status, c.expected, "case failed: {}", c.name);
        }
    }

    #[test]
    fn o_piece_finds_tuck_via_shifts_only() {
        let mut cells = empty_board();
        for c in 4..W {
            set(&mut cells, 16, c);
        }
        for r in 17..H {
            set(&mut cells, r, 9);
        }

        let found = find_placements(&cells, W, H, O);
        let tuck = found
            .iter()
            .find(|f| f.placement.landing_row == 18 && (3..=6).contains(&f.placement.col));
        assert!(tuck.is_some(), "O piece should reach the pocket under the roof via pure shifts");
        assert_eq!(tuck.unwrap().spin, SPIN_NONE);

        let plain = enumerate_placements(&cells, W, H, O);
        assert!(
            !plain.iter().any(|p| p.landing_row == 18 && (3..=6).contains(&p.col)),
            "hard-drop enumeration unexpectedly found the O tuck"
        );
    }

    #[test]
    fn spin_only_credited_when_last_move_is_a_rotation() {
        let mut seed: u64 = 0xD1B54A32D192ED03;
        let mut next = move || {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            (seed >> 33) as u32
        };
        for _ in 0..20 {
            let mut cells = empty_board();
            for row in 12..H {
                for col in 0..W {
                    if next() % 100 < 45 {
                        set(&mut cells, row, col);
                    }
                }
            }
            for f in find_placements(&cells, W, H, T) {
                if f.spin != SPIN_NONE {
                    let last = *f.path.last().expect("a spin requires at least one move");
                    assert!(
                        last == ROTATE_CW || last == ROTATE_CCW,
                        "spin {} but last op was {}",
                        f.spin,
                        last
                    );
                }
            }
        }
    }

    #[test]
    fn wide_boards_work_without_panicking() {
        let width = 200u32;
        let height = 20u32;
        let cells = vec![EMPTY; (width * height) as usize];
        for piece in ALL_PIECES {
            let found = find_placements(&cells, width, height, piece);
            assert!(!found.is_empty(), "piece {} found nothing on wide board", piece);
            for f in &found {
                assert!(f.placement.col >= -3 && f.placement.col < width as i32);
            }
        }
    }

    #[test]
    fn windowed_search_stays_in_window_but_includes_spawn() {
        let width = 40u32;
        let cells = vec![EMPTY; (width * H) as usize];
        let found = find_placements_windowed(&cells, width, H, T, 5, 12);
        assert!(!found.is_empty());
        // Window widens to include spawn col 18, plus PAD on each side
        for f in &found {
            assert!(
                f.placement.col >= 1 && f.placement.col <= 22,
                "placement col {} escaped padded window",
                f.placement.col
            );
        }
        let (_, spawn_col) = spawn_state(width, T);
        assert!(found.iter().any(|f| f.placement.col == spawn_col));
    }

    #[test]
    fn spawn_collision_returns_empty() {
        let mut cells = empty_board();
        for r in 0..3 {
            fill_row_except(&mut cells, r, &[]);
        }
        assert!(find_placements(&cells, W, H, T).is_empty());
    }

    #[test]
    fn spawn_state_matches_engine_formula() {
        // engine.js: col = floor((width - pieceWidth) / 2), row 0
        assert_eq!(spawn_state(10, I), (0, 3)); // extent 4
        assert_eq!(spawn_state(10, O), (0, 4)); // extent 2
        assert_eq!(spawn_state(10, T), (0, 3)); // extent 3
        assert_eq!(spawn_state(40, T), (0, 18));
    }

    #[test]
    #[ignore] // perf gate: run with --release -- --ignored
    fn movegen_fast_enough_on_wide_board() {
        let width = 40u32;
        let height = 80u32;
        let mut cells = vec![EMPTY; (width * height) as usize];
        for row in 50..height {
            for col in 0..width {
                if (row + col) % 3 != 0 {
                    cells[(row * width + col) as usize] = I;
                }
            }
        }
        let start = std::time::Instant::now();
        for piece in 1..=7u8 {
            let found = find_placements(&cells, width, height, piece);
            assert!(!found.is_empty());
        }
        let elapsed = start.elapsed();
        assert!(elapsed.as_millis() < 10, "movegen too slow: {:?}", elapsed);
    }
}
