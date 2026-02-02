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
    // Augmenter la limite d'avertissement pour les chunks (le bundle est naturellement gros)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        // Utiliser des noms de fichiers simples pour éviter les problèmes de chemins
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Optimisation: Séparer uniquement les libs lazy-loadées
        manualChunks: (id) => {
          // Librairies de génération de documents (chargées à la demande via import dynamique)
          if (id.includes('jspdf') || id.includes('pdfjs-dist')) {
            return 'pdf-libs';
          }
          if (id.includes('pptxgenjs')) {
            return 'pptx-libs';
          }
          if (id.includes('html2canvas') || id.includes('xlsx') || id.includes('jszip')) {
            return 'export-libs';
          }
        },
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







