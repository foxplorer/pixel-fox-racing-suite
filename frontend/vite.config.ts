import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'bun:sqlite': fileURLToPath(new URL('./src/wallet/bunSqliteBrowserStub.ts', import.meta.url)),
    },
  },
  build: {
    sourcemap: false,
  },
})
