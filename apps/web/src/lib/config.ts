/**
 * 运行时功能开关。
 *
 * show_fm（true 显示 / false 隐藏机核 FM）有两个来源，按优先级：
 * 1. 生产：Cloudflare Workers 运行时变量 show_fm —— worker/index.js 把它注入
 *    index.html 的 window.__GCORES_CONFIG__，改 Dashboard 变量即时生效，不用重新构建；
 * 2. 本地 vite dev：仓库根 .env 的 show_fm —— vite.config.ts 用 loadEnv 读出后
 *    define 成 import.meta.env.VITE_SHOW_FM（vite dev 不经过 Worker，没有注入）。
 * 未设置时默认显示。
 */
declare global {
  interface Window {
    __GCORES_CONFIG__?: { showFm?: boolean }
  }
}

const injected = window.__GCORES_CONFIG__?.showFm
const fromEnv = ((import.meta.env.VITE_SHOW_FM as string | undefined) ?? 'true').trim().toLowerCase()

/** 是否显示机核 FM（首页 FM 页签，以及各信息流里的 FM 节目） */
export const SHOW_FM = injected !== undefined ? injected : fromEnv !== 'false'
