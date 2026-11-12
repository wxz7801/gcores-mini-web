import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '../api/gcores'
import { CoverImage } from '../components/CoverImage'
import { coverUrl } from '../lib/format'

export function CategoriesPage() {
  const nav = useNavigate()
  const q = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 10 * 60 * 1000 })
  const items = q.data ?? []

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-10 border-b border-outline-variant bg-surface-container-low px-4 pt-[max(16px,env(safe-area-inset-top))] pb-3">
        <h1 className="text-[28px] leading-none font-bold text-on-surface">栏目</h1>
      </header>

      <div className="grid grid-cols-3 gap-3 px-4">
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => nav(`/category/${c.id}`)}
            className="flex flex-col items-center gap-2 rounded-xl bg-surface-container py-4 hover:bg-surface-container-high active:bg-surface-container-highest"
          >
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-surface-container-highest">
              {c.logo ? (
                <CoverImage src={coverUrl(c.logo, 120)} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[18px] font-bold text-on-surface-variant">{c.name.slice(0, 1)}</span>
              )}
            </span>
            <span className="line-clamp-1 px-1 text-center text-[14px] text-on-surface">{c.name}</span>
          </button>
        ))}
      </div>

      {q.isLoading && <div className="px-4 py-10 text-center text-[15px] text-on-surface-variant">加载中…</div>}
    </div>
  )
}
