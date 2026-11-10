import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { FloatingNav } from './components/Tabs'
import { Stage } from './components/Stage'
import { PlayerBar } from './components/PlayerBar'
import { NowPlaying } from './components/NowPlaying'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchRadios } from './api/gcores'
import { RadioGrid } from './components/RadioCard'
import { DiscoverPage } from './pages/Discover'
import { RadioDetailPage } from './pages/RadioDetail'
import { CategoriesPage } from './pages/Categories'
import { CategoryDetailPage } from './pages/CategoryDetail'
import { AudiobooksPage, AlbumDetailPage } from './pages/Audiobooks'
import { SeriesPage } from './pages/Series'
import { PlaylistsPage, PlaylistDetailPage } from './pages/Playlists'
import { MePage } from './pages/Me'
import { LoginPage } from './pages/Login'
import { SearchPage } from './pages/Search'
import { QueuePage } from './pages/Queue'
import { restoreLastSession } from './store/player'
import { useWideLandscape } from './hooks/useLayout'

/** 带外壳的路由：外层 = 舞台 + 内容；底部堆叠（迷你播放条 + Tab）由 App 统一提供 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell stage={<Stage />} footer={<BottomStack />}>
      {children}
      <NowPlaying />
    </AppShell>
  )
}

/** 主页面：底部 Tab 统一由 App 渲染，这里只是语义化命名 */
function TabShell({ children }: { children: React.ReactNode; tabs?: boolean }) {
  return (
    <AppShell stage={<Stage />} footer={<BottomStack />}>
      {children}
      <NowPlaying />
    </AppShell>
  )
}

/**
 * 底部堆叠：迷你播放条 + 悬浮导航。
 * 播放条只在竖屏出现 —— 横屏的播放控制全部在左侧舞台里，底部再放一条是重复的。
 */
/** 列表页 in 壳层：aside 顶部显示当前页面名（没有播放时不再显示「有声书」占位） */
function SectionPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AppShell title={title} stage={<Stage />} footer={<BottomStack />}>
      {children}
      <NowPlaying />
    </AppShell>
  )
}

function BottomStack() {
  const wide = useWideLandscape()
  return (
    <>
      {!wide && <PlayerBar />}
      <FloatingNav />
    </>
  )
}

export default function App() {
  // 刷新后把上一期节目与进度接回来（只恢复，不自动播放）
  useEffect(() => {
    restoreLastSession()
  }, [])

  return (
    <Routes>
      <Route
        path="/"
        element={
            <TabShell>
                  <DiscoverPage />
                </TabShell>
          }
      />
      {/* 旧书签/外链兜底：/albums 是有声书，/categories 是栏目表 */}
      <Route path="/albums" element={<Navigate replace to="/audiobooks" />} />
      {/* 栏目页保留为二级入口（首页不再展示），播单页替代了原来的 Tab 位置 */}
      <Route
        path="/categories"
        element={
          <>
            <TabShell>
              <CategoriesPage />
            </TabShell>
          </>
        }
      />
      <Route
        path="/playlists"
        element={
          <>
            <SectionPage title="播单">
              <PlaylistsPage />
            </SectionPage>
          </>
        }
      />
      <Route
        path="/audiobooks"
        element={
          <>
            <SectionPage title="有声书">
              <AudiobooksPage />
            </SectionPage>
          </>
        }
      />
      <Route
        path="/me"
        element={
          <>
            <TabShell>
              <MePage />
            </TabShell>
          </>
        }
      />

      <Route
        path="/category/:id"
        element={
          <>
            <TabShell>
              <CategoryDetailPage />
            </TabShell>
          </>
        }
      />
      <Route
        path="/album/:id"
        element={
          <>
            <TabShell>
              <AlbumDetailPage />
            </TabShell>
          </>
        }
      />
      <Route
        path="/playlist/:id"
        element={
          <>
            <TabShell>
              <PlaylistDetailPage />
            </TabShell>
          </>
        }
      />
      <Route
        path="/series/:slug"
        element={
          <>
            <TabShell>
              <SeriesPage />
            </TabShell>
          </>
        }
      />
      <Route
        path="/radio/:id"
        element={
          <>
            <Shell>
              <RadioDetailPage />
            </Shell>
          </>
        }
      />
      <Route
        path="/search"
        element={
          <>
            <Shell>
              <SearchPage />
            </Shell>
          </>
        }
      />
      <Route
        path="/queue"
        element={
          <>
            <Shell>
              <QueuePage />
            </Shell>
          </>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/latest"
        element={
          <>
            <LatestPage />
          </>
        }
      />
      <Route
        path="/gpass"
        element={
          <>
            <LatestPage />
          </>
        }
      />
      <Route
        path="*"
        element={
          hasLegacyHash() ? (
            <Shell>
              <HashFallback />
            </Shell>
          ) : (
            <Shell>
              <NotFound />
            </Shell>
          )
        }
      />
    </Routes>
  )
}

/** /#/queue 这类旧哈希链接：真正需要重定向时才挂这个组件，避免把普通 404 也吃掉 */
function hasLegacyHash() {
  return /^#\/?[a-z]/i.test(window.location.hash)
}

/** BrowserRouter 下旧哈希链接会落到通配路由，这里转成等价的普通路径 */
function HashFallback() {
  const nav = useNavigate()
  const [pending, setPending] = useState(() => window.location.hash.replace(/^#\/?/, ''))
  useEffect(() => {
    if (!pending) return
    nav('/' + pending, { replace: true })
    setPending('')
  }, [pending, nav])
  return pending ? null : <NotFound />
}

function NotFound() {
  const nav = useNavigate()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="text-[15px] text-white">页面不存在</div>
      <button type="button" onClick={() => nav('/')} className="rounded-full bg-card px-5 py-2.5 text-[13px] text-[#cfd3da]">
        回到发现
      </button>
    </div>
  )
}

/** 最新节目：复用栏目详情列表的无限滚动 */
function LatestPage() {
  const nav = useNavigate()
  return (
    <TabShell>
      <div className="sticky top-0 z-20 flex items-center gap-2 bg-ink/95 px-2 pt-[max(8px,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <button type="button" onClick={() => nav(-1)} className="tap shrink-0 text-[#e8eaef]" aria-label="返回">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-[16px] font-bold text-white">最新节目</h1>
      </div>
      <LatestList />
    </TabShell>
  )
}

function LatestList() {
  const q = useInfiniteQuery({
    queryKey: ['radios', 'latest', 'all'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchRadios({ offset: pageParam, limit: 24 }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return last.items.length >= 24 ? loaded : undefined
    },
  })
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <div className="pt-3">
      <RadioGrid items={items} queue={items} />
      {q.hasNextPage && (
        <button
          type="button"
          onClick={() => void q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
          className="mx-auto my-6 block h-12 rounded-full bg-card px-8 text-[13px] text-[#cfd3da]"
        >
          {q.isFetchingNextPage ? '加载中…' : '加载更多'}
        </button>
      )}
      {q.isLoading && <div className="px-4 py-10 text-center text-[13px] text-[#8a92a3]">加载中…</div>}
    </div>
  )
}
