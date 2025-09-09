import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  },
  build: {
    outDir: 'dist/renderer',
    sourcemap: true
  },
  optimizeDeps: {
    exclude: [
      '@ricky0123/vad-react',
      'onnxruntime-web'
    ]
  },
  define: {
    global: 'globalThis'
  }
})
