import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: {
        app: './index.html',
      },
    }
  }
})
