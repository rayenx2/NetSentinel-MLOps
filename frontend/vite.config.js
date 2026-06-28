import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: '../static', emptyOutDir: true },
  server: {
    proxy: {
      '/api': 'http://localhost:8090',
      '/health': 'http://localhost:8090',
      '/metrics': 'http://localhost:8090',
      '/predict': 'http://localhost:8090',
      '/train': 'http://localhost:8090'
    }
  }
})
