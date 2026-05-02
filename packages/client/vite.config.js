import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
  proxy: {
    '/api': 'http://localhost:3001'
  },
},
  resolve: {
    alias: {
      // Direct alias to the common source
      // eslint-disable-next-line no-undef
      '@app/common': path.resolve(__dirname, '../common/src/auth-schemas.ts'),
       // eslint-disable-next-line no-undef
      '@': path.resolve(__dirname, './src'),
    },
  },
})
