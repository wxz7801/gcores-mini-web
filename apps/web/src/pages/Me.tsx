import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAuth, loadProfile, signOut, subscribeAuth, type AuthState } from '../api/auth'
import { CoverImage } from '../components/CoverImage'
import { coverUrl, cn, formatTime, relativeDate } from '../lib/format'
import { fetchBookmarks, fetchHistory, fetchRadiosByIds, type RadioListItem } from '../api/gcores'
import { usePlayer } from '../store/player'
import { toTrack } from '../components/RadioRow'
import { RadioCard } from '../components/RadioCard'
import { useQueueStore } from '../store/queue'

type Tab = 'history' | 'favorites'

export function MePage() {
  const nav = useNavigate()
  const [auth, setAuth] = useState<AuthState | null>(getAuth())
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('history')

  useEffect(() => {
    const off = subscribeAuth((s) => setAuth(s))
    return () => off()
  }, [])

  useEffect(() => {
    if (auth && !auth.user) {
      setLoading(true)
      void loadProfile()
        .catch(() => null)
        .finally(() => setLoading(false))
    }
  }, [auth])

  if (!auth) return <LoggedOut />

  const u = auth.user
  return (
    <div className="pb-6">
      <header className="sticky top-0 z-20 bg-ink/95 px-4 pt-[max(16px,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] leading-none font-bold text-white">我的</h1>
          <button
            type="button"
            onClick={() => nav('/queue')}
            aria-label="播放队列"
            className="tap flex h-11 w-11 items-center justify-center rounded-full text-[#e8eaef]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h10" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 pb-3">
          {u?.thumb ? (
            <CoverImage src={coverUrl(u.thumb, 160)} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-card" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-bold text-white">
              {u?.nickname ?? (loading ? '加载中…' : '机核用户')}
            </div>
            <div className="mt-1 flex gap-1.5">
              {u?.hasMembership && (
                <span className="rounded bg-timeline/15 px-1.5 py-0.5 text-[12px] text-timeline">GPASS 会员</span>
              )}
              {u?.isFounderMember && (
                <span className="rounded bg-gcores/15 px-1.5 py-0.5 text-[12px] text-gcores">创始会员</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-5 pb-2">
          {(
            [
              { id: 'history', label: '收听记录' },
              { id: 'favorites', label: '我的收藏' },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'relative pb-2 text-[17px]',
                tab === t.id ? 'font-bold text-white' : 'text-[#8a92a3]',
              )}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-white" />}
            </button>
          ))}
        </div>
      </header>

      {tab === 'history' ? <HistoryList /> : <FavoriteList />}

      <div className="mt-8 px-4">
        <button
          type="button"
          onClick={() => {
            signOut()
            nav('/')
          }}
          className="h-12 w-full rounded-full border border-line text-[16px] text-[#cfd3da]"
        >
          退出登录
        </button>
        <p className="mt-3 text-center text-[12px] leading-relaxed text-[#5c6371]">
          第三方触屏播放器 · 账号与登录态只保存在本机浏览器
        </p>
      </div>
    </div>
  )
}

function LoggedOut() {
  const nav = useNavigate()
  return (
    <div className="px-5 pt-[max(16px,env(safe-area-inset-top))]">
      <h1 className="text-[28px] leading-none font-bold text-white">我的</h1>
      <div className="mt-8 rounded-2xl bg-card p-5">
        <div className="text-[17px] font-medium text-white">还没有登录</div>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[#8a92a3]">
          登录后可收听 GPASS 节目与有声书、同步收听进度，并收藏喜欢的节目。
        </p>
        <button
          type="button"
          onClick={() => nav('/login')}
          className="mt-4 h-11 w-full rounded-full bg-gcores text-[16px] font-medium text-white"
        >
          登录机核账号
        </button>
      </div>
      <div className="mt-4 rounded-2xl bg-card/60 p-4 text-[13px] leading-relaxed text-[#5c6371]">
        这是第三方的触屏播放器，不是机核官方客户端。账号信息仅保存在本机浏览器。
      </div>
    </div>
  )
}

/**
 * 收听记录：GET /history 只给 id + progress + timestamp，没有标题封面，
 * 所以要再用 /radios?filter[id]=... 批量水合一次。
 */
function HistoryList() {
  const q = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const entries = await fetchHistory()
      const ids = Array.from(new Set(entries.map((e) => e.radioId)))
      // 接口一次最多接受一个 URL，这里按 50 个一批水合
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50))
      const radios = (await Promise.all(chunks.map((c) => fetchRadiosByIds(c)))).flat()
      const byId = new Map(radios.map((r) => [r.id, r]))
      // 同一期听过多次会出现在多条记录里：按 radioId 合并，保留最新时间与最大进度
      const merged = new Map<string, { radioId: string; progress: number; timestamp: number }>()
      for (const e of entries) {
        const prev = merged.get(e.radioId)
        if (!prev) merged.set(e.radioId, { radioId: e.radioId, progress: e.progress, timestamp: e.timestamp })
        else if (e.timestamp > prev.timestamp) merged.set(e.radioId, { ...prev, timestamp: e.timestamp, progress: Math.max(prev.progress, e.progress) })
        else prev.progress = Math.max(prev.progress, e.progress)
      }
      return Array.from(merged.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((e) => ({ ...e, radio: byId.get(e.radioId) }))
        .filter((e): e is typeof e & { radio: RadioListItem } => Boolean(e.radio))
    },
    staleTime: 30 * 1000,
  })

  const items = q.data ?? []
  if (q.isLoading) return <Hint text="正在读取收听记录…" />
  if (q.isError) return <Hint text="收听记录读取失败，稍后再试" />
  if (!items.length) return <Hint text="还没有收听记录，去首页挑一期听听" />

  return (
    <div className="px-2 pt-2">
      {items.map((e) => (
        <HistoryRow key={e.radioId} radio={e.radio} progress={e.progress} at={e.timestamp} />
      ))}
    </div>
  )
}

