use rand::Rng;

use crate::pieces;

/// 14-bag randomizer matching the JS frontend (types.js:86-95).
/// Each bag contains exactly 2 copies of all 7 piece types, Fisher-Yates shuffled.
pub struct BagRandomizer {
    queue: Vec<u8>,
}

impl BagRandomizer {
    pub fn new(rng: &mut impl Rng) -> Self {
        let mut bag = Self { queue: Vec::with_capacity(28) };
        bag.refill(rng);
        bag
    }

    pub fn next_piece(&mut self, rng: &mut impl Rng) -> u8 {
        if self.queue.is_empty() {
            self.refill(rng);
        }
        self.queue.remove(0)
    }

    pub fn peek_queue(&self, n: usize) -> Vec<u8> {
        self.queue.iter().take(n).copied().collect()
    }

    fn refill(&mut self, rng: &mut impl Rng) {
        let mut bag: Vec<u8> = (1..=pieces::PIECE_COUNT as u8)
            .chain(1..=pieces::PIECE_COUNT as u8)
            .collect();
        // Fisher-Yates shuffle
        for i in (1..bag.len()).rev() {
            let j = rng.random_range(0..=i);
            bag.swap(i, j);
        }
        self.queue.extend(bag);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::rngs::SmallRng;

    #[test]
    fn bag_contains_two_of_each() {
        let mut rng = SmallRng::seed_from_u64(42);
        let mut bag = BagRandomizer::new(&mut rng);
        let mut counts = [0u32; 8]; // index 0 unused
        for _ in 0..14 {
            let p = bag.next_piece(&mut rng);
            counts[p as usize] += 1;
        }
        for t in 1..=7 {
            assert_eq!(counts[t], 2, "Piece type {} should appear exactly twice", t);
        }
    }

    #[test]
    fn peek_returns_upcoming() {
        let mut rng = SmallRng::seed_from_u64(42);
        let bag = BagRandomizer::new(&mut rng);
        let peeked = bag.peek_queue(5);
        assert_eq!(peeked.len(), 5);
        for &p in &peeked {
            assert!(p >= 1 && p <= 7);
        }
    }

    #[test]
    fn continuous_draw_stays_valid() {
        let mut rng = SmallRng::seed_from_u64(123);
        let mut bag = BagRandomizer::new(&mut rng);
        for _ in 0..100 {
            let p = bag.next_piece(&mut rng);
            assert!(p >= 1 && p <= 7, "Got invalid piece type {}", p);
        }
    }
}
