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
        // Optimisation: Séparer UNIQUEMENT les libs avec import dynamique (await import)
        // Ne PAS inclure les libs importées statiquement (xlsx, jszip, file-saver, etc.)
        manualChunks: (id) => {
          // jspdf et pdfjs-dist sont importés via await import() dans PresentationConfigModal et AIPromptInput
          if (id.includes('jspdf') || id.includes('pdfjs-dist')) {
            return 'pdf-libs';
          }
          // pptxgenjs est importé via await import() dans PresentationConfigModal
          if (id.includes('pptxgenjs')) {
            return 'pptx-libs';
          }
          // html2canvas est importé via await import() dans PresentationConfigModal
          if (id.includes('html2canvas')) {
            return 'html2canvas';
          }
          // mammoth est importé via await import() dans AIPromptInput
          if (id.includes('mammoth')) {
            return 'mammoth';
          }
          // Note: xlsx, jszip, file-saver sont importés STATIQUEMENT donc restent dans le bundle principal
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







