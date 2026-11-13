import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// The program's version (the root package.json), shown by the web site (webhost.ts).
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // Old enough for the browsers of macOS 10.13-10.15 (Chrome/Edge up to 116, Firefox ESR 115,
  // Safari 14+): a classic worker (module workers need Safari 15) and syntax lowered to ES2020.
  worker: { format: 'iife' },
  build: { target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'], sourcemap: false, chunkSizeWarningLimit: 2000 },
});
