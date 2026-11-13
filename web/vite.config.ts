import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds one self-contained HTML file at ../app/musical-stage.html, the address GitHub Pages
// already serves (and the redirect URI registered with Spotify), so nothing changes for users.
export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  plugins: [viteSingleFile()],
  build: {
    outDir: '../app',
    emptyOutDir: false,
    target: 'es2022',
    rollupOptions: { input: 'musical-stage.html' },
  },
});
