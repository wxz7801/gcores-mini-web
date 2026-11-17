/**
 * 运行时功能开关。
 *
 * show_fm_list（true 显示 / false 隐藏「历史FM」列表）有两个来源，按优先级：
 * 1. 生产：Cloudflare Workers 运行时变量 show_fm_list —— worker/index.js 把它注入
 *    index.html 的 window.__GCORES_CONFIG__，改 Dashboard 变量即时生效，不用重新构建；
 * 2. 本地 vite dev：仓库根 .env 的 show_fm_list —— vite.config.ts 用 loadEnv 读出后
 *    define 成 import.meta.env.VITE_SHOW_FM_LIST（vite dev 不经过 Worker，没有注入）。
 * 未设置时默认显示。
 *
 * 注意：顶部的「机核FM」直播按钮不受这个开关控制——它对齐官网，永远只播最新一期。
 * 这个开关只管「历史FM」那整列往期特辑要不要露出。
 */
declare global {
  interface Window {
    __GCORES_CONFIG__?: { showFmList?: boolean }
  }
}

const injected = window.__GCORES_CONFIG__?.showFmList
const fromEnv = ((import.meta.env.VITE_SHOW_FM_LIST as string | undefined) ?? 'true').trim().toLowerCase()

/** 是否显示「历史FM」列表（首页 FM 页签，以及各信息流里的 FM 节目） */
export const SHOW_FM_LIST = injected !== undefined ? injected : fromEnv !== 'false'
