use crate::pieces::{self, EMPTY};

/// Get a cell value. Returns EMPTY for rows above the board (row < 0).
/// Returns None for out-of-bounds (wall/floor).
#[inline]
pub fn get_cell(cells: &[u8], width: u32, height: u32, row: i32, col: i32) -> Option<u8> {
    if row < 0 {
        return Some(EMPTY);
    }
    if row >= height as i32 || col < 0 || col >= width as i32 {
        return None;
    }
    Some(cells[(row as u32 * width + col as u32) as usize])
}

/// Check if a piece at (row, col) with given type and rotation collides with
/// the board boundaries or existing cells.
pub fn check_collision(
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
        match get_cell(cells, width, height, r, c) {
            None => return true,             // out of bounds
            Some(v) if v != EMPTY => return true, // occupied
            _ => {}
        }
    }
    false
}

/// Find the landing row for a piece dropped from the top at a given column and rotation.
/// Returns the row where the piece would lock.
pub fn drop_row(
    cells: &[u8],
    width: u32,
    height: u32,
    piece_type: u8,
    rotation: u8,
    col: i32,
) -> i32 {
    let mut row = 0i32;
    loop {
        if check_collision(cells, width, height, piece_type, rotation, row + 1, col) {
            return row;
        }
        row += 1;
    }
}

/// Simulate placing a piece on the board and clearing lines.
/// Returns (new_cells, lines_cleared).
pub fn simulate_place(
    cells: &[u8],
    width: u32,
    height: u32,
    piece_type: u8,
    rotation: u8,
    row: i32,
    col: i32,
) -> (Vec<u8>, u32) {
    let w = width as usize;
    let h = height as usize;
    let mut new_cells = cells.to_vec();

    // Place the piece
    let shape = pieces::get_shape(piece_type, rotation);
    for &(dr, dc) in shape.iter() {
        let r = (row + dr as i32) as usize;
        let c = (col + dc as i32) as usize;
        if r < h && c < w {
            new_cells[r * w + c] = piece_type;
        }
    }

    // Find full rows
    let mut full_rows = Vec::new();
    for r in 0..h {
        let start = r * w;
        if new_cells[start..start + w].iter().all(|&v| v != EMPTY) {
            full_rows.push(r);
        }
    }

    if full_rows.is_empty() {
        return (new_cells, 0);
    }

    let lines_cleared = full_rows.len() as u32;

    // Clear lines: copy non-full rows to the bottom
    let mut result = vec![EMPTY; w * h];
    let mut dest_row = h - 1;

    for src_row in (0..h).rev() {
        if full_rows.contains(&src_row) {
            continue;
        }
        let src_start = src_row * w;
        let dest_start = dest_row * w;
        result[dest_start..dest_start + w].copy_from_slice(&new_cells[src_start..src_start + w]);
        if dest_row == 0 {
            break;
        }
        dest_row -= 1;
    }

    (result, lines_cleared)
}

/// Calculate the height of a column (number of rows from top to highest filled cell).
/// Returns 0 for an empty column.
pub fn column_height(cells: &[u8], width: u32, height: u32, col: u32) -> u32 {
    let w = width as usize;
    let c = col as usize;
    for row in 0..height as usize {
        if cells[row * w + c] != EMPTY {
            return height - row as u32;
        }
    }
    0
}

/// Count holes: empty cells that have at least one filled cell above them in the same column.
pub fn count_holes(cells: &[u8], width: u32, height: u32) -> u32 {
    let w = width as usize;
    let h = height as usize;
    let mut holes = 0u32;

    for col in 0..w {
        let mut found_filled = false;
        for row in 0..h {
            let cell = cells[row * w + col];
            if cell != EMPTY {
                found_filled = true;
            } else if found_filled {
                holes += 1;
            }
        }
    }
    holes
}

/// Sum of absolute height differences between adjacent columns.
pub fn bumpiness(cells: &[u8], width: u32, height: u32) -> u32 {
    if width < 2 {
        return 0;
    }
    let mut bump = 0u32;
    let mut prev_h = column_height(cells, width, height, 0);
    for col in 1..width {
        let h = column_height(cells, width, height, col);
        bump += prev_h.abs_diff(h);
        prev_h = h;
    }
    bump
}

/// Sum of all column heights.
pub fn aggregate_height(cells: &[u8], width: u32, height: u32) -> u32 {
    let mut total = 0u32;
    for col in 0..width {
        total += column_height(cells, width, height, col);
    }
    total
}

