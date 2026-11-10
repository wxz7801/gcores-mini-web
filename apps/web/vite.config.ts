import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 生产环境由 Nginx / Cloudflare Worker 反向代理 /gapi → https://www.gcores.com/gapi
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5273,
    proxy: {
      '/gapi': {
        target: 'https://www.gcores.com',
        changeOrigin: true,
        headers: { Referer: 'https://www.gcores.com/' },
      },
    },
  },
})