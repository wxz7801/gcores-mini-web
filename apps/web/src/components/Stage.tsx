import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../store/player'
import { formatTime } from '../lib/format'
import { CoverImage } from './CoverImage'

/**
 * 横屏左侧舞台区（大屏唯一的播放控制）。
 *
 * 布局：大封面（点它进节目详情，时间轴在详情页里并自动跟到当前进度）+ 播放控制栏。
 * 触摸约束：屏幕最左侧是车机/支架的物理按键区，所以舞台容器本身
 * `pointer-events: none`，只有内部 `.stage-interactive` 的元素可点。
 */
export function Stage() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <StagePanel />
    </div>
  )
}

/** 播放面板：容器不接收触摸，这块面板整体可点（点封面进详情），内部按钮各自处理 */
function StagePanel() {
  const current = usePlayer((s) => s.current)
  const position = usePlayer((s) => s.position)
  const playing = usePlayer((s) => s.playing)
  const duration = usePlayer((s) => s.duration)
  const loading = usePlayer((s) => s.loading)
  const navigate = useNavigate()
  const toggle = usePlayer((s) => s.toggle)
  const next = usePlayer((s) => s.next)
  const prev = usePlayer((s) => s.prev)
  const skip = usePlayer((s) => s.skip)
  const seek = usePlayer((s) => s.seek)

  if (!current) {
    return (
      <div className="stage-interactive flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" className="text-outline-variant">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <path d="M9 8.5v7l6-3.5z" />
        </svg>
        <div className="text-[14px] leading-relaxed text-on-surface-variant">
          左侧留给车机 / 支架上的实体控件
          <br />
          播放电台后这里会显示封面与播放控制
        </div>
      </div>
    )
  }

  const total = duration || current.duration || 0
  const pct = total > 0 ? Math.min(100, (position / total) * 100) : 0
  const openDetail = () => navigate(`/radio/${current.radioId}`)

  return (
    <div className="stage-interactive flex h-full flex-col px-4 pt-4 pb-3">
      {/* 上：大封面（点进节目详情，时间轴在详情页里） */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`进入节目详情：${current.title}`}
        onClick={openDetail}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openDetail()
          }
        }}
        className="group flex min-h-0 flex-1 flex-col focus:outline-none"
        style={{ cursor: 'pointer' }}
      >
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {/* 按封面真实宽高比放大到可用区域（不裁切、不拉伸），竖版/方图/横版都保持原样。
              父容器是 flex 项，直接给 img 百分比高度会被撑破，所以用绝对定位兜住 */}
          <CoverImage
            src={current.cover}
            className="absolute inset-0 m-auto max-h-full max-w-full rounded-xl object-contain"
            eager
          />
        </div>
        <div className="mt-3 shrink-0">
          <div className="line-clamp-2 text-[19px] leading-snug font-semibold text-on-surface">{current.title}</div>
          <div className="mt-1 truncate text-[13px] text-on-surface-variant">
            {current.djs?.length ? current.djs.join(' · ') : '机核'}
            {current.category ? ` · ${current.category}` : ''}
          </div>
        </div>
      </div>

      {/* 下：进度 + 控制栏（对齐机核 App 播放条） */}
      <div className="mt-3 shrink-0">
        <div className="mb-1 flex items-center justify-between font-mono text-[13px] tabular-nums text-on-surface-variant">
          <span className="text-on-surface">{formatTime(position)}</span>
          <span>{formatTime(total)}</span>
        </div>
        <StageSeekBar pct={pct} position={position} total={total} onSeek={seek} />

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
    </div>
  )
}

/** 可点可拖的进度条 */
function StageSeekBar({
  pct,
  position,
  total,
  onSeek,
}: {
  pct: number
  position: number
  total: number
  onSeek: (sec: number) => void
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
      className="relative flex h-14 items-center touch-none"
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

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
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