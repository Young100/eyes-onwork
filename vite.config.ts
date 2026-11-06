import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: false,
    ws: false
  }
});

export default defineConfig({
  plugins: [react()],
  // Ajoutez cette section "server" :
  server: {
  allowedHosts: ['eyes-onwork.onrender.com']
  }
  });
})