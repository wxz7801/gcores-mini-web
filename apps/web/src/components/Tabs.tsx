import { NavLink } from 'react-router-dom'
import { cn } from '../lib/format'
import { useWideLandscape } from '../hooks/useLayout'

/** 导航条目：发现 · 播单 · 有声书 · 我的（栏目已由播单替代） */
const items = [
  { to: '/', label: '发现', icon: HomeIcon },
  { to: '/playlists', label: '播单', icon: GridIcon },
  { to: '/audiobooks', label: '有声书', icon: BookIcon },
  { to: '/me', label: '我的', icon: UserIcon },
]

/**
 * 悬浮导航胶囊。
 * - 竖屏宽度按视口算（每格 ≥ 88px、总宽不超过视口），横屏固定 480px
 */
export function FloatingNav() {
  const wide = useWideLandscape()
  return (
    <nav
      aria-label="主导航"
      className={cn(
        'fixed z-40 flex border border-white/10 bg-[#1c2029]/90 shadow-[0_12px_40px_rgba(0,0,0,.55)] backdrop-blur-xl',
        wide
          ? 'bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 w-[480px] max-w-[52vw] -translate-x-1/2 gap-1 rounded-[34px] px-2 py-2'
          : 'bottom-[calc(72px+env(safe-area-inset-bottom))] left-1/2 w-[calc(100%-24px)] max-w-[500px] -translate-x-1/2 gap-1 rounded-[28px] px-1.5 py-1.5',
      )}
    >
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/'}
          className={(s) =>
            cn(
              'relative flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1 rounded-3xl text-[15px] transition-colors duration-150',
              wide ? 'py-2.5' : 'py-1.5',
              s.isActive ? 'text-gcores' : 'text-[#8a92a3]',
              s.isActive && 'bg-white/[0.07]',
            )
          }
        >
          {(s) => (
            <>
              <it.icon active={s.isActive} />
              <span className="leading-none">{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <path d="M3.5 10.6 12 3.5l8.5 7.1V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" strokeLinejoin="round" />
      <path d="M9.5 20.5v-6h5v6" strokeLinejoin="round" opacity=".7" />
    </svg>
  )
}
function GridIcon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  )
}
function BookIcon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <path d="M5.5 4.5h9a3 3 0 0 1 3 3V20H8a2.5 2.5 0 0 1-2.5-2.5z" strokeLinejoin="round" />
      <path d="M5.5 17h12" opacity=".7" />
    </svg>
  )
}
function UserIcon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20.5c1.4-4.2 4-6.2 7.5-6.2s6.1 2 7.5 6.2" strokeLinecap="round" />
    </svg>
  )
}