import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
  server: {
    proxy: {
      '/api': {
        // Must match backend PORT (this project uses 5001 locally — see backend/.env PORT).
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
