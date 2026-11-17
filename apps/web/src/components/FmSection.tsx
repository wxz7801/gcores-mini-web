import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchRadios, type RadioListItem } from '../api/gcores'
import { CoverImage } from '../components/CoverImage'
import { coverUrl, formatTime, relativeDate, cn } from '../lib/format'
import { usePlayer } from '../store/player'
import { toTrack } from '../components/RadioRow'
import { SHOW_FM_LIST } from '../lib/config'

/**
 * 历史FM：机核 FM 的往期特辑（和普通播客同一个接口 /radios?filter[is-fm]=1，
 * media 为 HLS 分片流，走 hls.js）。每一期都按各自发布时间做墙钟伪直播循环。
 *
 * 是否露出由运行时变量 show_fm_list 控制（见 lib/config.ts）。
 * 顶部的「机核FM」直播按钮（只播最新一期）不受这个开关影响，见 FmLiveButton。
 */
export function FmSection() {
  const q = useQuery({
    queryKey: ['fm'],
    queryFn: () => fetchRadios({ isFm: true, limit: 24, sort: '-published-at' }),
    enabled: SHOW_FM_LIST,
    staleTime: 10 * 60 * 1000,
  })
  const items = useMemo(() => q.data?.items ?? [], [q.data])

  if (!SHOW_FM_LIST) return null
  if (q.isLoading) return <div className="px-4 py-6 text-[15px] text-on-surface-variant">历史FM 加载中…</div>
  if (!items.length) return null

  return (
    <section>
      <div className="mb-3 px-4">
        <h2 className="flex items-center gap-2 text-[20px] font-bold text-on-surface">历史FM</h2>
        <p className="mt-1 text-[13px] text-on-surface-variant">往期特辑 · 循环播放 · 共 {items.length} 期</p>
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
    <li className={cn('flex items-center gap-3 rounded-xl p-2.5', isCurrent ? 'bg-secondary-container' : 'bg-surface-container-high')}>
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
        <div
          className={cn(
            'line-clamp-2 leading-snug',
            isCurrent ? 'text-on-secondary-container' : 'text-on-surface',
            first ? 'text-[17px] font-bold' : 'text-[15px] font-semibold',
          )}
        >
          {radio.title}
        </div>
        <div className={cn('mt-1 flex items-center gap-2 text-[13px]', isCurrent ? 'text-on-secondary-container/80' : 'text-on-surface-variant')}>
          <span>{formatTime(radio.duration)}</span>
          <span>·</span>
          <span>{relativeDate(radio.publishedAt)}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={() => (isCurrent ? toggle() : void playTrack(toTrack(radio), queue.map((x) => toTrack(x))))}
        aria-label={isCurrent && playing ? '暂停' : '播放'}
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
          isCurrent && playing
            ? 'bg-primary text-on-primary'
            : 'bg-primary text-on-primary hover:brightness-110 active:brightness-95',
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
