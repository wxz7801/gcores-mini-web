import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchSeries, findSeries, type Episode } from '../api/series'
import { CoverImage } from '../components/CoverImage'
import { coverUrl, formatTime, relativeDate, cn } from '../lib/format'
import { usePlayer, type Track } from '../store/player'
import { toTrack } from '../components/RadioRow'

/**
 * 系列页：把「录音笔」按年拆开的几季专辑，拼成一条按 VOL 号连续的时间线。
 * 原生专辑页一年一断，翻旧年份要跳四个页面，这里一次拉完（每季最多 250 期）。
 */
export function SeriesPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const nav = useNavigate()
  const series = findSeries(slug)
  const q = useQuery({
    queryKey: ['series', slug],
    queryFn: () => fetchSeries(series!),
    enabled: Boolean(series),
    staleTime: 10 * 60 * 1000,
  })
  const data = q.data
  const [season, setSeason] = useState<string>('all')
  // 期数上千，先渲染 80 条，再按按钮追加，避免一次挂 1000 个 <li>
  const [limit, setLimit] = useState(80)

  // 季节胶囊：用专辑标题当 key；标题缺失时用序号兜底，绝不把筛选做成空列表
  const seasonTabs = useMemo(() => {
    const seasons = data?.seasons ?? []
    return [
      { key: 'all', label: '全部' },
      ...seasons.map((s, i) => ({ key: s.title || `season-${i}`, label: s.title || `第 ${i + 1} 季` })),
    ]
  }, [data])

  const episodes = useMemo(() => {
    const all = data?.episodes ?? []
    if (season === 'all') return all
    return all.filter((e) => (e.season || '') === season)
  }, [data, season])

  // VOL 区间按标题里的期号算（比专辑 radios-count 靠谱）
  const volRange = useMemo(() => {
    const vols = (data?.episodes ?? []).map((e) => e.vol).filter((v): v is number => v !== null)
    if (!vols.length) return null
    return { min: Math.min(...vols), max: Math.max(...vols) }
  }, [data])

  const playTrack = usePlayer((s) => s.playTrack)
  const currentId = usePlayer((s) => s.current?.radioId)

  if (!series) {
    return (
      <div className="px-4 py-16 text-center text-[15px] text-[#8a92a3]">
        没有这个系列{' '}
        <button type="button" onClick={() => nav('/')} className="text-gcores">
          回到首页
        </button>
      </div>
    )
  }

  const visible = episodes.slice(0, limit)
  const queueTracks = episodes.map((e) => toTrack(e.radio))
  const shownCount = data ? (season === 'all' ? data.episodes.length : episodes.length) : 0

  return (
    <div className="pb-8">
      <div className="pointer-events-none h-11" aria-hidden="true" />

      <div className="sticky top-0 z-20 flex items-center px-3 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => nav(-1)}
          aria-label="返回"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md active:bg-black/70"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </div>

      {/* 系列头：封面 + 名称 + 期数范围 + 全部播放 */}
      <section className="px-4">
        <div className="flex items-start gap-4">
          <div
            className="w-[40%] max-w-[180px] shrink-0 overflow-hidden rounded-2xl bg-card shadow-[0_10px_30px_rgba(0,0,0,.45)]"
            style={{ aspectRatio: '1 / 1' }}
          >
            {data?.cover && <CoverImage src={coverUrl(data.cover, 420, 420)} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-[26px] leading-snug font-bold text-white">{series.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
              <span className="rounded bg-[#8b1e26]/85 px-1.5 py-0.5 text-white">GPASS 专享</span>
              <span className="rounded bg-card px-1.5 py-0.5 text-[#a3aab8]">{shownCount || '…'} 期</span>
              {volRange && (
                <span className="rounded bg-card px-1.5 py-0.5 text-[#a3aab8]">
                  VOL.{volRange.min}–{volRange.max}
                </span>
              )}
              <span className="rounded bg-card px-1.5 py-0.5 text-[#a3aab8]">{series.seasonIds.length} 季</span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[15px] leading-[1.75] whitespace-pre-line break-words text-[#a3aab8]">{series.desc}</p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={!episodes.length}
            onClick={() => {
              const first = episodes[0]
              if (!first) return
              void playTrack(toTrack(first.radio), queueTracks)
            }}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gcores text-[17px] font-medium text-white active:brightness-110 disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4l14 8-14 8z" />
            </svg>
            从最新一期开始
          </button>
        </div>
      </section>

      {/* 季节筛选：横向可滑，触屏友好 */}
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto px-4">
        {seasonTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setSeason(t.key)
              setLimit(80)
            }}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-2 text-[15px] whitespace-nowrap',
              season === t.key ? 'bg-white text-black' : 'bg-card text-[#a3aab8] active:bg-[#262b34]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 px-4">
        {q.isLoading && (
          <div className="py-10 text-center text-[15px] text-[#8a92a3]">正在把 {series.name} 的几季拼起来…</div>
        )}
        {q.isError && <div className="py-10 text-center text-[15px] text-[#8a92a3]">加载失败，稍后再试</div>}
        {!q.isLoading && !episodes.length && (
          <div className="py-10 text-center text-[15px] text-[#8a92a3]">这个系列还没有节目</div>
        )}
      </div>

      <ol className="mt-1 px-2">
        {visible.map((e) => (
          <SeriesRow key={e.radio.id} ep={e} current={e.radio.id === currentId} queue={queueTracks} />
        ))}
      </ol>

      {visible.length < episodes.length && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 80)}
          className="mx-auto mt-6 block h-12 rounded-full bg-card px-8 text-[15px] text-[#cfd3da] active:bg-[#262b34]"
        >
          再看 80 期（还剩 {episodes.length - visible.length} 期）
        </button>
      )}

      {data && (
        <p className="mt-6 px-4 text-center text-[13px] leading-relaxed text-[#5c6371]">
          数据来自 {series.seasonIds.length} 张专辑：
          {data.seasons.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ' · '}
              <Link to={`/playlist/${s.id}`} className="text-[#8a92a3] underline-offset-2 active:underline">
                {s.title || s.id}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

function SeriesRow({ ep, current, queue }: { ep: Episode; current: boolean; queue: Track[] }) {
  const nav = useNavigate()
  const playing = usePlayer((s) => s.playing)
  const playTrack = usePlayer((s) => s.playTrack)
  const toggle = usePlayer((s) => s.toggle)
  const r = ep.radio

  return (
    <li className={cn('flex items-center gap-3 rounded-xl px-2 py-2', current && 'bg-gcores/10')}>
      <span className="w-10 shrink-0 text-center font-mono text-[13px] leading-tight text-[#5c6371]">
        {ep.vol !== null ? (
          <>
            <span className="block text-[11px]">VOL</span>
            <span className={cn('block text-[14px]', current && 'text-gcores')}>{ep.vol}</span>
          </>
        ) : (
          <span className="block text-[12px] text-timeline">番外</span>
        )}
      </span>

      <button
        type="button"
        onClick={() => nav(`/radio/${r.id}`)}
        className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[10px] bg-card"
        aria-label={r.title}
      >
        <CoverImage src={coverUrl(r.cover, 160)} className="h-full w-full object-cover" />
      </button>

      <button type="button" onClick={() => nav(`/radio/${r.id}`)} className="min-w-0 flex-1 text-left">
        <div className="line-clamp-2 text-[16px] leading-[1.35] text-[#e8eaef]">{r.title}</div>
        <div className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-[#7d8594]">
          <span>{formatTime(r.duration)}</span>
          <span>·</span>
          <span className="shrink-0">{relativeDate(r.publishedAt)}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => {
          if (current) {
            toggle()
            return
          }
          void playTrack(toTrack(r), queue)
        }}
        aria-label={current && playing ? '暂停' : '播放'}
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2',
          current ? 'border-gcores bg-gcores text-white' : 'border-gcores/70 text-gcores active:bg-gcores/10',
        )}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          {current && playing ? (
            <>
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </>
          ) : (
            <path d="M7 4l14 8-14 8z" />
          )}
        </svg>
      </button>
    </li>
  )
}