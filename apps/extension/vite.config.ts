import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        settings: 'src/settings/index.html',
      },
    },
  },
  server: {
    port: Number(process.env.PORT) || 5174,
    strictPort: true,
    hmr: { port: Number(process.env.PORT) || 5174 },
  },
})
