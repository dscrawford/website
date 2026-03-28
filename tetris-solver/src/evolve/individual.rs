use rand::Rng;

use crate::params::{FlatParams, FourWideParams, SolverParams};
use crate::strategy::Strategy;

/// Box-Muller transform: generate a standard normal sample from two uniform samples.
fn rand_normal(rng: &mut impl Rng) -> f64 {
    let u1: f64 = rng.random_range(1e-10_f64..1.0_f64);
    let u2: f64 = rng.random_range(0.0_f64..std::f64::consts::TAU);
    (-2.0 * u1.ln()).sqrt() * u2.cos()
}

#[derive(Debug, Clone)]
pub struct Individual {
    pub genes: Vec<f64>,
    pub fitness: f64,
}

impl Individual {
    /// Create an individual from default Flat strategy parameters.
    pub fn from_flat_defaults() -> Self {
        let fp = FlatParams::default();
        let sp = SolverParams::default();
        let mut genes = fp.to_vec();
        genes.extend(sp.to_vec());
        Self { genes, fitness: f64::NEG_INFINITY }
    }

    /// Create an individual from default FourWide strategy parameters.
    pub fn from_fw_defaults() -> Self {
        let fwp = FourWideParams::default();
        let sp = SolverParams::default();
        let mut genes = fwp.to_vec();
        genes.extend(sp.to_vec());
        Self { genes, fitness: f64::NEG_INFINITY }
    }

    /// Create from defaults for a given strategy.
    pub fn from_defaults(strategy: Strategy) -> Self {
        match strategy {
            Strategy::Flat => Self::from_flat_defaults(),
            Strategy::FourWide => Self::from_fw_defaults(),
        }
    }

    /// Extract Flat strategy params from genes.
    pub fn to_flat_params(&self) -> (FlatParams, SolverParams) {
        let fp = FlatParams::from_vec(&self.genes[..FlatParams::GENE_COUNT]);
        let sp = SolverParams::from_vec(&self.genes[FlatParams::GENE_COUNT..]);
        (fp, sp)
    }

    /// Extract FourWide strategy params from genes.
    pub fn to_fw_params(&self) -> (FourWideParams, SolverParams) {
        let fwp = FourWideParams::from_vec(&self.genes[..FourWideParams::GENE_COUNT]);
        let sp = SolverParams::from_vec(&self.genes[FourWideParams::GENE_COUNT..]);
        (fwp, sp)
    }

    /// Gaussian mutation: each gene perturbed by N(0, sigma * (|gene| * 0.1 + 0.01)).
    pub fn mutate(&self, sigma: f64, rng: &mut impl Rng) -> Self {
        let genes = self
            .genes
            .iter()
            .map(|&g| {
                let scale = sigma * (g.abs() * 0.1 + 0.01);
                let noise = rand_normal(rng);
                g + scale * noise
            })
            .collect();
        Self { genes, fitness: f64::NEG_INFINITY }
    }

    /// Uniform crossover: 50/50 per gene from self or other.
    pub fn crossover(&self, other: &Self, rng: &mut impl Rng) -> Self {
        let genes = self
            .genes
            .iter()
            .zip(other.genes.iter())
            .map(|(&a, &b)| if rng.random_bool(0.5) { a } else { b })
            .collect();
        Self { genes, fitness: f64::NEG_INFINITY }
    }

    /// Gene count for a strategy.
    pub fn gene_count(strategy: Strategy) -> usize {
        match strategy {
            Strategy::Flat => FlatParams::GENE_COUNT + SolverParams::GENE_COUNT,
            Strategy::FourWide => FourWideParams::GENE_COUNT + SolverParams::GENE_COUNT,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use rand::rngs::SmallRng;

    #[test]
    fn flat_defaults_roundtrip() {
        let ind = Individual::from_flat_defaults();
        let (fp, sp) = ind.to_flat_params();
        let fp_default = FlatParams::default();
        let sp_default = SolverParams::default();
        assert_eq!(fp.to_vec(), fp_default.to_vec());
        assert_eq!(sp.to_vec(), sp_default.to_vec());
    }

    #[test]
    fn fw_defaults_roundtrip() {
        let ind = Individual::from_fw_defaults();
        let (fwp, sp) = ind.to_fw_params();
        assert_eq!(fwp.to_vec(), FourWideParams::default().to_vec());
        assert_eq!(sp.to_vec(), SolverParams::default().to_vec());
    }

    #[test]
    fn mutation_changes_genes() {
        let mut rng = SmallRng::seed_from_u64(42);
        let ind = Individual::from_flat_defaults();
        let mutated = ind.mutate(0.3, &mut rng);
        assert_ne!(ind.genes, mutated.genes);
    }

    #[test]
    fn crossover_mixes_parents() {
        let mut rng = SmallRng::seed_from_u64(42);
        let a = Individual::from_flat_defaults();
        let b = a.mutate(1.0, &mut rng);
        let child = a.crossover(&b, &mut rng);
        // Child should have some genes from a and some from b
        let from_a = child.genes.iter().zip(a.genes.iter()).filter(|(c, a)| *c == *a).count();
        let from_b = child.genes.iter().zip(b.genes.iter()).filter(|(c, b)| *c == *b).count();
        assert!(from_a > 0 && from_b > 0, "Crossover should mix parents");
    }

    #[test]
    fn gene_count_matches() {
        let flat = Individual::from_flat_defaults();
        assert_eq!(flat.genes.len(), Individual::gene_count(Strategy::Flat));
        let fw = Individual::from_fw_defaults();
        assert_eq!(fw.genes.len(), Individual::gene_count(Strategy::FourWide));
    }
}
