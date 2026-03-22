{
  description = "DCrawWebsite — React + Rust/WASM personal site";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, rust-overlay, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };

        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" ];
          targets = [ "wasm32-unknown-unknown" ];
        };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            # Rust
            rustToolchain
            pkgs.wasm-pack
            pkgs.wasm-bindgen-cli
            pkgs.binaryen          # wasm-opt

            # Node / JS
            pkgs.nodejs_22
            pkgs.nodePackages.npm

            # LSP / tooling
            pkgs.nodePackages.typescript-language-server
            pkgs.nodePackages.typescript

            # Utilities
            pkgs.pkg-config
            pkgs.openssl
          ];

          shellHook = ''
            echo "🧱 DCrawWebsite dev shell"
            echo "  node  $(node --version)"
            echo "  rustc $(rustc --version)"
            echo "  wasm-pack $(wasm-pack --version)"

            # Auto-install node_modules if missing
            if [ ! -d node_modules ]; then
              echo "📦 Installing npm dependencies..."
              npm install
            fi
          '';
        };
      }
    );
}
