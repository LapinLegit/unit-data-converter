import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  base: '/unit-data-converter',
  build: {
    assetsDir: '',
    outDir: 'docs',    
  },
  plugins: [react()],
});
