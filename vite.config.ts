import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const cspProductionBuild = (): Plugin => ({
  name: 'ayesh:csp-production',
  apply: 'build',
  transformIndexHtml() {
    return [
      {
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content:
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
        },
        injectTo: 'head-prepend',
      },
    ];
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), cspProductionBuild()],
  root: 'src/renderer',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
