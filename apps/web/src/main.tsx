import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { setTokenGetter, setUnauthorizedHandler } from './api/client'
import { getToken, signOut } from './api/auth'
import App from './App.tsx'
import './index.css'

setTokenGetter(getToken)
setUnauthorizedHandler(() => signOut())

// 整页不滚 = 文档层永远停在 0。
// 浏览器在 scrollIntoView / 焦点跳转 / 锚点定位时，找不到合适的滚动容器就会去滚文档；
// #root 是定高的、文档又被 clip 住，一旦被滚就是整块界面跟着内容走、松开还弹回去。
// 所以这里把文档滚动重定向回 0，真正的滚动只发生在内容容器里。
const resetDocumentScroll = () => {
  const se = document.scrollingElement as HTMLElement | null
  if (se && (se.scrollTop || se.scrollLeft)) {
    se.scrollTop = 0
    se.scrollLeft = 0
  }
}
window.addEventListener('scroll', resetDocumentScroll, { passive: true })
window.addEventListener('load', resetDocumentScroll)
resetDocumentScroll()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)