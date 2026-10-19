import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    // Ingen offentlig source map – kildekoden skal ikke ligge åbent på sitet
    sourcemap: false
  },
  // Fjern console.log/debug i produktion (de kan indeholde elevdata)
  esbuild: {
    pure: ['console.log', 'console.debug']
  },
  // Ensure compatibility with Firebase and other libraries
  optimizeDeps: {
    include: ['firebase/app', 'firebase/firestore', 'pdfjs-dist', 'mammoth']
  }
});
