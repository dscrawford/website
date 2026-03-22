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

        # --- WASM build: compile tetris-solver to WebAssembly ---
        # NOTE: wasm-bindgen version in Cargo.toml (=0.2.114) must match
        # the nixpkgs wasm-bindgen-cli version. Check with:
        #   nix eval nixpkgs#wasm-bindgen-cli.version
        wasmPkg = pkgs.rustPlatform.buildRustPackage {
          pname = "tetris-solver-wasm";
          version = "0.1.0";
          src = ./tetris-solver;
          cargoLock.lockFile = ./tetris-solver/Cargo.lock;

          nativeBuildInputs = [ pkgs.wasm-bindgen-cli pkgs.binaryen pkgs.lld ];

          # Use rustToolchain from rust-overlay (has wasm32 target)
          rustc = rustToolchain;
          cargo = rustToolchain;

          buildPhase = ''
            cargo build --release --target wasm32-unknown-unknown
            mkdir -p $out
            wasm-bindgen --target web --out-dir $out \
              target/wasm32-unknown-unknown/release/tetris_solver.wasm
            wasm-opt -Os $out/tetris_solver_bg.wasm -o $out/tetris_solver_bg.wasm
          '';

          installPhase = "true";

          # No native tests for a wasm-only crate
          doCheck = false;
        };

        # --- nginx config for production Docker image ---
        nginxConf = pkgs.writeText "nginx.conf" ''
          worker_processes 1;
          daemon off;
          error_log /dev/stderr;
          pid /tmp/nginx.pid;

          events {
            worker_connections 128;
          }

          http {
            include       ${pkgs.nginxMainline}/conf/mime.types;
            default_type  application/octet-stream;
            access_log    /dev/stdout;

            sendfile    on;
            tcp_nopush  on;
            gzip        on;
            gzip_types  text/css application/javascript application/wasm;

            client_body_temp_path /tmp/nginx_client_body;
            proxy_temp_path       /tmp/nginx_proxy;
            fastcgi_temp_path     /tmp/nginx_fastcgi;
            uwsgi_temp_path       /tmp/nginx_uwsgi;
            scgi_temp_path        /tmp/nginx_scgi;

            server {
              listen 80;
              root /var/www;
              index index.html;

              location / {
                try_files $uri $uri/ /index.html;
              }

              location ~* \.(js|css|wasm|svg|ico|png|jpg|jpeg|gif|webp|woff2?)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
              }
            }
          }
        '';

        # --- Frontend build: npm + Vite → dist/ ---
        frontend = pkgs.buildNpmPackage {
          pname = "dcraw-website";
          version = "0.0.0";
          src = pkgs.lib.cleanSource ./.;

          npmDepsHash = "sha256-kpxW1I78fWCdKcdCjV7LtVILQh5RgYNopGW0maV1pHk=";

          nativeBuildInputs = [ pkgs.nodejs_22 ];

          preBuild = ''
            # Inject pre-built WASM package so vite-plugin-wasm can find it
            rm -rf src/tetris-solver-pkg
            mkdir -p src/tetris-solver-pkg
            cp -r ${wasmPkg}/* src/tetris-solver-pkg/
          '';

          buildPhase = ''
            runHook preBuild
            npm run build
            runHook postBuild
          '';

          installPhase = ''
            cp -r dist $out
          '';
        };
      in
      {
        packages.default = frontend;

        packages.dockerImage = pkgs.dockerTools.buildLayeredImage {
          name = "dcraw-website";
          tag = "latest";

          contents = [
            pkgs.nginxMainline
          ];

          extraCommands = ''
            mkdir -p var/www
            cp -r ${frontend}/* var/www/
            mkdir -p etc/nginx
            cp ${nginxConf} etc/nginx/nginx.conf
            mkdir -p var/log/nginx
            mkdir -p tmp

            # Provide passwd/group with nogroup for nginx
            mkdir -p etc
            echo 'root:x:0:0:root:/var/empty:/bin/sh' > etc/passwd
            echo 'nobody:x:65534:65534:nobody:/var/empty:/bin/sh' >> etc/passwd
            echo 'root:x:0:' > etc/group
            echo 'nobody:x:65534:' >> etc/group
            echo 'nogroup:x:65534:' >> etc/group
          '';

          config = {
            Cmd = [ "${pkgs.nginxMainline}/bin/nginx" "-c" "/etc/nginx/nginx.conf" ];
            ExposedPorts = { "80/tcp" = {}; };
          };
        };

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

            # Testing
            pkgs.chromium

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
