import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/oem-system-stack/',
  build: {
    sourcemap: false,
    outDir: 'dist'
  }
});
