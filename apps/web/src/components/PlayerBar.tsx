import { usePlayer } from '../store/player'
import { CoverImage } from './CoverImage'
import { formatTime } from '../lib/format'

/** 底部迷你播放条（叠加在 Tab 上方，横竖屏一致） */
export function PlayerBar() {
  const current = usePlayer((s) => s.current)
  const playing = usePlayer((s) => s.playing)
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  const loading = usePlayer((s) => s.loading)
  const toggle = usePlayer((s) => s.toggle)
  const next = usePlayer((s) => s.next)
  const setExpanded = usePlayer((s) => s.setExpanded)

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  // 没有在播时也给一条占位条：播放条永远钉在底部，不会因为「还没播」而消失
  if (!current) {
    return (
      <div className="relative flex h-16 w-full shrink-0 items-center justify-center border-t border-line bg-panel">
        <span className="text-[13px] text-[#5c6371]">选择一期节目开始收听</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        // 点迷你条 → 打开全屏播放页（而不是跳详情页）
        setExpanded(true)
      }}
      className="relative block w-full border-t border-line bg-panel text-left"
    >
      <span className="absolute inset-x-0 top-0 h-[3px] bg-line">
        <span className="block h-full bg-gcores" style={{ width: `${pct}%` }} />
      </span>
      <span className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-3 py-2.5 2xl:max-w-[1600px]">
        <CoverImage src={current.cover} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-white">{current.title}</span>
          <span className="mt-1 block truncate text-[13px] text-[#8a92a3]">
            {loading ? '缓冲中…' : `${formatTime(position)} / ${formatTime(duration || current.duration)}`}
          </span>
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.stopPropagation(), toggle())}
          aria-label={playing ? '暂停' : '播放'}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gcores text-white active:brightness-110"
        >
          {playing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4l14 8-14 8z" />
            </svg>
          )}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            next()
          }}
          aria-label="下一个"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[#cfd3da] active:bg-white/10"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 5l10 7-10 7z" />
            <rect x="17" y="5" width="2.5" height="14" rx="1" />
          </svg>
        </span>
      </span>
    </button>
  )
}