/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  // dev: the demo page lives in demo/, served at /demo/
  server: { open: '/demo/' },

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
