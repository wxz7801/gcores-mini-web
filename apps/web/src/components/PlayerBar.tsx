import { usePlayer } from '../store/player'
import { CoverImage } from './CoverImage'
import { PlayerControls } from './PlayerControls'

/**
 * 竖屏底部播放条：压在 navigation bar 上方的常驻一层。
 *
 * 与横屏左侧舞台里的控制栏共用 PlayerControls（时间 + 进度 + 一行五宫格），
 * 这里在底部、那里跟着封面。分界仍只留一条 outline-variant
 * （M3：同一条边界不叠加底色变化 + 描边 + 阴影）。点上半条打开全屏播放页。
 */
export function PlayerBar() {
  const current = usePlayer((s) => s.current)
  const setExpanded = usePlayer((s) => s.setExpanded)

  // 没有在播时也给一条占位条：播放条永远钉在底部，不会因为「还没播」而消失
  if (!current) {
    return (
      <div className="relative flex h-16 w-full shrink-0 items-center justify-center border-t border-outline-variant bg-surface-container-high">
        <span className="text-[13px] text-on-surface-variant">选择一期节目开始收听</span>
      </div>
    )
  }

  return (
    <div className="relative shrink-0 border-t border-outline-variant bg-surface-container-high">
      {/* 上半条点开全屏播放页；下半条是播放控制 */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(true)
          }
        }}
        aria-label={`打开播放页：${current.title}`}
        className="flex w-full items-center gap-2 px-3 pt-2 pr-2"
      >
        <CoverImage src={current.cover} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-on-surface">{current.title}</div>
          <div className="truncate text-[12px] text-on-surface-variant">
            {current.djs?.length ? current.djs.join(' · ') : '机核'}
          </div>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 15l6-6 6 6" />
          </svg>
        </span>
      </div>
      <div className="px-3 pb-1">
        <PlayerControls seekHeight={36} />
      </div>
    </div>
  )
}
