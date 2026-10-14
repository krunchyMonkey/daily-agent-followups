import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built app works when Electron loads dist/index.html from disk.
  base: './',
  // pdf.js is large; this is a local desktop app, so one bundle is fine.
  build: { chunkSizeWarningLimit: 2000 },
  server: { port: 5173, strictPort: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