/// Height of the tallest column.
pub fn max_height(cells: &[u8], width: u32, height: u32) -> u32 {
    let mut max = 0u32;
    for col in 0..width {
        let h = column_height(cells, width, height, col);
        if h > max {
            max = h;
        }
    }
    max
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pieces::{I, T, S};

    fn empty_board(width: u32, height: u32) -> Vec<u8> {
        vec![EMPTY; (width * height) as usize]
    }

    fn set_cell(cells: &mut [u8], width: u32, row: u32, col: u32, val: u8) {
        cells[(row * width + col) as usize] = val;
    }

    // -- get_cell tests --

    #[test]
    fn get_cell_empty_board() {
        let cells = empty_board(10, 20);
        assert_eq!(get_cell(&cells, 10, 20, 5, 5), Some(EMPTY));
    }

    #[test]
    fn get_cell_above_board_returns_empty() {
        let cells = empty_board(10, 20);
        assert_eq!(get_cell(&cells, 10, 20, -1, 5), Some(EMPTY));
        assert_eq!(get_cell(&cells, 10, 20, -10, 0), Some(EMPTY));
    }

    #[test]
    fn get_cell_out_of_bounds_returns_none() {
        let cells = empty_board(10, 20);
        assert_eq!(get_cell(&cells, 10, 20, 20, 0), None);  // below
        assert_eq!(get_cell(&cells, 10, 20, 0, -1), None);  // left
        assert_eq!(get_cell(&cells, 10, 20, 0, 10), None);  // right
    }

    #[test]
    fn get_cell_filled() {
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 5, 3, T);
        assert_eq!(get_cell(&cells, 10, 20, 5, 3), Some(T));
    }

    // -- check_collision tests --

    #[test]
    fn no_collision_on_empty_board() {
        let cells = empty_board(10, 20);
        assert!(!check_collision(&cells, 10, 20, T, 0, 0, 3));
    }

    #[test]
    fn collision_with_wall() {
        let cells = empty_board(10, 20);
        // I piece horizontal at col -1 would go out of bounds
        assert!(check_collision(&cells, 10, 20, I, 0, 0, -1));
    }

    #[test]
    fn collision_with_right_wall() {
        let cells = empty_board(10, 20);
        // I piece horizontal (cols 0-3 relative) at col 8 => col 11 out of bounds
        assert!(check_collision(&cells, 10, 20, I, 0, 0, 8));
    }

    #[test]
    fn collision_with_floor() {
        let cells = empty_board(10, 20);
        // T piece at row 19: shape has cells at row+1, so row 20 = out of bounds
        assert!(check_collision(&cells, 10, 20, T, 0, 19, 3));
    }

    #[test]
    fn collision_with_existing_piece() {
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 19, 4, S);
        // T piece rotation 0 at row 18, col 3: occupies (18,4),(19,3),(19,4),(19,5)
        // (19,4) is occupied
        assert!(check_collision(&cells, 10, 20, T, 0, 18, 3));
    }

    // -- drop_row tests --

    #[test]
    fn drop_on_empty_board() {
        let cells = empty_board(10, 20);
        // T piece rotation 0 at col 3: lowest cell is row+1, so drops to row 18
        let row = drop_row(&cells, 10, 20, T, 0, 3);
        assert_eq!(row, 18);
    }

    #[test]
    fn drop_onto_existing_pieces() {
        let mut cells = empty_board(10, 20);
        // Fill row 19 entirely
        for c in 0..10 {
            set_cell(&mut cells, 10, 19, c, I);
        }
        // T piece should land one row above
        let row = drop_row(&cells, 10, 20, T, 0, 3);
        assert_eq!(row, 17);
    }

    #[test]
    fn drop_i_piece_vertical() {
        let cells = empty_board(10, 20);
        // I piece rotation 1 (vertical): occupies rows 0-3 at col+2
        let row = drop_row(&cells, 10, 20, I, 1, 3);
        // Shape cells at rows 0-3 relative, so landing row = 16 (rows 16-19)
        assert_eq!(row, 16);
    }

    // -- simulate_place tests --

    #[test]
    fn place_piece_on_empty_board() {
        let cells = empty_board(10, 20);
        let (new_cells, lines) = simulate_place(&cells, 10, 20, T, 0, 18, 3);
        assert_eq!(lines, 0);
        // T at row 18, col 3, rotation 0: (18,4), (19,3), (19,4), (19,5)
        assert_eq!(new_cells[18 * 10 + 4], T);
        assert_eq!(new_cells[19 * 10 + 3], T);
        assert_eq!(new_cells[19 * 10 + 4], T);
        assert_eq!(new_cells[19 * 10 + 5], T);
    }

    #[test]
    fn place_piece_clears_line() {
        let mut cells = empty_board(10, 20);
        // Fill row 19 except col 4,5,6
        for c in 0..10 {
            if c != 4 {
                set_cell(&mut cells, 10, 19, c, I);
            }
        }
        // Also fill positions that T will complete
        // T rotation 0 at row 18, col 3: fills (18,4),(19,3),(19,4),(19,5)
        // row 19 already has 0-3 and 5-9 filled, T adds col 4 => row 19 full
        // But T also adds (19,3) and (19,5) which are already filled... that's fine
        // Actually (19,3) is already I and we'd overwrite with T, that's ok
        let (_, lines) = simulate_place(&cells, 10, 20, T, 0, 18, 3);
        assert_eq!(lines, 1);
    }

    // -- column_height tests --

    #[test]
    fn column_height_empty() {
        let cells = empty_board(10, 20);
        assert_eq!(column_height(&cells, 10, 20, 5), 0);
    }

    #[test]
    fn column_height_bottom_row() {
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 19, 3, T);
        assert_eq!(column_height(&cells, 10, 20, 3), 1);
    }

    #[test]
    fn column_height_mid_board() {
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 15, 3, T);
        assert_eq!(column_height(&cells, 10, 20, 3), 5);
    }

    // -- count_holes tests --

    #[test]
    fn no_holes_empty_board() {
        let cells = empty_board(10, 20);
        assert_eq!(count_holes(&cells, 10, 20), 0);
    }

    #[test]
    fn no_holes_flat_stack() {
        let mut cells = empty_board(10, 20);
        // Fill rows 18-19 completely
        for r in 18..20 {
            for c in 0..10 {
                set_cell(&mut cells, 10, r, c, I);
            }
        }
        assert_eq!(count_holes(&cells, 10, 20), 0);
    }

    #[test]
    fn one_hole() {
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 18, 3, T);
        // row 19, col 3 is empty with filled cell above -> 1 hole
        assert_eq!(count_holes(&cells, 10, 20), 1);
    }

    #[test]
    fn multiple_holes() {
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 17, 3, T);
        // rows 18 and 19 at col 3 are empty => 2 holes
        assert_eq!(count_holes(&cells, 10, 20), 2);
    }

    // -- bumpiness tests --

    #[test]
    fn bumpiness_empty_board() {
        let cells = empty_board(10, 20);
        assert_eq!(bumpiness(&cells, 10, 20), 0);
    }

    #[test]
    fn bumpiness_flat_surface() {
        let mut cells = empty_board(10, 20);
        for c in 0..10 {
            set_cell(&mut cells, 10, 19, c, I);
        }
        assert_eq!(bumpiness(&cells, 10, 20), 0);
    }

    #[test]
    fn bumpiness_single_column() {
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 19, 0, I);
        // col 0 height 1, col 1 height 0 => diff 1, rest all 0 => total 1
        assert_eq!(bumpiness(&cells, 10, 20), 1);
    }

    // -- aggregate_height tests --

    #[test]
    fn aggregate_height_empty() {
        let cells = empty_board(10, 20);
        assert_eq!(aggregate_height(&cells, 10, 20), 0);
    }

    #[test]
    fn aggregate_height_one_row() {
        let mut cells = empty_board(10, 20);
        for c in 0..10 {
            set_cell(&mut cells, 10, 19, c, I);
        }
        // each column height = 1, 10 columns => 10
        assert_eq!(aggregate_height(&cells, 10, 20), 10);
    }

    // -- max_height tests --

    #[test]
    fn max_height_empty() {
        let cells = empty_board(10, 20);
        assert_eq!(max_height(&cells, 10, 20), 0);
    }

    #[test]
    fn max_height_one_tall_column() {
        let mut cells = empty_board(10, 20);
        set_cell(&mut cells, 10, 10, 5, T);
        assert_eq!(max_height(&cells, 10, 20), 10);
    }
}
