import { useTheme } from '../hooks/useTheme'
import { Icon } from './Icon'

/**
 * 深色 / 浅色主题切换。
 *
 * 用 M3 的 icon button：圆形 48px 命中区，状态层走 on-surface 的 8% / 10%。
 * 图标只画「切过去」的结果——深色下显示太阳、浅色下显示月亮，少一层心算。
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const toLight = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={toLight ? '切换到浅色主题' : '切换到深色主题'}
      title={toLight ? '切换到浅色主题' : '切换到深色主题'}
      className={
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1] ' +
        (className ?? '')
      }
    >
      <Icon name={toLight ? 'light_mode' : 'dark_mode'} size={22} />
    </button>
  )
}
