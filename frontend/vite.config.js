import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Drop-in replacement for v7/vite.config.js once the local API is running.
// The app still calls /flow, /flow2 and /auditflow — they now go to the local
// Express API instead of Power Automate. No frontend code changes needed, and
// the Power Automate URLs (with their secret sig= keys) are gone from the repo.
const API_TARGET = process.env.PP_API_URL || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/flow2': { target: API_TARGET, changeOrigin: true },
      '/auditflow': { target: API_TARGET, changeOrigin: true },
      '/flow': { target: API_TARGET, changeOrigin: true },
    },
  },
})
