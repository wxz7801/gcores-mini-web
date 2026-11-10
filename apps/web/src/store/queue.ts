import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Track } from './player'
import { usePlayer } from './player'

/**
 * 「加入队列」的持久化列表。
 * 为什么单独存 id：Track 里带着封面 URL 和标题，写进 localStorage 会越存越大，
 * 而且节目信息会过时；真正播放时再用 id 重新拉一次详情。
 */
interface QueueState {
  ids: string[]
  /** 与 ids 一一对应的轻量信息，用于队列页秒开 */
  meta: Record<string, { title: string; cover: string; duration: number; category?: string }>
  /** 切换：在队列里就移除，不在就加入（卡片上的 + 按钮） */
  enqueue: (track: Track) => void
  /** 只加不删（悬浮菜单里的“加入播放队列”） */
  addId: (track: Track) => void
  remove: (radioId: string) => void
  /** 队列页的「播放全部」：把队列原样交给播放器（playTrack 会整条替换，所以不能只传一首） */
  playAll: () => void
  clear: () => void
  /** 从第一条开始播整个队列 */
  playIds: (radioIds: string[]) => void
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      ids: [],
      meta: {},
      enqueue(track) {
        const { ids, meta } = get()
        if (ids.includes(track.radioId)) {
          set({ ids: ids.filter((id) => id !== track.radioId), meta: omit(meta, track.radioId) })
          return
        }
        set({
          ids: [...ids, track.radioId],
          meta: { ...meta, [track.radioId]: { title: track.title, cover: track.cover, duration: track.duration, category: track.category } },
        })
      },
      addId(track) {
        const { ids, meta } = get()
        if (ids.includes(track.radioId)) return
        set({
          ids: [...ids, track.radioId],
          meta: { ...meta, [track.radioId]: { title: track.title, cover: track.cover, duration: track.duration, category: track.category } },
        })
      },
      remove(radioId) {
        set({ ids: get().ids.filter((id) => id !== radioId), meta: omit(get().meta, radioId) })
      },
      playAll() {
        get().playIds(get().ids)
      },
      clear() {
        set({ ids: [], meta: {} })
      },
      playIds(radioIds) {
        const { meta } = get()
        const tracks: Track[] = radioIds.map((id) => {
          const m = meta[id]
          return {
            radioId: id,
            title: m?.title ?? '节目',
            cover: m?.cover ?? '',
            duration: m?.duration ?? 0,
            mediaType: 'audio',
            category: m?.category,
          }
        })
        if (tracks.length) void usePlayer.getState().playTrack(tracks[0], tracks)
      },
    }),
    { name: 'gcores.queue.v1' },
  ),
)

function omit<T>(o: Record<string, T>, key: string): Record<string, T> {
  const next = { ...o }
  delete next[key]
  return next
}