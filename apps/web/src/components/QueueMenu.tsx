import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueueStore } from '../store/queue'
import { usePlayer } from '../store/player'
import type { Track } from '../store/player'
import { CoverImage } from './CoverImage'
import { cn, formatTime } from '../lib/format'

/**
 * 悬浮菜单（参考 gcores.com 卡片上的 “+” 浮层）：
 * 不跳页，就地加入队列 / 立即播放 / 打开节目详情。
 */
export function QueueMenu({ track, onClose }: { track: Track; onClose: () => void }) {
  const queuedIds = useQueueStore((s) => s.ids)
  const addId = useQueueStore((s) => s.addId)
  const remove = useQueueStore((s) => s.remove)
  const playCustomQueue = usePlayer((s) => s.playCustomQueue)
  const queued = queuedIds.includes(track.radioId)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!added) return
    const t = window.setTimeout(() => setAdded(false), 1600)
    return () => window.clearTimeout(t)
  }, [added])

  return (
    <>
      <div className="absolute inset-0 z-20" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="节目操作"
        className="absolute bottom-2 right-2 z-30 w-[248px] overflow-hidden rounded-2xl border border-line bg-[#1b1f26] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <CoverImage src={track.cover} className="h-10 w-10 shrink-0 rounded object-cover" />
          <div className="min-w-0">
            <div className="truncate text-[15px] text-white">{track.title}</div>
            <div className="text-[13px] text-[#7d8594]">{formatTime(track.duration)}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (queued) return
            // 走 addId 而不是 toggle：+ 的语义就是“加进来”，再点一次不应删掉
            addId(track)
            setAdded(true)
          }}
          className={cn(
            'flex min-h-[52px] w-full items-center gap-2.5 px-4 text-left text-[16px]',
            queued ? 'text-[#7d8594]' : 'text-[#e8eaef] active:bg-white/5',
          )}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h11M4 12h8M4 17h6M18 8v8M14 12h8" />
          </svg>
          {queued ? '已在播放队列' : added ? '已加入播放队列' : '加入播放队列'}
        </button>
        <button
          type="button"
          onClick={() => {
            // 现在就用这条队列开播；之后上一集/下一集都在这条队列里走
            const ids = queued ? queuedIds : [...queuedIds, track.radioId]
            const meta = useQueueStore.getState().meta
            const tracks = ids.map((id) => {
              const m = meta[id]
              return {
                radioId: id,
                title: m?.title ?? '节目',
                cover: m?.cover ?? '',
                duration: m?.duration ?? 0,
                mediaType: 'audio' as const,
                category: m?.category,
              }
            })
            const at = tracks.findIndex((t) => t.radioId === track.radioId)
            playCustomQueue(at > 0 ? [...tracks.slice(at), ...tracks.slice(0, at)] : tracks)
            onClose()
          }}
          className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-left text-[16px] text-[#5b9dff] min-h-[52px] active:bg-white/5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4l14 8-14 8z" />
          </svg>
          立即播放
        </button>
        <Link
          to={`/radio/${track.radioId}`}
          onClick={onClose}
          className="flex min-h-[52px] w-full items-center gap-2.5 px-4 text-[16px] text-[#e8eaef] active:bg-white/5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8v-.01M12 12v4" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          节目详情
        </Link>
        {queued && (
          <button
            type="button"
            onClick={() => {
              remove(track.radioId)
              onClose()
            }}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-left text-[16px] text-[#8a92a3] min-h-[52px] active:bg-white/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" />
            </svg>
            从队列移除
          </button>
        )}
      </div>
    </>
  )
}
