import { useTheme } from '../hooks/useTheme'

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
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={toLight ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth={toLight ? 1.8 : 0}
        strokeLinecap="round"
        aria-hidden="true"
      >
        {toLight ? (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.6v2.2M12 19.2v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
          </>
        ) : (
          <path d="M20.5 14.6A8.6 8.6 0 019.4 3.5a8.6 8.6 0 1011.1 11.1z" />
        )}
      </svg>
    </button>
  )
}
