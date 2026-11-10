import { useSyncExternalStore } from 'react'

/** 横屏且宽度 ≥ 900px 才启用「左舞台 + 右导航」布局 */
const QUERY = '(min-width: 900px) and (orientation: landscape)'

function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}

export function useWideLandscape() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
