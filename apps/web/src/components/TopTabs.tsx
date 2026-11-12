import { cn } from '../lib/format'

export interface TopTab {
  id: string
  label: string
}

/**
 * 内容区顶部页签（M3 primary tabs）。
 *
 * 触屏约束：页签本身不常驻悬浮——鼠标/手指一滚动它会盖住内容（用户反馈的「底部导航做的不对」）。
 * 这里给出两种形态，由页面自己决定：
 * - variant="static"：跟内容一起滚走（默认）
 * - variant="float"：内容滚过头部后才浮出来，且浮在标题下方而不是压在内容上
 *
 * M3 的做法：文字页签用 primary 表示选中、on-surface-variant 表示未选中，
 * 选中下划线用 primary 且只画在文字宽度上（不再用白色满宽下划线）；
 * 浮动版是一块不透明的 surface-container-low 分段条，不是玻璃胶囊。
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
        'flex gap-5 px-3',
        variant === 'float'
          ? 'pointer-events-auto mx-2 mb-2 w-fit rounded-full border border-outline-variant bg-surface-container-low'
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
            'relative flex min-h-[48px] items-center pb-2 text-[15px] transition-colors',
            value === t.id ? 'font-medium text-primary' : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          {t.label}
          {value === t.id && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-primary" />}
        </button>
      ))}
    </div>
  )
}