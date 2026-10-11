import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vinext from 'vinext';

export default defineConfig({
  resolve: { alias: { 'cloudflare:workers': fileURLToPath(new URL('./build/node-cloudflare.ts', import.meta.url)) } },
  plugins: [vinext(), {
    name: 'managelove-node-entry',
    enforce: 'post',
    configEnvironment(name) {
      if (name === 'rsc') return {
        build: { rolldownOptions: { input: { index: fileURLToPath(new URL('./build/node-entry.ts', import.meta.url)) } } },
      };
    },
  }],
});
