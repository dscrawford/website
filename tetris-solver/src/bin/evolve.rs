use std::env;

use tetris_solver::evolve::{self, EvolutionConfig};
use tetris_solver::strategy::Strategy;

fn arg_value<'a>(args: &'a [String], i: &mut usize) -> &'a str {
    *i += 1;
    match args.get(*i) {
        Some(v) => v,
        None => {
            eprintln!("Missing value for {}", args[*i - 1]);
            std::process::exit(1);
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let mut config = EvolutionConfig::default();

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--strategy" => {
                config.strategy = match arg_value(&args, &mut i) {
                    "fourwide" | "4wide" | "fw" => Strategy::FourWide,
                    _ => Strategy::Flat,
                };
            }
            "--generations" => {
                config.generations = arg_value(&args, &mut i).parse().expect("invalid --generations");
            }
            "--mu" => {
                config.mu = arg_value(&args, &mut i).parse().expect("invalid --mu");
                assert!(config.mu >= 1, "--mu must be >= 1");
            }
            "--lambda" => {
                config.lambda = arg_value(&args, &mut i).parse().expect("invalid --lambda");
                assert!(config.lambda >= 1, "--lambda must be >= 1");
            }
            "--pieces" => {
                config.pieces_per_game = arg_value(&args, &mut i).parse().expect("invalid --pieces");
            }
            "--games" => {
                config.games_per_eval = arg_value(&args, &mut i).parse().expect("invalid --games");
            }
            "--widths" => {
                config.widths = arg_value(&args, &mut i)
                    .split(',')
                    .map(|s| s.trim().parse().expect("invalid width"))
                    .collect();
                assert!(
                    config.widths.iter().all(|&w| w >= 4),
                    "--widths entries must be >= 4"
                );
            }
            "--height" => {
                config.height = arg_value(&args, &mut i).parse().expect("invalid --height");
                assert!(config.height >= 4, "--height must be >= 4");
            }
            "--target-fill" => {
                config.target_fill = arg_value(&args, &mut i).parse().expect("invalid --target-fill");
            }
            "--seed" => {
                config.seed = arg_value(&args, &mut i).parse().expect("invalid --seed");
            }
            "--sigma" => {
                config.sigma = arg_value(&args, &mut i).parse().expect("invalid --sigma");
            }
            "--help" | "-h" => {
                eprintln!(
                    "Usage: evolve [OPTIONS]\n\
                     \n\
                     Options:\n\
                     --strategy flat|fourwide   Strategy to optimize (default: flat)\n\
                     --generations N            Number of generations (default: 50)\n\
                     --mu N                     Parent population size (default: 10)\n\
                     --lambda N                 Offspring per generation (default: 40)\n\
                     --pieces N                 Pieces per game (default: 500)\n\
                     --games N                  Games per fitness evaluation (default: 3)\n\
                     --widths W1,W2,...         Board widths (default: 10,20,40)\n\
                     --height N                Board height for all widths (default: 20)\n\
                     --target-fill F            Target fill ratio (default: 0.6)\n\
                     --seed N                   Random seed (default: 42)\n\
                     --sigma F                  Initial mutation strength (default: 0.3)\n\
                     "
                );
                return;
            }
            other => {
                eprintln!("Unknown argument: {}", other);
                std::process::exit(1);
            }
        }
        i += 1;
    }

    let strategy_name = match config.strategy {
        Strategy::Flat => "Flat",
        Strategy::FourWide => "FourWide",
    };

    eprintln!("=== Tetris AI Parameter Evolution ===");
    eprintln!("Strategy:    {}", strategy_name);
    eprintln!("Generations: {}", config.generations);
    eprintln!("Population:  mu={}, lambda={}", config.mu, config.lambda);
    eprintln!("Games:       {} base pieces (scaled by width/10) x {} games x {} widths",
        config.pieces_per_game, config.games_per_eval, config.widths.len());
    eprintln!("Widths:      {:?}", config.widths);
    eprintln!("Height:      {}", config.height);
    eprintln!("Target fill: {}", config.target_fill);
    eprintln!("Seed:        {}", config.seed);
    eprintln!("Sigma:       {}", config.sigma);
    eprintln!();

    // Evaluate defaults for comparison
    eprintln!("Evaluating default parameters...");
    let default_fitness = evolve::evaluate_defaults(&config);
    eprintln!("Default fitness: {:.6} lines/piece", default_fitness);
    eprintln!();

    // Run evolution
    let best = evolve::run_evolution(&config);

    eprintln!();
    eprintln!("=== Evolution Complete ===");
    eprintln!("Best fitness:    {:.6} lines/piece", best.fitness);
    eprintln!("Default fitness: {:.6} lines/piece", default_fitness);
    let improvement = if default_fitness > 0.0 {
        (best.fitness - default_fitness) / default_fitness * 100.0
    } else {
        0.0
    };
    eprintln!("Improvement:     {:.2}%", improvement);
    eprintln!();

    // Output winning parameters to stdout
    println!("// === Evolved {} Parameters ===", strategy_name);
    println!("// Fitness: {:.6} lines/piece (default: {:.6})", best.fitness, default_fitness);
    println!("// Config: {} gens, mu={}, lambda={}, {} pieces x {} games",
        config.generations, config.mu, config.lambda,
        config.pieces_per_game, config.games_per_eval);
    println!("// Widths: {:?}, target_fill: {}, seed: {}",
        config.widths, config.target_fill, config.seed);
    println!();

    println!("// NOTE: const blocks below are INCOMPLETE (legacy fields only) —");
    println!("// adopt results via the full GENOME line at the end.");
    match config.strategy {
        Strategy::Flat => {
            let (fp, sp) = best.to_flat_params();
            println!("// evaluator.rs weights:");
            println!("{}", fp.to_const_block());
            println!();
            println!("// solver.rs constants:");
            println!("{}", sp.to_const_block());
        }
        Strategy::FourWide => {
            let (fwp, sp) = best.to_fw_params();
            println!("// evaluator.rs weights:");
            println!("{}", fwp.to_const_block());
            println!();
            println!("// solver.rs constants:");
            println!("{}", sp.to_const_block());
        }
    }

    // Full genome, machine-readable — the const blocks above predate newer
    // genes and are lossy. Adopt via <Strategy>Params::from_vec.
    println!();
    println!("GENOME_FITNESS: {:.6}", best.fitness);
    println!(
        "GENOME: [{}]",
        best.genes
            .iter()
            .map(|g| format!("{:?}", g))
            .collect::<Vec<_>>()
            .join(", ")
    );
}
