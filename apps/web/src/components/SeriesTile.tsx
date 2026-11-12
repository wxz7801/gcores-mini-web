import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchSeries, findSeries } from '../api/series'
import { coverUrl, formatTime, cn } from '../lib/format'
import { usePlayer } from '../store/player'
import { toTrack } from './RadioRow'
import { CoverImage } from './CoverImage'

/**
 * 录音笔的「方格」：一个系列只占网格里的一张卡。
 *
 * 录音笔在 GPASS 里是一年一张专辑、四张专辑共 820 多期，如果照原样铺进网格，
 * 会员节目那一栏基本只剩录音笔。所以这里把它收成一张 16:9 的卡：
 * 封面 + 期数 + 最新一期，点卡片进系列页看完整时间轴。
 */
export function SeriesTile({ slug = 'recorder', className }: { slug?: string; className?: string }) {
  const nav = useNavigate()
  const series = findSeries(slug)
  const playTrack = usePlayer((s) => s.playTrack)
  const currentId = usePlayer((s) => s.current?.radioId)
  const playing = usePlayer((s) => s.playing)
  const toggle = usePlayer((s) => s.toggle)

  const q = useQuery({
    queryKey: ['series', slug],
    queryFn: () => fetchSeries(series!),
    enabled: Boolean(series),
    staleTime: 10 * 60 * 1000,
  })
  const data = q.data
  if (!series) return null

  const latest = data?.latest?.radio
  const isCurrent = Boolean(latest && latest.id === currentId)

  return (
    <article className={cn('group relative', className)}>
      <button
        type="button"
        onClick={() => nav(`/series/${slug}`)}
        className="block w-full text-left"
        aria-label={`${series.name} 全系列`}
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-surface-container max-sm:rounded-lg">
          {data?.cover && (
            <CoverImage
              src={coverUrl(data.cover, 480, 270)}
              className="h-full w-full object-cover"
            />
          )}
          {/* 底部压一层 scrim 保证系列名在任何封面上都读得清（M3 允许的媒体覆盖层） */}
          <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--m3-scrim)] to-transparent" />
          <span className="absolute bottom-2 left-2.5 flex items-center gap-1.5 rounded-md bg-[var(--m3-scrim)] px-2 py-1 text-[14px] leading-none font-medium text-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            全系列
          </span>
          <span className="absolute top-2 left-2 rounded-md bg-timeline-container px-2 py-1 text-[13px] leading-none font-bold text-on-timeline-container">
            GPASS 合订
          </span>
          {data && (
            <span className="absolute top-2 right-2 rounded-md bg-[var(--m3-scrim)] px-2 py-1 text-[13px] leading-none text-white">
              {data.total} 期 · {data.seasons.length} 季
            </span>
          )}
        </div>

        <h3 className="mt-2 line-clamp-2 text-[16px] leading-snug font-medium text-on-surface">
          {series.name}
          {data && <span className="ml-1.5 text-[14px] font-normal text-on-surface-variant">{data.total} 期合集</span>}
        </h3>
        <p className="mt-1 text-[15px] text-on-surface-variant">
          {data ? `${data.seasons.length} 季合订 · 按 VOL 号连成一条线` : '正在汇总各季…'}
        </p>
      </button>

      {/* 最新一期：只占一行，标题和时长同一行，避免竖屏下卡片被撑高 */}
      {latest && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav(`/radio/${latest.id}`)}
            className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="shrink-0 rounded bg-surface-container-highest px-1.5 py-0.5 text-[13px] leading-none text-on-surface-variant">
              最新
            </span>
            <span className="truncate text-[15px] text-on-surface">{latest.title}</span>
          </button>
          <span className="shrink-0 text-[13px] text-on-surface-variant">{formatTime(latest.duration)}</span>
          <button
            type="button"
            aria-label={isCurrent && playing ? '暂停' : `播放 ${latest.title}`}
            onClick={() => {
              if (isCurrent) void toggle()
              else void playTrack(toTrack(latest), data?.episodes.map((e) => toTrack(e.radio)) ?? [])
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary hover:brightness-110 active:brightness-95"
          >
            {isCurrent && playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 4l14 8-14 8z" />
              </svg>
            )}
          </button>
        </div>
      )}
      {!latest && data && (
        <p className="mt-3 text-[14px] text-on-surface-variant">这一批里没有找到录音笔的节目</p>
      )}
    </article>
  )
}