import { useNavigate, useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchCategories, fetchRadios } from '../api/gcores'
import { RadioRow } from '../components/RadioRow'

export function CategoryDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const nav = useNavigate()

  const cats = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 10 * 60 * 1000 })
  const name = cats.data?.find((c) => c.id === id)?.name ?? '栏目'

  const q = useInfiniteQuery({
    queryKey: ['radios', 'category', id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchRadios({ categoryId: id, offset: pageParam, limit: 20 }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return loaded < last.total ? loaded : undefined
    },
    enabled: Boolean(id),
  })

  const items = q.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-ink/95 px-2 pt-[max(8px,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <button type="button" onClick={() => nav(-1)} className="tap shrink-0 text-[#e8eaef]" aria-label="返回">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[18px] font-bold text-white">{name}</h1>
        <span className="pr-2 text-[13px] text-[#8a92a3]">{q.data?.pages[0]?.total ?? ''}</span>
      </header>

      <div className="px-1">
        {items.map((r) => (
          <RadioRow key={r.id} radio={r} queue={items} />
        ))}
      </div>

      {q.hasNextPage && (
        <button
          type="button"
          onClick={() => void q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
          className="mx-auto mt-3 block h-11 rounded-full bg-card px-6 text-[15px] text-[#cfd3da]"
        >
          {q.isFetchingNextPage ? '加载中…' : '加载更多'}
        </button>
      )}
      {q.isLoading && <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">加载中…</div>}
      {!q.isLoading && !items.length && (
        <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">这个栏目还没有节目</div>
      )}
    </div>
  )
}
