import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { searchRadios } from '../api/gcores'
import { RadioRow } from '../components/RadioRow'

const HOT = ['Gadio', '后室', '游戏人', '纪录片', '魔兽', '赛博朋克']
const HISTORY_KEY = 'gcores.search-history.v1'

export function SearchPage() {
  const nav = useNavigate()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as string[]
    } catch {
      return []
    }
  })

  // 输入防抖：停止输入 350ms 后才请求
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(input.trim()), 350)
    return () => window.clearTimeout(t)
  }, [input])

  const q = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchRadios(query, 0, 30),
    enabled: query.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const commit = (term: string) => {
    setInput(term)
    setQuery(term)
    const next = [term, ...history.filter((h) => h !== term)].slice(0, 8)
    setHistory(next)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    } catch {
      /* 忽略 */
    }
  }

  const items = q.data?.items ?? []

  return (
    <div className="pb-4">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-ink/95 px-2 pt-[max(8px,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a92a3" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5 21 21" />
          </svg>
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commit(input.trim())}
            placeholder="搜索节目、栏目、主播"
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-[#5c6371]"
          />
          {input && (
            <button type="button" onClick={() => setInput('')} className="tap text-[#8a92a3]" aria-label="清除">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" opacity=".35" />
                <path d="M8.5 8.5l7 7m0-7l-7 7" stroke="#0d0f14" strokeWidth="2" />
              </svg>
            </button>
          )}
        </div>
        <button type="button" onClick={() => nav(-1)} className="tap shrink-0 px-2 text-[15px] text-[#8a92a3]">
          取消
        </button>
      </div>

      {!query && (
        <div className="px-4 pt-4">
          {history.length > 0 && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[14px] text-[#8a92a3]">最近搜索</span>
                <button
                  type="button"
                  onClick={() => {
                    setHistory([])
                    localStorage.removeItem(HISTORY_KEY)
                  }}
                  className="text-[13px] text-[#5c6371]"
                >
                  清空
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => commit(h)}
                    className="rounded-full bg-card px-3 py-2 text-[15px] text-[#cfd3da]"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 mb-2 text-[14px] text-[#8a92a3]">热门搜索</div>
          <div className="flex flex-wrap gap-2">
            {HOT.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => commit(h)}
                className="rounded-full bg-card px-3 py-2 text-[15px] text-[#cfd3da]"
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {query && (
        <div className="px-1">
          {q.isLoading && <div className="px-4 py-8 text-center text-[15px] text-[#8a92a3]">搜索中…</div>}
          {!q.isLoading && !items.length && (
            <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">没有找到「{query}」相关节目</div>
          )}
          {items.map((r) => (
            <RadioRow key={r.id} radio={r} queue={items} />
          ))}
        </div>
      )}
    </div>
  )
}
