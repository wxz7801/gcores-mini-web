import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'gcores.theme.v1'

/** 首屏就要用的主题：在 React 挂载前由 main.tsx 调一次，避免白闪 */
export function applyStoredTheme() {
  const t = readStoredTheme()
  document.documentElement.dataset.theme = t
  return t
}

function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* localStorage 不可用时忽略，走系统偏好 */
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/**
 * 深色 / 浅色主题开关。
 *
 * 颜色本体全部在 styles/m3-tokens.css 里，这里只负责切 <html data-theme>，
 * 顺便把浏览器 UI 的 color-scheme 和移动端地址栏底色一起对上。
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(
    () => (document.documentElement.dataset.theme as ThemeMode | undefined) ?? readStoredTheme(),
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? '#fdf8f8' : '#0f1115')
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* 隐私模式下写不进去，忽略即可 */
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, setTheme, toggle }
}