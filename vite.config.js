import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Multi-page setup: the landing page plus one HTML entry per toy.
// Add a new line to `input` for every toy added in later phases.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        swarm: fileURLToPath(new URL('./toys/swarm/index.html', import.meta.url)),
        fluid: fileURLToPath(new URL('./toys/fluid/index.html', import.meta.url)),
        warp: fileURLToPath(new URL('./toys/warp/index.html', import.meta.url)),
        bloom: fileURLToPath(new URL('./toys/bloom/index.html', import.meta.url)),
      },
    },
  },
});
