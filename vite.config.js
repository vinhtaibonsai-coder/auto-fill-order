import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

const isVercel = Boolean(process.env.VERCEL)

export default defineConfig({
  plugins: [
    react(),
    !isVercel && crx({ manifest }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin-dashboard/admin.html',
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  }
})
