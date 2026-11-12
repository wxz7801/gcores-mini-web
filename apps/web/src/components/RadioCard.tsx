import { useNavigate } from 'react-router-dom'
import { CoverImage } from './CoverImage'
import type { RadioListItem } from '../api/gcores'
import { coverUrl, formatTime, relativeDate, cn, plural } from '../lib/format'
import { usePlayer } from '../store/player'
import { toTrack } from './RadioRow'
import { useState } from 'react'
import { useQueueStore } from '../store/queue'
import { QueueMenu } from './QueueMenu'

/**
 * 站台式节目卡（参考 gcores.com/radios 的卡片）：
 * 16:9 缩略图 + 时长角标 + 播放量角标 + 播放按钮，下方是栏目名 / 标题 / 主播 / 数据。
 * 触屏要点：所有按钮 ≥44px 热区、不依赖 hover（不可见的 +/- 按钮常驻但半透明）、
 * 图片比例固定避免加载时跳动、标题两行截断。
 */
export function RadioCard({
  radio,
  queue,
  showDj = true,
}: {
  radio: RadioListItem
  queue?: RadioListItem[]
  showDj?: boolean
}) {
  const nav = useNavigate()
  const currentId = usePlayer((s) => s.current?.radioId)
  const playing = usePlayer((s) => s.playing)
  const playTrack = usePlayer((s) => s.playTrack)
  const toggle = usePlayer((s) => s.toggle)
  const queuedIds = useQueueStore((s) => s.ids)
  const [menuOpen, setMenuOpen] = useState(false)

  const isCurrent = currentId === radio.id
  const isPlaying = isCurrent && playing
  const queued = queuedIds.includes(radio.id)
  const channel = radio.categories[0]?.name ?? (radio.isFm ? '机核 FM' : '机核播客')

  return (
    <article className="group relative">
      <button
        type="button"
        onClick={() => nav(`/radio/${radio.id}`)}
        className="block w-full text-left"
        aria-label={radio.title}
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-surface-container max-sm:rounded-lg">
          <CoverImage src={coverUrl(radio.thumb || radio.cover, 480, 270)} className="h-full w-full object-cover" />

          {/* 时长角标（左上） */}
          <span className="absolute top-1 left-1 flex items-center gap-1 rounded-md bg-[var(--m3-scrim)] px-1 py-0.5 text-[11px] leading-none text-white sm:top-2 sm:left-2 sm:px-1.5 sm:text-[13px]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <circle cx="6.5" cy="18" r="2.5" />
              <circle cx="16.5" cy="16" r="2.5" />
            </svg>
            {formatTime(radio.duration)}
          </span>

          {/* 播放量角标（右上，无播放量时隐藏） */}
          {radio.plays > 0 && (
            <span className="absolute top-1 right-1 hidden items-center gap-1 rounded-md bg-[var(--m3-scrim)] px-1 py-0.5 text-[11px] leading-none text-white sm:top-2 sm:right-2 sm:flex sm:px-1.5 sm:text-[13px]">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M7 4l14 8-14 8z" />
              </svg>
              {plural(radio.plays)}
            </span>
          )}

          {/* 触屏常驻播放按钮（PC 上 hover 才出现，避免整张图被一块玻璃盖住） */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              if (isCurrent) {
                toggle()
                return
              }
              void playTrack(toTrack(radio), (queue ?? []).map((r) => toTrack(r)))
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), e.preventDefault(), isCurrent ? toggle() : void playTrack(toTrack(radio), (queue ?? []).map((r) => toTrack(r))))}
            aria-label={isPlaying ? '暂停' : '播放'}
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-[var(--m3-scrim)] transition-opacity',
              isCurrent ? 'opacity-100' : 'opacity-0 [@media(hover:none)]:opacity-100 group-hover:opacity-100',
            )}
          >
            <span
              className={cn(
                'flex h-[54px] w-[54px] items-center justify-center rounded-full sm:h-16 sm:w-16',
                isCurrent
                  ? 'bg-primary text-on-primary'
                  : 'bg-[var(--m3-media-overlay)] text-white outline-1 outline-white/40',
              )}
            >
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 4l14 8-14 8z" />
                </svg>
              )}
            </span>
          </span>

          {radio.isRequirePrivilege && (
            <span className="absolute bottom-1 left-1 rounded-md bg-timeline-container px-1 py-0.5 text-[11px] leading-none font-bold text-on-timeline-container sm:bottom-2 sm:left-2 sm:px-1.5 sm:text-[12px]">
              GPASS
            </span>
          )}

          {/* 加入队列：点开悬浮菜单（对齐官网卡片上的 + 浮层） */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              setMenuOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation()
                e.preventDefault()
                setMenuOpen(true)
              }
            }}
            aria-label={queued ? '已在队列中' : '加入播放队列'}
            aria-haspopup="dialog"
            className="absolute right-1.5 bottom-1.5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--m3-scrim)] text-white active:bg-[var(--m3-media-overlay)] sm:right-2 sm:bottom-2 sm:h-12 sm:w-12"
          >
            {queued ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          </span>
        </div>
      </button>

      {menuOpen && <QueueMenu track={toTrack(radio)} onClose={() => setMenuOpen(false)} />}

      <button type="button" onClick={() => nav(`/radio/${radio.id}`)} className="mt-2 block w-full text-left">
        <div className="flex items-center gap-1.5 text-[13px] leading-none sm:text-[14px]">
          {radio.isFm ? (
            <span className="truncate text-primary">机核 FM</span>
          ) : (
            <span className="truncate text-primary">{channel}</span>
          )}
          <span className="hidden shrink-0 text-[13px] text-tertiary sm:inline">更新</span>
        </div>
        <h3 className="mt-1 line-clamp-2 text-[15px] leading-[1.35] text-on-surface sm:mt-1.5 sm:text-[16px] sm:leading-[1.4]">{radio.title}</h3>
        <div className="mt-2 hidden items-center justify-between text-[13px] text-on-surface-variant sm:flex">
          <span className="flex min-w-0 items-center gap-1.5">
            {showDj && radio.djs[0] && (
              <>
                {radio.djs[0].avatar ? (
                  <CoverImage src={coverUrl(radio.djs[0].avatar, 40)} className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-surface-container-highest" />
                )}
                <span className="truncate">{radio.djs[0].nickname}</span>
              </>
            )}
            <span className="shrink-0">{relativeDate(radio.publishedAt)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-0.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 18V9M12 18V4M20 18v-6" strokeLinecap="round" />
              </svg>
              {plural(radio.likes)}
            </span>
            <span className="flex items-center gap-0.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a8 8 0 0 1-11.4 7.2L4 20l1-4.6A8 8 0 1 1 21 12z" />
              </svg>
              {plural(radio.comments)}
            </span>
          </span>
        </div>
      </button>
    </article>
  )
}

/** 自适应网格：竖屏 2 列（一屏能看到 4~6 期），>640px 2 列，>900px 3 列，>1400px 4 列 */
export function RadioGrid({
  items,
  queue,
  className,
}: {
  items: RadioListItem[]
  queue?: RadioListItem[]
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-3 gap-y-5 px-4 sm:gap-x-4 sm:gap-y-7 lg:grid-cols-3 2xl:grid-cols-4', className)}>
      {items.map((r) => (
        <RadioCard key={r.id} radio={r} queue={queue ?? items} />
      ))}
    </div>
  )
}