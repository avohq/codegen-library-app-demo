import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // No CSS pipeline needed for this demo — disable PostCSS auto-discovery so
  // it doesn't walk up the directory tree looking for a config file.
  css: { postcss: { plugins: [] } },
  server: {
    port: 5173,
    open: true,
  },
});
