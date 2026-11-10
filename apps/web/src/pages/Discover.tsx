import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchAlbumRadios, fetchHistory, fetchRadios, fetchRadiosByIds, type RadioListItem } from '../api/gcores'
import { usePlayer } from '../store/player'
import { toTrack } from '../components/RadioRow'
import { formatTime, coverUrl } from '../lib/format'
import { CoverImage } from '../components/CoverImage'
import { RadioCard, RadioGrid } from '../components/RadioCard'
import { getAuth } from '../api/auth'
import { cn } from '../lib/format'
import { FmSection } from '../components/FmSection'
import { SeriesTile } from '../components/SeriesTile'
import { RECORDER_SEASON_IDS } from '../api/series'

const TABS = [
  { id: 'latest' as const, label: '最新' },
  { id: 'gcores' as const, label: '机核' },
  { id: 'imported' as const, label: '入驻' },
  { id: 'gpass' as const, label: 'GPASS' },
  { id: 'fm' as const, label: '机核 FM' },
]

type Tab = 'latest' | 'gcores' | 'imported' | 'gpass' | 'fm'

/** GPASS 会员专享：接口不支持按权限过滤（filter[is-free] → 400），只能在客户端分流，所以要更深的翻页 */
function isGpass(r: RadioListItem) {
  return !r.isFree || r.isRequirePrivilege
}

/**
 * 录音笔（1100 期）只在 GPASS 那一栏摘出网格，收成 SeriesTile 一张卡——否则会员节目那一栏只剩录音笔。
 * 「最新 / 机核 / 入驻」照常逐期展示，不做合集：那是一本流水账，混进一个合集反而看不出更新时间线。
 *
 * 摘除判定要两路都看：
 * 1. 栏目是「录音笔」：列表里个别条目 category 直接挂了这个分类；
 * 2. 归属某一张录音笔年份专辑：首页渲染时拉一次 `/albums?filter[display-type]=album`，
 *    把四张专辑下的 radio id 收进一个集合（4 次请求，10 分钟缓存）。
 *    接口不支持 `filter[category]` / `filter[album]`（400 Filter not allowed），只能这样筛。
 */
const RECORDER_CATEGORY = '录音笔'
const isRecorderCategory = (r: RadioListItem) => r.categories.some((c) => c.name === RECORDER_CATEGORY)

/**
 * 四张年份专辑里**最新那批**的 radio id（每张取首页 100 条，共 4 个请求）。
 * 「最新 / 入驻」两栏只显示第一屏，所以摘掉最近这批就够了——没必要为 1100 期做 44 次请求。
 */
function useRecorderIds(enabled: boolean, limit = 100) {
  return useQuery({
    queryKey: ['recorder-ids', limit],
    enabled,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const byAlbum = await Promise.all(
        RECORDER_SEASON_IDS.map((id) =>
          fetchAlbumRadios(id, 0, limit)
            .then((p) => p.items.map((r) => r.id))
            .catch(() => [] as string[]),
        ),
      )
      return new Set(byAlbum.flat())
    },
  })
}

/**
 * 首页 = 电台（参考 gcores.com/radios）：
 * 顶部「最新 / 机核 FM」两个页签 + 网格卡片，只放电台内容，
 * 不放栏目、不放推荐位——那些交给各自的页签。
 */
