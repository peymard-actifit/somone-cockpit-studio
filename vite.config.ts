import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Normaliser le chemin pour éviter les problèmes avec les espaces
const root = path.resolve(__dirname)

export default defineConfig({
  root: root,
  plugins: [react()],
  cacheDir: path.resolve(process.env.TEMP || 'C:/Temp', 'vite-cache-somone'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        // Utiliser des noms de fichiers simples pour éviter les problèmes de chemins
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  json: {
    namedExports: true,
    stringify: false,
  },
})







