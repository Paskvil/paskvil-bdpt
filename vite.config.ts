/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  // dev: the demo page lives in demo/, served at /demo/
  // fixed port - 5173 (the Vite default) is often taken by other projects
  server: { port: 5180, strictPort: true, open: '/demo/' },

  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BdptDemo',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'bdpt.js' : `bdpt.${format}.js`),
    },
  },

  test: {
    include: ['src/**/*.test.ts'],
  },
})
