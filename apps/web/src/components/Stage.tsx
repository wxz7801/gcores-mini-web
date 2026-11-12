import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../store/player'
import { CoverImage } from './CoverImage'
import { PlayerControls } from './PlayerControls'

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
  const navigate = useNavigate()

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

  const openDetail = () => navigate(`/radio/${current.radioId}`)

  return (
    <div className="@container stage-interactive flex h-full flex-col px-4 pt-4 pb-3">
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
        className="group my-auto flex min-h-0 flex-col focus:outline-none"
        style={{ cursor: 'pointer' }}
      >
        {/* 封面按栏宽等比封顶（栏宽 372 → 约 264px 高，和常见方图的边长差不多），
            不再用 flex-1 把封面拽满整栏 */}
        <div className="relative flex items-center justify-center" style={{ height: '71cqw', maxHeight: '100%' }}>
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

        {/* 进度 + 控制栏：与竖屏底部堆叠共用同一个组件，保证按钮与尺寸一致 */}
        <PlayerControls className="mt-3 shrink-0" />
      </div>
    </div>
  )
}