export function DiscoverPage() {
  const nav = useNavigate()
  // 默认停在「机核」：只显示机核自有电台（官网把入驻播客单独一列，混在一起会把自制节目冲掉）
  const [tab, setTab] = useState<Tab>('gcores')

  const q = useInfiniteQuery({
    queryKey: ['radios', 'feed', tab],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchRadios({ offset: pageParam, limit: 24 }),
    // 服务端不支持按栏目过滤（filter[category] → 400 Filter not allowed），
    // 所以单页多取一些，再在客户端分流；三个页签共用同一份 page 0 缓存
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      if (last.items.length < 24) return undefined
      if (loaded >= 24 * 40) return undefined // 站点共 3 万条，软上限
      return loaded
    },
    staleTime: 2 * 60 * 1000,
  })

  const gp = useInfiniteQuery({
    queryKey: ['radios', 'feed', 'gpass'],
    enabled: tab === 'gpass',
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchRadios({ offset: pageParam, limit: 60 }),
    getNextPageParam: (_last, pages) => {
      const items = pages.flatMap((p) => p.items)
      const hits = items.filter(isGpass).length
      // 要么攒够 36 期会员节目，要么翻完 3000 期还没凑够（一般 2~3 页就有）
      if (hits >= 36) return undefined
      if (items.length >= 3000) return undefined
      return items.length
    },
    staleTime: 5 * 60 * 1000,
  })

  const isGpassTab = tab === 'gpass'
  // 只有 GPASS 那栏需要把录音笔收成合集，其他三栏保持逐期
  const recorderIds = useRecorderIds(isGpassTab)
  const isRecorder = (r: RadioListItem) => isRecorderCategory(r) || Boolean(recorderIds.data?.has(r.id))

  const gpAll = gp.data?.pages.flatMap((p) => p.items) ?? []
  const gpItems = useMemo(
    () => gpAll.filter((r) => isGpass(r) && !isRecorder(r)).slice(0, 60),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gpAll, recorderIds.data],
  )

  const all: RadioListItem[] = q.data?.pages.flatMap((p) => p.items) ?? []
  const items = useMemo(() => {
    if (tab === 'fm' || tab === 'gpass') return []
    if (tab === 'latest') return all
    if (tab === 'gcores') return all.filter((r) => !r.isImported)
    return all.filter((r) => r.isImported)
  }, [all, tab])


  return (
    <div className="pb-6">
      <header className="sticky top-0 z-10 bg-ink/95 pt-[max(12px,env(safe-area-inset-top))] pb-1 backdrop-blur">
        <div className="flex items-center gap-2 px-4">
          <h1 className="flex-1 text-[28px] leading-none font-bold text-white">播客</h1>
          <button
            type="button"
            onClick={() => nav('/search')}
            aria-label="搜索节目"
            className="tap flex h-11 w-11 items-center justify-center rounded-full text-[#e8eaef] active:bg-card"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M16.5 16.5 21 21" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => nav('/queue')}
            aria-label="播放队列"
            className="tap relative flex h-11 w-11 items-center justify-center rounded-full text-[#e8eaef] active:bg-card"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </button>
        </div>

        <div className="no-scrollbar mt-1 flex gap-6 overflow-x-auto px-[max(16px,env(safe-area-inset-left))]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn(
                'relative flex min-h-[44px] items-center pb-1 text-[18px] transition-colors',
                tab === t.id ? 'font-bold text-white' : 'text-[#8a92a3]',
              )}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded bg-gcores" />}
            </button>
          ))}
        </div>
      </header>


      {!getAuth() && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-card px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-timeline/15 text-timeline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
            </svg>
          </span>
          <button type="button" onClick={() => nav('/login')} className="flex-1 text-left">
            <div className="text-[15px] text-white">登录后收听 GPASS 会员节目</div>
            <div className="mt-0.5 text-[13px] text-[#8a92a3]">扫码登录 · 进度与收藏自动同步</div>
          </button>
          <span className="text-[#5c6371]">›</span>
        </div>
      )}

      {tab === 'fm' ? (
        <div className="mt-3">
          <FmSection />
        </div>
      ) : tab === 'gpass' ? (
        <>
          {/* 录音笔收成一张方格，排在会员节目网格最前面 */}
          {/* 摘除集合没到之前先不渲染，否则录音笔会先闪出来再消失 */}
          {!recorderIds.isLoading && (
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-5 px-4 sm:gap-x-4 sm:gap-y-7 lg:grid-cols-3 2xl:grid-cols-4">
              <SeriesTile className="col-span-2 lg:col-span-1" />
              {gpItems.map((r) => (
                <RadioCard key={r.id} radio={r} queue={gpItems} />
              ))}
            </div>
          )}
          {!getAuth() && (
            <div className="mx-4 mt-5 flex items-center gap-3 rounded-xl bg-timeline/10 px-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-timeline/15 text-timeline">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
                </svg>
              </span>
              <div className="flex-1 text-[14px] leading-relaxed text-[#b8bfcb]">
                会员节目只能试听；扫码登录已经有 GPASS 的账号后可以整段收听。
              </div>
              <button
                type="button"
                onClick={() => nav('/login')}
                className="h-9 shrink-0 rounded-full bg-timeline px-4 text-[14px] font-medium text-black"
              >
                登录
              </button>
            </div>
          )}
          {gp.isLoading && <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">正在挑会员节目…</div>}
          {!gp.isLoading && gpItems.length === 0 && (
            <div className="py-16 text-center text-[15px] text-[#5c6371]">没找到会员节目</div>
          )}
          {gp.hasNextPage && (
            <button
              type="button"
              onClick={() => void gp.fetchNextPage()}
              className="mx-auto mt-6 mb-2 block h-12 rounded-full bg-card px-8 text-[15px] text-[#cfd3da]"
            >
              {gp.isFetchingNextPage ? '正在翻找更多会员节目…' : '加载更多'}
            </button>
          )}
          {!gp.hasNextPage && gpItems.length > 0 && (
            <div className="py-8 text-center text-[13px] text-[#5c6371]">已经到底了 · 共 {gpItems.length} 期会员节目</div>
          )}
        </>
      ) : (
        <div className="mt-1">
          <RadioGrid items={items} queue={all} />
        </div>
      )}

      {/* GPASS 页签有自己的加载更多 / 到底提示，这里只服务 最新 / 机核 / 入驻 */}
      {!isGpassTab && tab !== 'fm' && q.isLoading && <SkeletonGrid />}
      {!isGpassTab && tab !== 'fm' && q.hasNextPage && (
        <button
          type="button"
          onClick={() => void q.fetchNextPage()}
          className="mx-auto mt-6 mb-2 block h-12 rounded-full bg-card px-8 text-[15px] text-[#cfd3da]"
        >
          {q.isFetchingNextPage ? '加载中…' : '加载更多'}
        </button>
      )}
      {/* 接着听：放在列表之后，不抢「最新 | 机核 | 入驻」三栏的首屏位置 */}
      <ResumeRail />

      {!isGpassTab && tab !== 'fm' && !q.hasNextPage && items.length > 0 && (
        <div className="py-8 text-center text-[13px] text-[#5c6371]">已经到底了 · 共 {items.length} 期</div>
      )}
      {!isGpassTab && tab !== 'fm' && !q.isLoading && items.length === 0 && (
        <div className="py-16 text-center text-[15px] text-[#5c6371]">
          {tab === 'imported' ? '这一页还没加载到入驻播客，拉一下「加载更多」' : '暂无节目'}
        </div>
      )}
    </div>
  )
}


