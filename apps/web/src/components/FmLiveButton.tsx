import { useQuery } from '@tanstack/react-query'
import { fetchRadios } from '../api/gcores'
import { usePlayer } from '../store/player'
import { toTrack } from './RadioRow'
import { Icon } from './Icon'
import { cn } from '../lib/format'

/**
 * 「机核FM」直播按钮——对齐官网 radios 页标题旁那颗按钮：
 * 永远显示（不受 show_fm_list 控制），永远只播**最新一期** FM。
 *
 * 数据源和官网一致：/radios?filter[is-fm]=1&sort=-published-at&limit=1。
 * 点一下＝按墙钟加入直播（playTrack 内部对 FM 走 fmLivePosition）；
 * 已经在播这期时再点＝暂停 / 继续。队列里只放这一期，不做往期连播。
 */
export function FmLiveButton() {
  const q = useQuery({
    queryKey: ['fm-latest'],
    queryFn: () => fetchRadios({ isFm: true, limit: 1, sort: '-published-at' }),
    staleTime: 10 * 60 * 1000,
  })
  const latest = q.data?.items[0]

  const current = usePlayer((s) => s.current)
  const playing = usePlayer((s) => s.playing)
  const playTrack = usePlayer((s) => s.playTrack)
  const toggle = usePlayer((s) => s.toggle)

  const isLive = Boolean(latest && current?.radioId === latest.id)
  const liveOnAir = isLive && playing

  const onClick = () => {
    if (!latest) return
    if (isLive) toggle()
    else void playTrack(toTrack(latest), [toTrack(latest)])
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!latest}
      aria-label={liveOnAir ? '暂停机核FM直播' : '播放机核FM直播'}
      aria-pressed={liveOnAir}
      className={cn(
        'tap flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 transition-colors',
        liveOnAir
          ? 'bg-primary text-on-primary'
          : 'bg-primary-container text-on-primary-container hover:brightness-105 active:brightness-95',
        !latest && 'opacity-60',
      )}
    >
      <Icon name={liveOnAir ? 'graphic_eq' : 'podcasts'} size={20} />
      <span className="text-[14px] font-semibold whitespace-nowrap">{liveOnAir ? '直播中' : '机核FM'}</span>
      {!liveOnAir && (
        <span className="ml-0.5 flex items-center gap-1 rounded-full bg-error px-1.5 py-0.5 text-[10px] leading-none font-bold text-on-error">
          LIVE
        </span>
      )}
    </button>
  )
}
