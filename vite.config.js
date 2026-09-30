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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: 'index.html',
        options: 'options.html',
        admin: 'admin.html',
      },
      output: {
        manualChunks(id) {
          const normId = id.replace(/\\/g, '/');
          if (normId.includes('/node_modules/')) {
            if (normId.includes('react') || normId.includes('react-dom') || normId.includes('scheduler')) {
              return 'vendor-react';
            }
            if (normId.includes('@supabase') || normId.includes('supabase')) {
              return 'vendor-supabase';
            }
            if (normId.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        }
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
    },
    watch: {
      ignored: [
        '**/graft/**',
        '**/.cache/**',
        '**/.git/**',
        '**/*.lock',
        '**/node_modules/**',
        '**/dist/**',
        '**/*.zip',
        '**/.agents/**',
        '**/.cursor/**',
        '**/.gemini/**',
        '**/.codegraph/**'
      ]
    }
  }
})
