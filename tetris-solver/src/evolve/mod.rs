pub mod individual;

use rand::Rng;
use rand::SeedableRng;
use rand::rngs::SmallRng;
use rayon::prelude::*;

use crate::game_runner;
use crate::params::{FlatParams, FourWideParams, SolverParams};
use crate::strategy::Strategy;
use individual::Individual;

/// Configuration for the evolutionary search.
#[derive(Debug, Clone)]
pub struct EvolutionConfig {
    pub strategy: Strategy,
    pub generations: usize,
    pub mu: usize,           // parent count
    pub lambda: usize,       // offspring per generation
    pub sigma: f64,          // initial mutation strength
    pub sigma_decay: f64,    // sigma *= sigma_decay each generation
    pub pieces_per_game: u32,
    pub games_per_eval: usize,
    pub widths: Vec<u32>,    // board widths to evaluate
    pub height: u32,         // board height (fixed for all widths)
    pub target_fill: f64,
    pub seed: u64,
}

impl Default for EvolutionConfig {
    fn default() -> Self {
        Self {
            strategy: Strategy::Flat,
            generations: 50,
            mu: 10,
            lambda: 40,
            sigma: 0.3,
            sigma_decay: 0.995,
            pieces_per_game: 500,
            games_per_eval: 3,
            widths: vec![10, 20, 40],
            height: 20,
            target_fill: 0.6,
            seed: 42,
        }
    }
}

/// Evaluate an individual's fitness: mean lines_per_piece across all (width, game) combos.
///
/// Pieces per game scales with board width: `config.pieces_per_game * (width / 10)`.
fn evaluate_fitness(
    individual: &Individual,
    config: &EvolutionConfig,
    generation: usize,
) -> f64 {
    let (fp, fwp, sp) = extract_params(individual, config.strategy);

    let mut total_lines: f64 = 0.0;
    let mut total_pieces: f64 = 0.0;

    for &width in &config.widths {
        let height = config.height;
        let scaled_pieces = config.pieces_per_game * (width / 10).max(1);
        for game_idx in 0..config.games_per_eval {
            let game_seed = config.seed
                .wrapping_add((generation as u64) * 100_000)
                .wrapping_add((width as u64) * 1_000)
                .wrapping_add(game_idx as u64);
            let mut rng = SmallRng::seed_from_u64(game_seed);

            let result = game_runner::run_game(
                width, height, scaled_pieces,
                config.strategy, &sp, &fp, &fwp,
                config.target_fill, &mut rng,
            );

            total_lines += result.lines_cleared as f64;
            total_pieces += result.pieces_placed as f64;
        }
    }

    if total_pieces > 0.0 {
        total_lines / total_pieces
    } else {
        0.0
    }
}

/// Extract params from individual genes based on strategy.
fn extract_params(
    individual: &Individual,
    strategy: Strategy,
) -> (FlatParams, FourWideParams, SolverParams) {
    match strategy {
        Strategy::Flat => {
            let (fp, sp) = individual.to_flat_params();
            (fp, FourWideParams::default(), sp)
        }
        Strategy::FourWide => {
            let (fwp, sp) = individual.to_fw_params();
            (FlatParams::default(), fwp, sp)
        }
    }
}

/// Evaluate a batch of individuals in parallel using rayon.
fn evaluate_batch(individuals: &mut [Individual], config: &EvolutionConfig, generation: usize) {
    let fitnesses: Vec<f64> = individuals
        .par_iter()
        .map(|ind| evaluate_fitness(ind, config, generation))
        .collect();
    for (ind, fitness) in individuals.iter_mut().zip(fitnesses) {
        ind.fitness = fitness;
    }
}

/// Run the (mu+lambda)-ES evolutionary search with parallel fitness evaluation.
pub fn run_evolution(config: &EvolutionConfig) -> Individual {
    let mut rng = SmallRng::seed_from_u64(config.seed);
    let mut sigma = config.sigma;

    // Initialize parents: first is defaults, rest are mutated defaults
    let mut parents: Vec<Individual> = Vec::with_capacity(config.mu);
    let default_ind = Individual::from_defaults(config.strategy);
    parents.push(default_ind.clone());
    for _ in 1..config.mu {
        parents.push(default_ind.mutate(sigma, &mut rng));
    }

    // Evaluate initial parents in parallel
    eprintln!("Evaluating initial population ({} parents)...", config.mu);
    evaluate_batch(&mut parents, config, 0);
    parents.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap());

    eprintln!(
        "gen 0: best={:.6} median={:.6} worst={:.6} sigma={:.4}",
        parents[0].fitness,
        parents[config.mu / 2].fitness,
        parents[config.mu - 1].fitness,
        sigma,
    );

    for generation in 1..=config.generations {
        // Generate offspring (sequential — RNG is fast)
        let mut offspring: Vec<Individual> = Vec::with_capacity(config.lambda);
        for _ in 0..config.lambda {
            let parent_idx = rng.random_range(0..config.mu);
            let child = if rng.random_bool(0.8) {
                parents[parent_idx].mutate(sigma, &mut rng)
            } else {
                let other_idx = rng.random_range(0..config.mu);
                let crossed = parents[parent_idx].crossover(&parents[other_idx], &mut rng);
                crossed.mutate(sigma * 0.5, &mut rng)
            };
            offspring.push(child);
        }

        // Evaluate offspring in parallel
        evaluate_batch(&mut offspring, config, generation);

        // (mu + lambda) selection
        let mut combined = parents;
        combined.extend(offspring);
        combined.sort_by(|a, b| b.fitness.partial_cmp(&a.fitness).unwrap());
        combined.truncate(config.mu);
        parents = combined;

        sigma *= config.sigma_decay;

        eprintln!(
            "gen {}: best={:.6} median={:.6} worst={:.6} sigma={:.4}",
            generation,
            parents[0].fitness,
            parents[config.mu / 2].fitness,
            parents[config.mu - 1].fitness,
            sigma,
        );
    }

    parents.into_iter().next().unwrap()
}

/// Evaluate the default parameters and return fitness.
pub fn evaluate_defaults(config: &EvolutionConfig) -> f64 {
    let default_ind = Individual::from_defaults(config.strategy);
    evaluate_fitness(&default_ind, config, 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_have_positive_fitness() {
        let config = EvolutionConfig {
            generations: 0,
            mu: 2,
            lambda: 2,
            pieces_per_game: 50,
            games_per_eval: 1,
            widths: vec![10],
            ..Default::default()
        };
        let fitness = evaluate_defaults(&config);
        assert!(fitness > 0.0, "Default fitness should be positive, got {}", fitness);
    }

    #[test]
    fn evolution_completes() {
        let config = EvolutionConfig {
            generations: 2,
            mu: 3,
            lambda: 6,
            pieces_per_game: 30,
            games_per_eval: 1,
            widths: vec![10],
            ..Default::default()
        };
        let best = run_evolution(&config);
        assert!(best.fitness.is_finite());
        assert!(best.fitness > 0.0);
    }
}
