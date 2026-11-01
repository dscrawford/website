import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), wasm()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      // GamesOnTheGo's service (`nix run .#service` there), mounted like
      // production: the prefix is stripped, and the service is told it with
      // GOTG_WEB_URL=http://localhost:5173/games (plus GOTG_COOKIE_SECURE=0).
      '/games': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/games/, '') || '/',
      },
    },
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'server/**', '**/.direnv/**'],
  },
})
