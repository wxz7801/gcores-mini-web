import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 生产环境由 Nginx / Cloudflare Worker 反向代理 /gapi → https://www.gcores.com/gapi
export default defineConfig(({ mode }) => {
  // show_fm_list 放在仓库根 .env（没有 VITE_ 前缀），loadEnv 要用空前缀才能读到。
  // 生产环境这个值由 Worker 从 Cloudflare 运行时变量注入（见 worker/index.js），
  // 这里只服务本地 vite dev。
  const env = loadEnv(mode, resolve(__dirname, '../..'), '')
  const showFmList = (env.show_fm_list ?? 'true').trim()

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_SHOW_FM_LIST': JSON.stringify(showFmList),
    },
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
  }
})
