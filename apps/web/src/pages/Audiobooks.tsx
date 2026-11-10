import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchAlbumDetail, fetchAlbumRadios, fetchAlbums, type AlbumItem } from '../api/gcores'
import { CoverImage } from '../components/CoverImage'
import { coverUrl, cn } from '../lib/format'
import { useQuery } from '@tanstack/react-query'
import { usePlayer } from '../store/player'
import { toTrack } from '../components/RadioRow'
import { RadioRow } from '../components/RadioRow'

/**
 * 有声书：竖屏一行 3 个、横屏一行 4~6 个，间距放大；
 * 封面按 1:1 方图展示（API 里 album.cover 实际是 1000×1000 方图，
 * 用 3:4 容器 object-cover 会把书名/人物上下切掉）。
 */
export function AudiobooksPage() {
  const nav = useNavigate()
  const q = useInfiniteQuery({
    queryKey: ['albums', 'audiobook', 'all'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchAlbums('audiobook', pageParam, 24),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return last.items.length >= 24 ? loaded : undefined
    },
  })
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  const total = q.data?.pages[0]?.total ?? 0

  return (
    <div className="pb-6">
      <header className="sticky top-0 z-20 bg-ink/95 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <h1 className="text-[28px] leading-none font-bold text-white">有声书</h1>
        <p className="mt-1.5 text-[14px] text-[#8a92a3]">GPASS 会员专享 · 共 {total || '—'} 部</p>
      </header>

      <div className="grid grid-cols-2 gap-x-4 gap-y-7 px-4 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {items.map((a) => (
          <AlbumTile key={a.id} album={a} onOpen={() => nav(`/album/${a.id}`)} />
        ))}
      </div>

      {q.hasNextPage && (
        <button
          type="button"
          onClick={() => void q.fetchNextPage()}
          className="mx-auto mt-8 block h-12 rounded-full bg-card px-8 text-[15px] text-[#cfd3da]"
        >
          {q.isFetchingNextPage ? '加载中…' : '加载更多'}
        </button>
      )}
      {q.isLoading && <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">加载中…</div>}
      {q.isError && <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">加载失败，请稍后重试</div>}
    </div>
  )
}

export function AlbumTile({ album, onOpen }: { album: AlbumItem; onOpen: () => void }) {
  // 封面是 1:1 方图，这里按「方形封面 + 文字压在图下方」布局，
  // 不要用 3:4 容器去裁切（会把书名和插图上下切掉）。
  return (
    <button type="button" onClick={onOpen} className="group block text-left [container-type:inline-size]">
      <div className="relative w-full overflow-hidden rounded-xl bg-card" style={{ aspectRatio: '1 / 1' }}>
        <CoverImage src={coverUrl(album.cover, 360, 360)} className="h-full w-full object-cover" />
        {album.isRequirePrivilege && (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-[#8b1e26]/90 px-1.5 py-0.5 text-[12px] leading-none font-bold text-white">
            GPASS
          </span>
        )}
      </div>
      <div className="mt-2 line-clamp-2 min-h-[34px] text-[15px] leading-snug text-[#e8eaef] max-sm:text-[13px]">
        {album.title}
      </div>
      <div className="mt-1 text-[13px] text-[#7d8594]">
        {album.isRequirePrivilege ? '会员专享' : album.isFree ? '免费' : `${album.credit} 积分`}
        {album.count ? ` · ${album.count} ${album.itemsLabel}` : ''}
      </div>
    </button>
  )
}

/** 有声书详情：头部信息 + 章节列表（整本连续播放） */
export function AlbumDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const nav = useNavigate()
  const playTrack = usePlayer((s) => s.playTrack)
  const currentId = usePlayer((s) => s.current?.radioId)
  const playing = usePlayer((s) => s.playing)
  const toggle = usePlayer((s) => s.toggle)

  const info = useQuery({ queryKey: ['album', id], queryFn: () => fetchAlbumDetail(id), enabled: Boolean(id) })
  const chapters = useQuery({
    queryKey: ['album', id, 'chapters'],
    queryFn: () => fetchAlbumRadios(id, 0, 100),
    enabled: Boolean(id),
  })

  const album = info.data
  const items = chapters.data?.items ?? []

  // display-type 不是 audiobook 的 id 落在这里 = 其实是个播单，转到播单详情，避免标题显示「有声书」
  if (album && album.kind === 'playlist') return <Navigate replace to={`/playlist/${album.id}`} />
  // 加载中标题留白，别把页面名「有声书」当成这本书的名字
  const title = album?.title ?? (info.isLoading ? '' : '有声书')
  const anyCurrent = currentId && items.some((r) => r.id === currentId)

  return (
    <div className="pb-6">
      {/* 给 NowPlaying 顶部提示条留出高度，避免压住标题 */}
      <div className="pointer-events-none h-11" aria-hidden="true" />
      <header className="sticky top-0 z-20 -mt-11 flex items-center gap-2 bg-ink/95 px-2 pt-[max(8px,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <button type="button" onClick={() => nav(-1)} className="tap shrink-0 text-[#e8eaef]" aria-label="返回">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[18px] font-bold text-white">{title || '\u00a0'}</h1>
      </header>

      {/* 头图按 3:4 完整显示不做裁切；封面右侧只放标题和标签，简介整段落在封面下方 */}
      <div className="flex items-start gap-4 px-4 pt-2">
        <div className="w-[110px] shrink-0 overflow-hidden rounded-xl bg-card" style={{ aspectRatio: '3 / 4' }}>
          {album?.cover && <CoverImage src={coverUrl(album.cover, 330, 440)} className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h1 className="text-[17px] leading-snug font-bold text-white">
            {album?.title ?? (info.isLoading ? <span className="text-[#5c6371]">加载中…</span> : '有声书')}
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {album?.isRequirePrivilege && (
              <span className="rounded bg-[#8b1e26]/80 px-1.5 py-0.5 text-[12px] text-white">GPASS 专享</span>
            )}
            <span className="rounded bg-card px-1.5 py-0.5 text-[12px] text-[#a3aab8]">{items.length} 章</span>
            {album?.subscriptions ? (
              <span className="rounded bg-card px-1.5 py-0.5 text-[12px] text-[#a3aab8]">{album.subscriptions} 人订阅</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 简介整段放在封面下面，不再挤在标题右边被裁成 3 行 */}
      {album?.description && (
        <p className="mt-4 px-4 text-[15px] leading-[1.75] whitespace-pre-line break-words text-[#a3aab8]">
          {album.description}
        </p>
      )}

      <div className="mt-4 flex gap-2 px-4">
        <button
          type="button"
          onClick={() => {
            if (anyCurrent) {
              toggle()
              return
            }
            if (items[0]) void playTrack(toTrack(items[0]), items.map((r) => toTrack(r)))
          }}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gcores text-[16px] font-medium text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            {anyCurrent && playing ? (
              <>
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </>
            ) : (
              <path d="M7 4l14 8-14 8z" />
            )}
          </svg>
          {anyCurrent && playing ? '暂停' : '从头听'}
        </button>
      </div>

      <div className="mt-4 px-2">
        {items.map((r, i) => (
          <div key={r.id} className="flex items-start">
            <span className="w-8 shrink-0 pt-4 text-center text-[13px] text-[#5c6371]">
              {r.id === currentId ? <span className="text-gcores">▶</span> : i + 1}
            </span>
            <div className={cn('min-w-0 flex-1', r.id === currentId && 'bg-gcores/5')}>
              <RadioRow radio={r} queue={items} />
            </div>
          </div>
        ))}
      </div>

      {chapters.isLoading && <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">加载中…</div>}
    </div>
  )
}