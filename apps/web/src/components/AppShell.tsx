import type { ReactNode } from 'react'
import { cn } from '../lib/format'
import { useWideLandscape } from '../hooks/useLayout'

/**
 * 应用外壳：
 * - 竖屏（< 900px 或 portrait）：单列，底部 Tab，无禁区
 * - 横屏（≥ 900px 且 landscape）：左侧舞台区（禁区）+ 内容区，导航统一放在底部
 */
export function AppShell({
  stage,
  children,
  footer,
  title,
}: {
  stage?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** 这一页的名字。舞台在没有播放时用它做占位标题（例如「播单」），而不是固定写「有声书」 */
  title?: string
}) {
  const wide = useWideLandscape()

  // 只渲染一套布局：避免同一页面挂载两份（会重复请求、重复上报）
  if (!wide) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-ink">
        {/* 底部播放条 + 悬浮导航是常驻的，内容区留出高度，滚到底不会被压住 */}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[124px]">{children}</main>
        {footer}
      </div>
    )
  }

  // 横屏：左侧舞台已包含全部播放控制，底部不再挂播放条，只留悬浮导航
  return (
    <div className="flex h-full w-full overflow-hidden bg-ink">
      {/* 左侧舞台区：容器本身不接收触摸（pointer-events:none），只有内部播放面板例外 */}
      <aside className="dead-zone shrink-0" style={{ width: 'var(--dead-zone)' }}>
        <StageSlot title={title}>{stage}</StageSlot>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 横屏：内容区限宽居中，超宽屏（>1600px）下网格列不会缩得过小 */}
        <main className="mx-auto min-h-0 w-full max-w-[1440px] flex-1 overflow-y-auto overscroll-contain pb-[124px] 2xl:max-w-[1600px]">
          {children}
        </main>
      </div>
      {footer}
    </div>
  )
}

/**
 * 舞台槽位：竖屏不渲染舞台（没有左侧栏），横屏才挂。
 * 页面名（title）透传给 Stage，未播放时左侧显示「播单 / 有声书 / 节目」而不是写死的占位。
 */
function StageSlot({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="h-full w-full" data-stage-title={title ?? ''}>
      {children}
    </div>
  )
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[19px] font-bold text-white">{title}</h2>
      {action}
    </div>
  )
}

export function ChipRail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('no-scrollbar flex gap-2 overflow-x-auto px-4 py-1', className)}>{children}</div>
  )
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full px-4 text-[15px] transition-colors',
        'min-h-[44px]', // chips 44，热区再被 .tap 伪元素撑到 48
        active ? 'bg-gcores text-white' : 'bg-card text-[#cfd3da] active:bg-[#2a2f3a]',
      )}
    >
      {children}
    </button>
  )
}