function HistoryRow({ radio, progress, at }: { radio: RadioListItem; progress: number; at: number }) {
  const nav = useNavigate()
  const playTrack = usePlayer((s) => s.playTrack)
  const seek = usePlayer((s) => s.seek)
  const currentId = usePlayer((s) => s.current?.radioId)
  const pct = radio.duration > 0 ? Math.min(100, (progress / radio.duration) * 100) : 0
  const isCurrent = currentId === radio.id

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 active:bg-card/60">
      <button type="button" onClick={() => nav(`/radio/${radio.id}`)} className="shrink-0" aria-label={radio.title}>
        <CoverImage src={coverUrl(radio.thumb || radio.cover, 240, 135)} className="h-[54px] w-[96px] rounded-lg object-cover" />
      </button>
      <button type="button" onClick={() => nav(`/radio/${radio.id}`)} className="min-w-0 flex-1 text-left">
        <div className="line-clamp-2 text-[16px] leading-snug text-[#e8eaef]">{radio.title}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[#7d8594]">
          <span className="truncate">{radio.categories[0]?.name ?? (radio.isFm ? '机核 FM' : '播客')}</span>
          <span>·</span>
          <span className="shrink-0">{relativeDate(at)}</span>
        </div>
        {pct > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-[2px] flex-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full bg-gcores" style={{ width: `${pct}%` }} />
            </span>
            <span className="shrink-0 text-[12px] text-[#5c6371]">听到 {formatTime(progress)}</span>
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          if (isCurrent) {
            seek(progress)
            return
          }
          void playTrack(toTrack(radio), []).then(() => seek(progress))
        }}
        aria-label="从上次位置继续"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-gcores/60 text-gcores"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 4l14 8-14 8z" />
        </svg>
      </button>
    </div>
  )
}

/** 收藏：GET /users/{id}/bookmarks 只返回 bookmarkable 关系，同样要批量水合 */
function FavoriteList() {
  const q = useQuery({
    queryKey: ['bookmarks'],
    queryFn: async () => {
      const { entries } = await fetchBookmarks({ limit: 60 })
      const ids = Array.from(new Set(entries.filter((e) => e.type === 'radios').map((e) => e.targetId)))
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50))
      const radios = (await Promise.all(chunks.map((c) => fetchRadiosByIds(c)))).flat()
      const byId = new Map(radios.map((r) => [r.id, r]))
      return entries
        .map((e) => byId.get(e.targetId))
        .filter((r): r is RadioListItem => Boolean(r))
    },
    staleTime: 30 * 1000,
  })

  const items = q.data ?? []
  const enqueue = useQueueStore((s) => s.enqueue)

  if (q.isLoading) return <Hint text="正在读取收藏…" />
  if (q.isError) return <Hint text="收藏读取失败，稍后再试" />
  if (!items.length)
    return <Hint text="还没有收藏的节目。在节目详情页点「收藏」就会出现在这里（同步机核账号）" />

  return (
    <div className="pt-3">
      <div className="mb-3 flex items-center justify-between px-4">
        <span className="text-[14px] text-[#8a92a3]">共 {items.length} 个节目</span>
        <button
          type="button"
          onClick={() => items.forEach((r) => enqueue(toTrack(r)))}
          className="flex min-h-[44px] items-center text-[15px] text-[#5aa9ff]"
        >
          全部加入队列
        </button>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 px-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <RadioCard key={r.id} radio={r} queue={items} />
        ))}
      </div>
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return <div className="px-5 py-12 text-center text-[15px] leading-relaxed text-[#5c6371]">{text}</div>
}