import { useState } from 'react'
import { usePlayer } from '../store/player'
import { formatTime } from '../lib/format'

/** 图标钮：命中区 56px，圆形，M3 的 state layer 只用 8% / 10% 两档 */
function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
    >
      {children}
    </button>
  )
}

/**
 * 播放控制栏：时间 + 进度 + 一行五宫格（后退 15 / 上一集 / 播放 / 下一集 / 前进 15）。
 *
 * 横屏大屏放在左侧舞台里紧跟封面；竖屏放在底部堆叠里、压在底栏上方。
 * 两处共用同一份，避免按钮顺序/尺寸各写一套走样。
 */
/** 进度条热区高度：横屏舞台用 56 撑满拖拽区，竖屏堆叠用 36 省高度 */
export type PlayerControlsProps = { className?: string; seekHeight?: number }

export function PlayerControls({ className = '', seekHeight = 56 }: PlayerControlsProps) {
  const position = usePlayer((s) => s.position)
  const playing = usePlayer((s) => s.playing)
  const duration = usePlayer((s) => s.duration)
  const loading = usePlayer((s) => s.loading)
  const current = usePlayer((s) => s.current)
  const toggle = usePlayer((s) => s.toggle)
  const next = usePlayer((s) => s.next)
  const prev = usePlayer((s) => s.prev)
  const skip = usePlayer((s) => s.skip)
  const seek = usePlayer((s) => s.seek)

  const total = duration || current?.duration || 0
  const pct = total > 0 ? Math.min(100, (position / total) * 100) : 0

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between font-mono text-[13px] tabular-nums text-on-surface-variant">
    <span className="text-on-surface">{formatTime(position)}</span>
    <span>{formatTime(total)}</span>
    </div>
    <StageSeekBar pct={pct} position={position} total={total} onSeek={seek} height={seekHeight} />

    <div className="mt-2 grid grid-cols-5 items-center">
      <IconBtn label="后退 15 秒" onClick={() => skip(-15)}>
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M12 5a7 7 0 1 1-6.5 4.5" />
          <path d="M4 4.5V9h4.5" />
          <text x="12" y="15.5" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">15</text>
        </svg>
      </IconBtn>
      <IconBtn label="上一集" onClick={prev}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 5l-10 7 10 7z" />
          <rect x="5" y="5" width="2.5" height="14" rx="1" />
        </svg>
      </IconBtn>
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? '暂停' : '播放'}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary text-on-primary hover:brightness-110 active:brightness-95"
          >
          {playing ? (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4.5" height="16" rx="1" />
            <rect x="13.5" y="4" width="4.5" height="16" rx="1" />
          </svg>
          ) : (
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 4l13 8-13 8z" />
          </svg>
          )}
        </button>
      </div>
      <IconBtn label="下一集" onClick={next}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 5l10 7-10 7z" />
          <rect x="16.5" y="5" width="2.5" height="14" rx="1" />
        </svg>
      </IconBtn>
      <IconBtn label="前进 15 秒" onClick={() => skip(15)}>
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M12 5a7 7 0 1 0 6.5 4.5" />
          <path d="M20 4.5V9h-4.5" />
          <text x="12" y="15.5" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">15</text>
        </svg>
      </IconBtn>
    </div>

    {loading && <div className="mt-1 text-center text-[12px] text-on-surface-variant">缓冲中…</div>}
  </div>
  )
}

/** 可点可拖的进度条 */
function StageSeekBar({
  pct,
  position,
  total,
  onSeek,
  height,
}: {
  pct: number
  position: number
  total: number
  onSeek: (sec: number) => void
  height: number
}) {
  const progressAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * total
  }
  const [drag, setDrag] = useState<number | null>(null)
  const shown = drag ?? pct

  return (
    <div
      role="slider"
      aria-label="播放进度"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(position)}
      tabIndex={0}
      onPointerDown={(e) => {
        if (total <= 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        const v = progressAt(e)
        setDrag(total > 0 ? (v / total) * 100 : 0)
        onSeek(v)
      }}
      onPointerMove={(e) => {
        if (drag === null || total <= 0) return
        setDrag((progressAt(e) / total) * 100)
      }}
      onPointerUp={(e) => {
        if (drag !== null && total > 0) onSeek(progressAt(e))
        setDrag(null)
      }}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, position - 15))
        if (e.key === 'ArrowRight') onSeek(Math.min(total, position + 15))
      }}
      className="relative flex items-center touch-none"
      style={{ height }}
    >
      <div className="relative h-[6px] w-full rounded-full bg-surface-variant">
        <div className="h-full rounded-full bg-primary" style={{ width: `${shown}%` }} />
        <div
          className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary outline-2 outline-surface"
          style={{ left: `${shown}%` }}
        />
      </div>
    </div>
  )
}
