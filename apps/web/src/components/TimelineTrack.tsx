import type { Timeline } from '../api/gcores'
import { cn } from '../lib/format'

/**
 * 时间轴刻痕：把章节时间点画在进度条上（参考机核 App 播放器里的金色刻度）。
 * 只画刻痕，不接收点击——点击/拖拽由外层的 seek 条统一处理，避免两套手势打架。
 */
export function TimelineTicks({
  timelines,
  duration,
  className,
  tone = 'gold',
}: {
  timelines: Timeline[]
  duration: number
  className?: string
  tone?: 'gold' | 'muted'
}) {
  if (!timelines.length || duration <= 0) return null
  return (
    <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden="true">
      {timelines.map((t) => {
        const pct = Math.min(100, Math.max(0, (t.at / duration) * 100))
        return (
          <span
            key={t.id}
            className={cn('absolute top-0 h-full w-[2px] -translate-x-1/2 rounded-full', tone === 'gold' ? 'bg-timeline/90' : 'bg-timeline/60')}
            style={{ left: `${pct}%` }}
          />
        )
      })}
    </div>
  )
}

/** 时间轴条目：播放键 + 标题 + 时间（机核 App 里时间轴卡片的样式） */
export function TimelinePill({
  at,
  title,
  active,
  onClick,
}: {
  at: number
  title: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex max-w-full items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-left',
        active ? 'bg-gcores text-white' : 'bg-white/8 text-[#cfd3da] active:bg-white/15',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          active ? 'bg-white/25 text-white' : 'bg-white/12 text-white',
        )}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M7 4l14 8-14 8z" />
        </svg>
      </span>
      <span className="truncate text-[15px] font-medium">{title}</span>
      <span className={cn('shrink-0 text-[14px] tabular-nums', active ? 'text-white/80' : 'text-[#8a92a3]')}>
        {toClock(at)}
      </span>
    </button>
  )
}

function toClock(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

/** 当前进度落在第几条时间轴 */
export function activeTimeline(timelines: Timeline[], position: number): Timeline | null {
  let hit: Timeline | null = null
  for (const t of timelines) {
    if (t.at <= position + 0.5) hit = t
    else break
  }
  return hit
}
