import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localPort = Number(process.env.PORT ?? 3333)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: localPort,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: localPort,
    strictPort: true,
  },
})
