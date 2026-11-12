import type { ReactNode, Ref } from 'react'
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
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface">
        {/* 底部播放条 + 悬浮导航是常驻的，内容区留出高度，滚到底不会被压住 */}
        {/* 底部是两层堆叠：播放控制栏（64）+ 导航底栏（64），内容留出高度免得被压住 */}
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[140px]">{children}</main>
        {footer}
      </div>
    )
  }

  // 横屏：左侧舞台已包含全部播放控制，底部不再挂播放条，只留悬浮导航
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-surface">
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

/**
 * 吸顶页头。
 *
 * M3 里「吸顶」靠不透明的 surface 维持层级，不靠磨砂：
 * 滚动的内容会从它底下经过，半透明就会透出花掉的文字。
 * 所以这里是实色 surface-container + 一条 outline-variant 弱分隔线，
 * 边框只画在底部一条——头部的上/左右不再额外叠加描边或阴影。
 */
export function PageHeader({
  children,
  className,
  sticky = true,
  ref,
}: {
  children: ReactNode
  className?: string
  sticky?: boolean
  /** 需要量高度（下面还要贴一条吸顶页签）的页面把 ref 递进来 */
  ref?: Ref<HTMLElement>
}) {
  return (
    <header
      ref={ref}
      className={cn(
        'z-20 bg-surface-container-low',
        sticky ? 'sticky top-0' : 'relative',
        'border-b border-outline-variant',
        className,
      )}
    >
      {children}
    </header>
  )
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[19px] font-bold text-on-surface">{title}</h2>
      {action}
    </div>
  )
}

export function ChipRail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('no-scrollbar flex gap-2 overflow-x-auto px-4 py-1', className)}>{children}</div>
  )
}

/**
 * 筛选 chip：M3 里 chip 只承载筛选/属性，不是主操作按钮。
 * - 选中：secondary-container 底 + on-secondary-container 字 + 透明描边兜住形状
 * - 未选中：透明底 + outline 描边 + on-surface-variant 字
 */
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
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-4 text-[15px] transition-colors',
        'min-h-[44px]', // chips 44，热区再被 .tap 伪元素撑到 48
        active
          ? 'border-transparent bg-secondary-container font-medium text-on-secondary-container'
          : 'border-outline text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]',
      )}
    >
      {children}
    </button>
  )
}