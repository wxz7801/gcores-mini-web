import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchRadios, type RadioListItem } from '../api/gcores'
import { CoverImage } from '../components/CoverImage'
import { coverUrl, formatTime, relativeDate, cn } from '../lib/format'
import { usePlayer } from '../store/player'
import { toTrack } from '../components/RadioRow'

/**
 * 机核 FM：和普通播客同一个接口（/radios?filter[is-fm]=1），
 * 区别是 media 为 HLS 分片流（playback-type: hls、audio 是 .m3u8），必须走 hls.js。
 *
 * 只有 8 期（1 期正片 + 7 张特辑），所以不做「主卡 + 横排特辑」那种两层结构：
 * 直接一列全部摊开，点哪个播哪个，也就不用再有一个单独的 FM 页面。
 */
export function FmSection() {
  const q = useQuery({
    queryKey: ['fm'],
    queryFn: () => fetchRadios({ isFm: true, limit: 24, sort: '-published-at' }),
    staleTime: 10 * 60 * 1000,
  })
  const items = useMemo(() => q.data?.items ?? [], [q.data])

  if (q.isLoading) return <div className="px-4 py-6 text-[15px] text-[#8a92a3]">机核 FM 加载中…</div>
  if (!items.length) return null

  return (
    <section>
      <div className="mb-3 px-4">
        <h2 className="flex items-center gap-2 text-[20px] font-bold text-white">
          机核 FM
          <span className="rounded bg-[#2b4a6e] px-1.5 py-0.5 text-[12px] leading-none font-medium text-[#7fc0ff]">LIVE</span>
        </h2>
        <p className="mt-1 text-[13px] text-[#7d8594]">循环陪伴流 · HLS 分片 · 共 {items.length} 期</p>
      </div>
      <ul className="space-y-2 px-4">
        {items.map((r, i) => (
          <FmRow key={r.id} radio={r} queue={items} first={i === 0} />
        ))}
      </ul>
    </section>
  )
}

function FmRow({ radio, queue, first }: { radio: RadioListItem; queue: RadioListItem[]; first: boolean }) {
  const nav = useNavigate()
  const current = usePlayer((s) => s.current)
  const playing = usePlayer((s) => s.playing)
  const playTrack = usePlayer((s) => s.playTrack)
  const toggle = usePlayer((s) => s.toggle)
  const isCurrent = current?.radioId === radio.id

  return (
    <li className={cn('flex items-center gap-3 rounded-2xl p-2.5', isCurrent ? 'bg-card ring-1 ring-gcores/60' : 'bg-panel')}>
      <button
        type="button"
        onClick={() => nav(`/radio/${radio.id}`)}
        className="shrink-0"
        aria-label={radio.title}
      >
        <CoverImage
          src={coverUrl(radio.cover, 200)}
          className={cn('rounded-xl object-cover', first ? 'h-[76px] w-[76px]' : 'h-[56px] w-[56px]')}
        />
      </button>
      <button
        type="button"
        onClick={() => nav(`/radio/${radio.id}`)}
        className="min-w-0 flex-1 text-left"
      >
        <div className={cn('line-clamp-2 leading-snug text-white', first ? 'text-[17px] font-bold' : 'text-[15px] font-semibold')}>
          {radio.title}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-[#8a92a3]">
          <span>{formatTime(radio.duration)}</span>
          <span>·</span>
          <span>{relativeDate(radio.publishedAt)}</span>
          {first && (
            <span className="rounded bg-[#2b4a6e] px-1 py-px text-[11px] leading-none text-[#7fc0ff]">陪伴流</span>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={() => (isCurrent ? toggle() : void playTrack(toTrack(radio), queue.map((x) => toTrack(x))))}
        aria-label={isCurrent && playing ? '暂停' : '播放'}
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
          isCurrent && playing ? 'bg-gcores text-white' : 'bg-white/90 text-[#15181e]',
        )}
      >
        {isCurrent && playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4l14 8-14 8z" />
          </svg>
        )}
      </button>
    </li>
  )
}
