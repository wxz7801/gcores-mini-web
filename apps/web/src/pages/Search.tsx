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
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-outline-variant bg-surface-container-low px-2 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        {/* M3 search bar：tonal 底 + 全圆角，48px 命中区 */}
        <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface-container-high px-4 focus-within:ring-2 focus-within:ring-primary/60">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="shrink-0 text-on-surface-variant"
            strokeWidth="2"
          >
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
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-on-surface outline-none placeholder:text-on-surface-variant"
          />
          {input && (
            <button type="button" onClick={() => setInput('')} className="tap text-on-surface-variant" aria-label="清除">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" opacity=".35" />
                <path d="M8.5 8.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => nav(-1)}
          className="tap flex h-12 shrink-0 items-center rounded-full px-3 text-[15px] text-primary hover:bg-primary/[0.08]"
        >
          取消
        </button>
      </div>

      {!query && (
        <div className="px-4 pt-4">
          {history.length > 0 && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[14px] text-on-surface-variant">最近搜索</span>
                <button
                  type="button"
                  onClick={() => {
                    setHistory([])
                    localStorage.removeItem(HISTORY_KEY)
                  }}
                  className="rounded-md px-1 text-[13px] text-primary hover:bg-primary/[0.08]"
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
                    className="min-h-[40px] rounded-full border border-outline px-4 text-[15px] text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 mb-2 text-[14px] text-on-surface-variant">热门搜索</div>
          <div className="flex flex-wrap gap-2">
            {HOT.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => commit(h)}
                className="min-h-[40px] rounded-full border border-outline px-4 text-[15px] text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.1]"
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {query && (
        <div className="px-1">
          {q.isLoading && <div className="px-4 py-8 text-center text-[15px] text-on-surface-variant">搜索中…</div>}
          {!q.isLoading && !items.length && (
            <div className="px-4 py-10 text-center text-[15px] text-on-surface-variant">
              没有找到「{query}」相关节目
            </div>
          )}
          {items.map((r) => (
            <RadioRow key={r.id} radio={r} queue={items} />
          ))}
        </div>
      )}
    </div>
  )
}
