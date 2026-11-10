import { cn } from '../lib/format'

export interface TopTab {
  id: string
  label: string
}

/**
 * 首页顶部页签。
 *
 * 触屏约束：页签本身不常驻悬浮——鼠标/手指一滚动它会盖住内容（用户反馈的“底部导航做的不对”）。
 * 这里给出两种形态，由页面自己决定：
 * - variant="static"：跟内容一起滚走（默认）
 * - variant="float"：内容滚过头部后才浮出来，且浮在标题下方而不是压在内容上
 */
export function TopTabs({
  tabs,
  value,
  onChange,
  variant = 'static',
  className,
}: {
  tabs: TopTab[]
  value: string
  onChange: (id: string) => void
  variant?: 'static' | 'float'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex gap-5 px-4',
        variant === 'float'
          ? 'pointer-events-auto mx-2 mb-2 w-fit rounded-full border border-line/70 bg-ink/85 px-3 backdrop-blur-xl'
          : '',
        className,
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-pressed={value === t.id}
          className={cn(
            'relative flex min-h-[44px] items-center pb-2 text-[17px]',
            value === t.id ? 'font-bold text-white' : 'text-[#8a92a3]',
          )}
        >
          {t.label}
          {value === t.id && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-white" />}
        </button>
      ))}
    </div>
  )
}
