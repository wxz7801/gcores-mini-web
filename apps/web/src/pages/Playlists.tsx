import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchAlbums, fetchAlbumDetail, fetchAlbumRadios } from '../api/gcores'
import { CoverImage } from '../components/CoverImage'
import { coverUrl, cn, formatTime } from '../lib/format'
import { RadioRow, toTrack } from '../components/RadioRow'
import { usePlayer } from '../store/player'
import { useQueueStore } from '../store/queue'
import { AlbumTile } from './Audiobooks'


/**
 * 播单（gcores.com/albums 的「播单」）：和有声书同一套 albums 接口，
 * 只是 filter[display-type]=album。内容形态是「一组节目的合集」，
 * 所以用横向大卡 + 节目数/时长，而不是章节列表。
 */
/** 播单列表：只列 display-type ≠ audiobook 的合集（接口按 24 条分页，混装时要过滤后再凑够一页） */
export function PlaylistsPage() {
  const nav = useNavigate()
  const q = useInfiniteQuery({
    queryKey: ['albums', 'album', 'all'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchAlbums('album', pageParam, 36),
    getNextPageParam: (last, pages) => {
      if (last.items.length < 36) return undefined
      return pages.reduce((n, p) => n + p.items.length, 0)
    },
  })
  const items = (q.data?.pages.flatMap((p) => p.items) ?? []).filter((a) => a.kind === 'playlist')
  const total = q.data?.pages[0]?.total ?? 0

  return (
    <div className="pb-6">
      <header className="sticky top-0 z-20 bg-ink/95 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <h1 className="text-[28px] leading-none font-bold text-white">播单</h1>
        <p className="mt-1.5 text-[14px] text-[#8a92a3]">DJ 和玩家整理的节目合集{total ? ` · 共 ${total} 张` : ''}</p>
      </header>

      <div className="grid grid-cols-3 gap-x-4 gap-y-7 px-4 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((a) => (
          <AlbumTile key={a.id} album={a} onOpen={() => nav(`/playlist/${a.id}`)} />
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
    </div>
  )
}

/**
 * 播单详情（多媒体头 + 节目列表）：
 * - 封面按 1:1 方图完整显示，不做裁切
 * - 头部不吸顶，滚下去只留一条「返回」悬浮条，给列表更多行
 * - 期数来自 /published-radios 的 meta.record-count（专辑本身的 chapters-count 对合集是 0）
 */
export function PlaylistDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const nav = useNavigate()
  const info = useQuery({ queryKey: ['album', id], queryFn: () => fetchAlbumDetail(id), enabled: Boolean(id) })
  const items = useQuery({
    queryKey: ['album', id, 'radios'],
    queryFn: () => fetchAlbumRadios(id, 0, 100),
    enabled: Boolean(id),
  })
  const playTrack = usePlayer((s) => s.playTrack)
  const addAll = useQueueStore((s) => s.addId)
  const album = info.data
  const list = items.data?.items ?? []
  // 反过来：从播单入口点进来但其实是本有声书 → 交给有声书详情
  if (album && album.kind === 'audiobook') return <Navigate replace to={`/album/${album.id}`} />
  const total = items.data?.total || list.length
  const [started, setStarted] = useState(false)

  // 总时长：已加载到的节目累加（100 期以内是准确的）
  const totalSec = list.reduce((n, r) => n + (r.duration || 0), 0)
  const badge = album?.isRequirePrivilege ? 'GPASS 专享' : album?.isFree ? '免费' : album?.credit ? `${album.credit} 积分` : ''

  return (
    <div className="pb-8">
      {/* 通知条：内容区顶部要给 NowPlaying 的通知让出一条，否则会压住标题 */}
      <div className="pointer-events-none h-11" aria-hidden="true" />

      {/* 悬浮返回条：不占版面高度，滚到哪都在 */}
      <div className="sticky top-0 z-20 flex items-center px-3 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => nav(-1)}
          aria-label="返回"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md active:bg-black/70"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </div>

      {/* 多媒体头 */}
      <section className="px-4">
        <div className="flex items-start gap-4">
          <div className="w-[40%] max-w-[180px] shrink-0 overflow-hidden rounded-2xl bg-card shadow-[0_10px_30px_rgba(0,0,0,.45)]" style={{ aspectRatio: '1 / 1' }}>
            {album?.cover && <CoverImage src={coverUrl(album.cover, 420, 420)} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="line-clamp-3 text-[19px] leading-snug font-bold text-white">
              {album ? (
                album.title
              ) : info.isLoading ? (
                <span className="text-[#5c6371]">加载中…</span>
              ) : (
                '播单不存在'
              )}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
              {badge && (
                <span className={cn('rounded px-1.5 py-0.5', album?.isRequirePrivilege ? 'bg-[#8b1e26]/85 text-white' : 'bg-card text-[#a3aab8]')}>
                  {badge}
                </span>
              )}
              <span className="rounded bg-card px-1.5 py-0.5 text-[#a3aab8]">{total} 期</span>
              {totalSec > 0 && <span className="text-[#7d8594]">{formatTime(totalSec)}</span>}
            </div>
          </div>
        </div>

        {/* 简介给全文：不再截两行、也不折叠成「节目简介」按钮，段落和换行照原样保留 */}
        {album?.description && (
          <p className="mt-4 text-[15px] leading-[1.75] whitespace-pre-line break-words text-[#a3aab8]">
            {album.description}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={!list.length}
            onClick={() => {
              if (!list.length) return
              void playTrack(toTrack(list[0]), list.map((r) => toTrack(r)))
              setStarted(true)
            }}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gcores text-[17px] font-medium text-white active:brightness-110 disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4l14 8-14 8z" />
            </svg>
            {started ? '从头播放' : '全部播放'}
          </button>
          <button
            type="button"
            disabled={!list.length}
            onClick={() => list.forEach((r) => addAll(toTrack(r)))}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-[#e8eaef] active:bg-[#262b34] disabled:opacity-40"
            aria-label="全部加入播放队列"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </section>

      <div className="mt-5 flex items-center justify-between px-4">
        <h2 className="text-[17px] font-bold text-white">节目</h2>
        <span className="text-[14px] text-[#7d8594]">{total} 期</span>
      </div>

      <div className="mt-1 px-2">
        {list.map((r, i) => (
          <div key={r.id} className="relative">
            <span className="absolute top-3 left-1 z-10 w-5 text-center font-mono text-[13px] text-[#5c6371]">{i + 1}</span>
            <div className="pl-5">
              <RadioRow radio={r} queue={list} />
            </div>
          </div>
        ))}
      </div>

      {items.isLoading && <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">加载中…</div>}
      {!items.isLoading && !list.length && (
        <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">这个播单还没有节目</div>
      )}
    </div>
  )
}
