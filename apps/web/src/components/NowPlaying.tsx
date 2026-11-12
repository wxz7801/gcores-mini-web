import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../store/player'
import { useWideLandscape } from '../hooks/useLayout'
import { cn, formatTime, SKIP_SECONDS } from '../lib/format'
import { CoverImage } from './CoverImage'
import { Icon } from './Icon'

const RATES = [0.75, 1, 1.25, 1.5, 2]

/**
 * 全屏播放页。
 * - 竖屏：从底部上滑的全屏面板，顶部有下拉把手
 * - 横屏：右侧内容区铺开，左侧舞台区仍保持禁区（由 AppShell 负责）
 */
export function NowPlaying() {
  const expanded = usePlayer((s) => s.expanded)
  const setExpanded = usePlayer((s) => s.setExpanded)
  const current = usePlayer((s) => s.current)
  const playing = usePlayer((s) => s.playing)
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  const rate = usePlayer((s) => s.rate)
  const loading = usePlayer((s) => s.loading)
  const error = usePlayer((s) => s.error)
  const toggle = usePlayer((s) => s.toggle)
  const next = usePlayer((s) => s.next)
  const prev = usePlayer((s) => s.prev)
  const seek = usePlayer((s) => s.seek)
  const skip = usePlayer((s) => s.skip)
  const setRate = usePlayer((s) => s.setRate)
  const wide = useWideLandscape()

  const [drag, setDrag] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [rateOpen, setRateOpen] = useState(false)

  // 打开时锁住页面滚动
  useEffect(() => {
    if (!expanded) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [expanded])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
      if (e.key === ' ') {
        e.preventDefault()
        toggle()
      }
      if (e.key === 'ArrowLeft') skip(-SKIP_SECONDS)
      if (e.key === 'ArrowRight') skip(SKIP_SECONDS)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, setExpanded, toggle, skip])

  if (!expanded || !current) return null


  const total = duration || current.duration || 0
  const shown = drag ?? position
  const ratio = total > 0 ? Math.min(1, Math.max(0, shown / total)) : 0

  const seekFromEvent = (clientX: number) => {
    const el = barRef.current
    if (!el || total <= 0) return
    const r = el.getBoundingClientRect()
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    return p * total
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-surface',
        // 横屏时让出左侧禁区（右侧导航已移到底部，整块高度归内容）
        wide ? 'left-[var(--dead-zone)]' : '',
      )}
      role="dialog"
      aria-modal="true"
      aria-label="正在播放"
    >
      <div className="relative flex min-h-0 flex-1 flex-col px-5 pb-5 pt-2">
        {/* 顶部：收起 */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="收起播放页"
            onClick={() => setExpanded(false)}
            className="flex h-14 w-14 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
          >
            <Icon name="expand_more" size={28} />
          </button>
          <div className="text-[13px] tracking-wide text-on-surface-variant">正在播放</div>
          <Link
            to={`/radio/${current.radioId}`}
            onClick={() => setExpanded(false)}
            aria-label="节目详情"
            className="flex h-14 w-14 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
          >
            <Icon name="info" size={26} />
          </Link>
        </div>

        {/* 封面 */}
        <div className="flex min-h-0 flex-1 items-center justify-center py-3">
          <div
            className="w-full"
            style={{ maxWidth: wide ? 400 : 300 }}
          >
            <CoverImage
              src={current.cover}
              className={cn('aspect-square w-full rounded-xl object-cover', !playing && 'opacity-80')}
            />
          </div>
        </div>

        {/* 标题 */}
        <div className="min-h-0">
          <Link
            to={`/radio/${current.radioId}`}
            onClick={() => setExpanded(false)}
            className="line-clamp-2 text-[22px] font-bold leading-snug text-on-surface"
          >
            {current.title}
          </Link>
          <div className="mt-1.5 flex items-center gap-2 text-[14px] text-on-surface-variant">
            <span className="min-w-0 truncate">
              {current.djs?.length ? current.djs.join(' · ') : ''}
              {current.category ? (current.djs?.length ? ' · ' : '') + current.category : ''}
            </span>
            <Link
              to={`/radio/${current.radioId}`}
              onClick={() => setExpanded(false)}
              className="flex h-11 shrink-0 items-center rounded-full bg-secondary-container px-4 text-[15px] font-medium text-on-secondary-container hover:brightness-110 active:brightness-95"
            >
              时间轴 ›
            </Link>
          </div>
        </div>

        {/* 进度条：整条 40px 高，触摸命中区足够 */}
        <div className="mt-2">
          <div
            ref={barRef}
            className="relative -mx-2 flex h-14 cursor-pointer touch-none items-center px-2"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              setDrag(seekFromEvent(e.clientX) ?? 0)
            }}
            onPointerMove={(e) => {
              if (drag == null) return
              setDrag(seekFromEvent(e.clientX) ?? 0)
            }}
            onPointerUp={(e) => {
              if (drag == null) return
              seek(seekFromEvent(e.clientX) ?? drag)
              setDrag(null)
            }}
            onPointerCancel={() => setDrag(null)}
          >
            <div className="relative h-[6px] w-full overflow-hidden rounded-full bg-surface-variant">
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
            </div>
            <div
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary outline-2 outline-surface"
              style={{ left: `calc(${ratio * 100}% + 8px)` }}
            />
          </div>
          <div className="flex justify-between text-[13px] tabular-nums text-on-surface-variant">
            <span>{formatTime(shown)}</span>
            <span>-{formatTime(Math.max(0, total - shown))}</span>
          </div>
        </div>

        {/* 控制区 */}
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            aria-label={`后退${SKIP_SECONDS}秒`}
            onClick={() => skip(-SKIP_SECONDS)}
            className="flex h-16 w-16 items-center justify-center rounded-full text-on-surface hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
          >
            <Icon name="replay_10" size={34} />
          </button>
          <button
            type="button"
            aria-label="上一期"
            onClick={prev}
            className="flex h-16 w-16 items-center justify-center rounded-full text-on-surface hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
          >
            <PrevIcon />
          </button>
          <button
            type="button"
            aria-label={playing ? '暂停' : '播放'}
            onClick={toggle}
            disabled={loading}
            className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-primary text-on-primary hover:brightness-110 active:scale-95 active:brightness-95 disabled:opacity-60"
          >
            {loading ? <Spinner /> : playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            aria-label="下一期"
            onClick={next}
            className="flex h-16 w-16 items-center justify-center rounded-full text-on-surface hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
          >
            <NextIcon />
          </button>
          <button
            type="button"
            aria-label={`前进${SKIP_SECONDS}秒`}
            onClick={() => skip(SKIP_SECONDS)}
            className="flex h-16 w-16 items-center justify-center rounded-full text-on-surface hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
          >
            <Icon name="forward_10" size={34} />
          </button>
        </div>

        {/* 底部工具栏 */}
        <div className="mt-3 flex items-center justify-center gap-3 border-t border-outline-variant pt-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setRateOpen((v) => !v)}
              className="flex h-14 min-w-16 items-center justify-center rounded-xl border border-outline px-4 text-[16px] text-on-surface hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
            >
              {rate === 1 ? '倍速' : `${rate}×`}
            </button>
            {rateOpen && (
              <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-1 rounded-xl bg-surface-container-high p-2 shadow-[var(--m3-elevation-2)]">
                {RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRate(r)
                      setRateOpen(false)
                    }}
                    className={cn(
                      'h-12 min-w-14 rounded-xl px-2 text-[16px] transition-colors',
                      r === rate
                        ? 'bg-secondary-container font-medium text-on-secondary-container'
                        : 'text-on-surface hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]',
                    )}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link
            to="/queue"
            onClick={() => setExpanded(false)}
            aria-label="播放队列"
            className="flex h-14 min-w-16 items-center justify-center rounded-xl border border-outline px-4 text-[16px] text-on-surface hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
          >
            队列
          </Link>
        </div>

        {error && (
          <div className="mt-2 rounded-xl bg-error-container px-3 py-2 text-center text-[14px] text-on-error-container">{error}</div>
        )}
      </div>
    </div>
  )
}

function PlayIcon() {
  return <Icon name="play_arrow" size={38} />
}
function PauseIcon() {
  return <Icon name="pause" size={38} />
}
function PrevIcon() {
  return <Icon name="skip_previous" size={32} />
}
function NextIcon() {
  return <Icon name="skip_next" size={32} />
}
function Spinner() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" fill="none" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}