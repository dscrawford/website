/// AI strategy/personality for the Tetris solver.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Strategy {
    /// Keep the board flat, grow to target fill, then clear lines.
    Flat = 0,
    /// Build 3-column towers flanking a 4-wide centered well.
    ThreeTower = 1,
}

impl Strategy {
    pub fn from_u8(v: u8) -> Self {
        match v {
            1 => Strategy::ThreeTower,
            _ => Strategy::Flat,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_u8_flat() {
        assert_eq!(Strategy::from_u8(0), Strategy::Flat);
    }

    #[test]
    fn from_u8_three_tower() {
        assert_eq!(Strategy::from_u8(1), Strategy::ThreeTower);
    }

    #[test]
    fn from_u8_unknown_defaults_to_flat() {
        assert_eq!(Strategy::from_u8(255), Strategy::Flat);
    }
}
