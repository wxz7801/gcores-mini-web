import { NavLink } from 'react-router-dom'
import { cn } from '../lib/format'
import { useWideLandscape } from '../hooks/useLayout'
import { Icon } from './Icon'
import type { SymbolName } from '../lib/symbols'

/** 导航条目：发现 · 播单 · 有声书 · 我的（栏目已由播单替代） */
const items: { to: string; label: string; icon: SymbolName }[] = [
  { to: '/', label: '发现', icon: 'home' },
  { to: '/playlists', label: '播单', icon: 'playlist_play' },
  { to: '/audiobooks', label: '有声书', icon: 'auto_stories' },
  { to: '/me', label: '我的', icon: 'person' },
]

/**
 * M3 navigation bar。
 *
 * 构件语义换成 M3 的：
 * - 容器 surface-container + 顶部一条 outline-variant（不悬浮、不磨砂、不带阴影，
 *   悬浮在内容之上这件事由 M3 的 navigation bar 本身承担，不需要玻璃效果）；
 * - 每个目标是图标 + 文字的 stacked item，命中区 48px 起；
 * - 选中态用 active indicator：secondary-container 的 pill 包住图标，
 *   on-secondary-container 的字根据 M3 规范，图标下面的文字一起换色；
 * - 未选中用 on-surface-variant。
 */
export function FloatingNav() {
  const wide = useWideLandscape()
  return (
    <nav
      aria-label="主导航"
      className={cn(
        'z-40 flex items-stretch gap-1 border-t border-outline-variant bg-surface-container',
        // 横屏：内容区里的一条居中栏（舞台占了左侧，导航跟着内容走）——fixed，贴着视口底
        wide && 'fixed',
        // 竖屏：整宽贴底，和上面的播放条堆叠成「控制栏 / 底栏」两层，不再做成悬浮胶囊
        wide
          ? 'bottom-0 left-1/2 w-[480px] max-w-[52vw] -translate-x-1/2 rounded-t-xl px-2'
          // 竖屏的底栏是普通文档流的一层（不是 fixed）：上面的播放条要压在它上方，
          // 两者按顺序堆叠，播放条就不需要再算 bottom 偏移
          : 'relative w-full px-1.5 pb-[env(safe-area-inset-bottom)]',
      )}
    >
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/'}
          className={(s) =>
            cn(
              'group relative flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[12px] transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              wide ? 'pt-2.5 pb-2' : 'pt-2 pb-1.5',
              s.isActive
                ? 'font-medium text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]',
            )
          }
        >
          {(s) => (
            <>
              {/* active indicator：32×32 的药丸，图标居中 */}
              <span
                className={cn(
                  'flex h-8 w-16 items-center justify-center rounded-full transition-colors duration-150',
                  s.isActive ? 'bg-secondary-container' : 'bg-transparent',
                )}
              >
                <Icon name={it.icon} size={24} />
              </span>
              <span className="leading-none">{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
