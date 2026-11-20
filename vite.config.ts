import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist/client',
    assetsInlineLimit: 0,
    // splash.html is the inline post; index.html is the game, opened in Reddit's expanded view.
    rollupOptions: { input: { game: 'index.html', splash: 'splash.html' } },
  },
});
