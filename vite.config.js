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
        options: 'options.html',
        admin: 'admin.html',
      }
    }
  },
  define: {
    '__IS_DEV_EXTENSION__': process.env.NODE_ENV === 'development' || process.env.VITE_DEV_MODE === 'true'
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  }
})
