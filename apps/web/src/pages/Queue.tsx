import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../store/player'
import { useQueueStore } from '../store/queue'
import { CoverImage } from '../components/CoverImage'
import { formatTime, cn } from '../lib/format'
import type { Track } from '../store/player'

/** 队列里只有轻量 meta，播放时补回 Track 形状 */
function trackOf(meta: { title: string; cover: string; duration: number; category?: string } | undefined, id: string): Track {
  return {
    radioId: id,
    title: meta?.title ?? '节目',
    cover: meta?.cover ?? '',
    duration: meta?.duration ?? 0,
    mediaType: 'audio',
    category: meta?.category,
  }
}

export function QueuePage() {
  const nav = useNavigate()
  const index = usePlayer((s) => s.index)
  const current = usePlayer((s) => s.current)
  const playCustomQueue = usePlayer((s) => s.playCustomQueue)
  const playAll = useQueueStore((s) => s.playAll)
  const remove = useQueueStore((s) => s.remove)
  const clear = useQueueStore((s) => s.clear)
  const ids = useQueueStore((s) => s.ids)
  const meta = useQueueStore((s) => s.meta)

  // 队列页读的是「用户攒的队列」（卡片 + 加进来的），不是正在播的来源列表
  const rows = ids.map((id) => meta[id]).filter(Boolean) as { title: string; cover: string; duration: number; category?: string }[]

  return (
    // 横屏要给左下舞台区和右下悬浮导航让位，队列内容不能铺到底
    <div className="pb-[calc(124px+env(safe-area-inset-bottom))] sm:pb-[calc(128px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-outline-variant bg-surface-container-low px-2 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-on-surface hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
          aria-label="返回"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 text-[18px] font-bold text-on-surface">播放队列</h1>
        <span className="pr-2 text-[13px] text-on-surface-variant">{ids.length} 期</span>
      </header>

      {ids.length > 0 && (
        <div className="flex gap-2 px-4 pt-1 pb-3">
          <button
            type="button"
            onClick={() => playAll()}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-medium text-on-primary hover:brightness-110 active:brightness-95"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4l14 8-14 8z" />
            </svg>
            播放全部
          </button>
          <button
            type="button"
            onClick={() => {
              clear()
              // 清空后回到普通播放：接着放当前这期，不再被自定义队列串走
              const cur = usePlayer.getState().current
              if (cur) playCustomQueue([cur])
            }}
            className="h-12 rounded-full border border-outline px-5 text-[15px] text-on-surface hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
          >
            清空
          </button>
        </div>
      )}

      {!ids.length && (
        <div className="px-4 py-10 text-center text-[15px] text-on-surface-variant">
          队列是空的
          <div className="mt-2 text-[14px] text-outline">在卡片右下角点「＋」，把节目攒到这里</div>
        </div>
      )}

      <div className="px-2">
        {rows.map((row, i) => (
          <div
            key={ids[i]}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-2 py-2',
              ids[i] === current?.radioId ? 'bg-primary-container' : 'hover:bg-on-surface/[0.06]',
            )}
          >
            <span
              className={cn(
                'w-4 shrink-0 text-center text-[13px]',
                ids[i] === current?.radioId ? 'text-on-primary-container' : 'text-outline',
              )}
            >
              {ids[i] === current?.radioId ? '\u25b6' : i + 1}
            </span>
            <button
              type="button"
              onClick={() => {
                // 从这一首开始播，整条队列继续往后走
                const start = i
                const tracks = ids.slice(start).map((id) => trackOf(meta[id], id))
                playCustomQueue(tracks)
              }}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <CoverImage src={row.cover} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block truncate text-[15px]',
                    ids[i] === current?.radioId ? 'text-on-primary-container' : 'text-on-surface',
                  )}
                >
                  {row.title || '节目'}
                </span>
                <span
                  className={cn(
                    'mt-0.5 block truncate text-[13px]',
                    ids[i] === current?.radioId ? 'text-on-primary-container/80' : 'text-on-surface-variant',
                  )}
                >
                  {row.category ? `${row.category} · ` : ''}
                  {formatTime(row.duration)}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => remove(ids[i])}
              aria-label="从队列移除"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      {ids.length > 0 && <div className="h-24" />}
      {index >= 0 && <div className="h-20" />}
    </div>
  )
}