function SkeletonGrid() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-6 px-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-video w-full rounded-xl bg-card" />
          <div className="mt-2 h-3 w-1/3 rounded bg-card" />
          <div className="mt-2 h-4 w-full rounded bg-card" />
          <div className="mt-1.5 h-4 w-2/3 rounded bg-card" />
        </div>
      ))}
    </div>
  )
}
/**
 * 「接着听」：取收听记录里最近没听完的几条，按 radioId 去重。
 * 只显示进度在 3% ~ 95% 之间的——刚点开和已经听完的没必要占位。
 */
function ResumeRail() {
  const nav = useNavigate()
  const loggedIn = Boolean(getAuth())
  const playTrack = usePlayer((s) => s.playTrack)
  const seek = usePlayer((s) => s.seek)

  const q = useQuery({
    queryKey: ['history', 'resume'],
    enabled: loggedIn,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const entries = await fetchHistory()
      const merged = new Map<string, { radioId: string; progress: number; timestamp: number }>()
      for (const e of entries) {
        const prev = merged.get(e.radioId)
        if (!prev || e.timestamp > prev.timestamp) {
          merged.set(e.radioId, { radioId: e.radioId, progress: Math.max(prev?.progress ?? 0, e.progress), timestamp: e.timestamp })
        }
      }
      const picked = Array.from(merged.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 12)
      const radios = await fetchRadiosByIds(picked.map((p) => p.radioId))
      const byId = new Map(radios.map((r) => [r.id, r]))
      return picked
        .map((p) => ({ ...p, radio: byId.get(p.radioId) }))
        .filter((p): p is typeof p & { radio: RadioListItem } => Boolean(p.radio))
    },
  })

  const rows = (q.data ?? []).filter((r) => {
    const d = r.radio.duration || 0
    if (d <= 0) return true
    const ratio = r.progress / d
    return ratio > 0.03 && ratio < 0.95
  })
  if (!loggedIn || rows.length === 0) return null

  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between px-4">
        <h2 className="text-[17px] font-bold text-white">接着听</h2>
        <button type="button" onClick={() => nav('/me')} className="text-[14px] text-[#8a92a3]">
          全部记录
        </button>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
        {rows.map((r) => {
          const pct = r.radio.duration > 0 ? Math.min(100, (r.progress / r.radio.duration) * 100) : 0
          return (
            <div key={r.radioId} className="w-[220px] shrink-0">
              <button
                type="button"
                onClick={() => {
                  void playTrack(toTrack(r.radio)).then(() => seek(r.progress))
                }}
                className="relative block w-full"
                aria-label={`继续播放 ${r.radio.title}`}
              >
                <CoverImage
                  src={coverUrl(r.radio.thumb || r.radio.cover, 440, 248)}
                  className="aspect-video w-full rounded-xl object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 4l14 8-14 8z" />
                    </svg>
                  </span>
                </span>
                <span className="absolute inset-x-2 bottom-2 h-[3px] overflow-hidden rounded-full bg-black/45">
                  <span className="block h-full bg-gcores" style={{ width: `${pct}%` }} />
                </span>
              </button>
              <div className="mt-1.5 line-clamp-2 text-[15px] leading-snug text-[#e8eaef]">{r.radio.title}</div>
              <div className="mt-0.5 text-[13px] text-[#7d8594]">听到 {formatTime(r.progress)}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
