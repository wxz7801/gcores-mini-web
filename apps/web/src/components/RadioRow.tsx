import { useNavigate } from 'react-router-dom'
import { CoverImage } from './CoverImage'
import type { RadioListItem } from '../api/gcores'
import { coverUrl, formatTime, relativeDate } from '../lib/format'
import { usePlayer, type Track } from '../store/player'
import { cn } from '../lib/format'

export function toTrack(r: RadioListItem, audioFile?: string | null): Track {
  return {
    radioId: r.id,
    title: r.title,
    cover: coverUrl(r.cover, 400),
    duration: r.duration,
    mediaType: r.isFree ? 'audio' : 'protected_audio',
    audioFile: audioFile ?? null,
    playback: r.playbackType,
    djs: r.djs.map((d) => d.nickname),
    category: r.categories[0]?.name,
    mediaId: r.mediaId,
    likes: r.likes,
    comments: r.comments,
  }
}

/** 列表行：封面 + 标题 + 元信息 + 圆形播放钮 */
export function RadioRow({
  radio,
  queue,
  onPlay,
}: {
  radio: RadioListItem
  queue: RadioListItem[]
  onPlay?: () => void
}) {
  const nav = useNavigate()
  const currentId = usePlayer((s) => s.current?.radioId)
  const playing = usePlayer((s) => s.playing)
  const playTrack = usePlayer((s) => s.playTrack)
  const toggle = usePlayer((s) => s.toggle)
  const isCurrent = currentId === radio.id
  const isPlaying = isCurrent && playing

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <button
        type="button"
        onClick={() => nav(`/radio/${radio.id}`)}
        className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[10px] bg-card"
        aria-label={radio.title}
      >
        <CoverImage src={coverUrl(radio.cover, 160)} className="h-full w-full object-cover" />
      </button>

      <button type="button" onClick={() => nav(`/radio/${radio.id}`)} className="min-w-0 flex-1 text-left">
        <div className="line-clamp-2 text-[16px] leading-[1.35] text-[#e8eaef]">{radio.title}</div>
        <div className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-[#7d8594]">
          {radio.isRequirePrivilege && <span className="rounded bg-[#3a2a1e] px-1 text-[12px] text-timeline">GPASS</span>}
          <span className="truncate">{radio.categories[0]?.name ?? '播客'}</span>
          <span>·</span>
          <span>{formatTime(radio.duration)}</span>
          <span>·</span>
          <span className="shrink-0">{relativeDate(radio.publishedAt)}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => {
          if (isCurrent) {
            toggle()
            onPlay?.()
            return
          }
          void playTrack(toTrack(radio), queue.map((r) => toTrack(r)))
          onPlay?.()
        }}
        aria-label={isPlaying ? '暂停' : '播放'}
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2',
          isCurrent ? 'border-gcores bg-gcores text-white' : 'border-gcores/70 text-gcores active:bg-gcores/10',
        )}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4l14 8-14 8z" />
          </svg>
        )}
      </button>
    </div>
  )
}