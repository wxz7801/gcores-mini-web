import { create } from 'zustand'
import { getAuth, getDeviceId } from '../api/auth'
import {
  freeAudioUrl,
  heartbeatListeningSession,
  releaseListeningSession,
  startListeningSession,
} from '../api/gcores'
import { request } from '../api/client'

export interface Track {
  radioId: string
  title: string
  cover: string
  duration: number
  mediaType: string
  /** 同一 media 的音频文件名，免费节目直接拼 CDN 地址 */
  audioFile?: string | null
  /** hls = 机核 FM 的 m3u8 分片流，需要用 hls.js 播放 */
  playback?: 'file' | 'hls'
  djs?: string[]
  category?: string
  /** 时间轴挂在 media 上 */
  mediaId?: string | null
  likes?: number
  comments?: number
}

export type RepeatMode = 'off' | 'all' | 'one'

// ---------- 本机点赞（接口没有点赞写入，先只存本地） ----------
const LIKES_KEY = 'gcores.likes.v1'
function readLikes(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}') as Record<string, true>
  } catch {
    return {}
  }
}
function writeLikes(v: Record<string, true>) {
  try {
    localStorage.setItem(LIKES_KEY, JSON.stringify(v))
  } catch {
    /* 隐私模式忽略 */
  }
}

// ---------- 上次播放的记忆（刷新/重开页面后接着放） ----------
const LAST_KEY = 'gcores.last-player.v1'
/** 一个进度：节目 + 秒数 */
interface LastPlay {
  track: Track
  position: number
}
let lastTrack: Track | null = null
let lastPosition = 0
let restoreTimer: number | null = null

function persistLast() {
  if (!lastTrack) return
  // 进度以音频元素为准：切歌后 store 里的 position 可能还没跟上
  const el = document.getElementById('gcores-audio') as HTMLAudioElement | null
  if (el && el.currentTime > 0) lastPosition = el.currentTime
  try {
    const data: LastPlay = { track: lastTrack, position: Math.round(lastPosition) }
    localStorage.setItem(LAST_KEY, JSON.stringify(data))
  } catch {
    /* 隐私模式 / 配额满，忽略 */
  }
}

function readLast(): LastPlay | null {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as LastPlay
    if (!data?.track?.radioId || !data.track.mediaType) return null
    return data
  } catch {
    return null
  }
}

/**
 * 恢复上次的节目与进度，但**不自动播放**（浏览器禁止无手势播放）。
 * 音频先停在原位置，用户点一次播放即可从那继续。
 */
async function restoreLast() {
  if (usePlayer.getState().current) return
  const last = readLast()
  if (!last) return
  lastTrack = last.track
  lastPosition = last.position
  usePlayer.setState({
    current: last.track,
    position: last.position,
    duration: last.track.duration,
    playing: false,
  })
  try {
    await loadAudio(last.track, usePlayer.getState().rate, usePlayer.getState().volume)
    const el = getAudio()
    const seekTo = () => {
      const real = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : last.track.duration
      if (last.position > 0 && last.position < real - 3) el.currentTime = last.position
    }
    if (el.readyState >= 1) seekTo()
    else el.addEventListener('loadedmetadata', seekTo, { once: true })
    setMediaSession(last.track)
  } catch {
    /* 音频源失效时保持封面与标题，点播放再报错 */
  }
}

/** 进度每 5 秒落盘一次，别在 timeupdate 里逐帧写 localStorage */
let persistTimer: number | null = null
function schedulePersist() {
  if (persistTimer !== null) return
  persistTimer = window.setTimeout(() => {
    persistTimer = null
    persistLast()
  }, 5000)
}

/** 恢复只尝试一次，且要晚于路由与登录态初始化 */
export function restoreLastSession() {
  if (restoreTimer !== null) return
  restoreTimer = window.setTimeout(() => void restoreLast(), 300)
}

interface PlayerState {
  queue: Track[]
  index: number
  current: Track | null
  playing: boolean
  position: number
  duration: number
  loading: boolean
  error: string | null
  rate: number
  volume: number
  repeat: RepeatMode
  expanded: boolean
  sessionId: string | null
  tracked: boolean
  /**
   * 用户自己攒的「播放队列」（首页卡片 + / 队列页），和正在播的来源列表分开存。
   * null = 当前没有自定义队列，next/prev 仍然走来源列表。
   */
  customQueue: Track[] | null
  /** 接上自定义队列并从第一首开始播；之后 next/prev 都在这条队列里走 */
  playCustomQueue: (tracks: Track[]) => void
  setQueue: (tracks: Track[], startIndex?: number) => void
  playTrack: (track: Track, queue?: Track[]) => Promise<void>
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (sec: number) => void
  skip: (delta: number) => void
  setRate: (rate: number) => void
  /** 倍速循环：0.75 → 1 → 1.25 → 1.5 → 2 → 0.75 */
  cycleRate: () => void
  /** 本地收藏（机核接口没有点赞写入，这里只在本机记忆） */
  likes: Record<string, true>
  liked: (radioId: string) => boolean
  toggleLike: (radioId: string) => void
  setVolume: (v: number) => void
  cycleRepeat: () => void
  setExpanded: (v: boolean) => void
  stop: () => void
}

// 单例 audio 元素：页面切换时播放不中断
let audio: HTMLAudioElement | null = null
let heartbeatTimer: number | null = null
/** 机核 FM 走 HLS：Chrome 内核需要 hls.js，Safari 原生支持 m3u8 */
let hls: { destroy: () => void; attachMedia: (el: HTMLMediaElement) => void; loadSource: (url: string) => void } | null =
  null
let releaseSession = { id: null as string | null, tracked: false }

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'
    audio.crossOrigin = null
    // 必须挂到 DOM：游离的 Audio 在部分浏览器里会被回收或无法参与播放策略
    audio.id = 'gcores-audio'
    audio.setAttribute('playsinline', '')
    audio.style.display = 'none'
    document.body.appendChild(audio)
  }
  // 每次取用时确保仍在 DOM 里：SPA 里路由切换 / 热更新可能把它摘掉
  if (!audio.isConnected) document.body.appendChild(audio)
  return audio
}

/** 把浏览器的原始报错翻译成用户能看懂的话 */
function humanizeError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  const raw = err instanceof Error ? err.message : String(err ?? '')
  if (name === 'NotAllowedError') return '浏览器拦截了自动播放，请再点一次播放'
  if (name === 'NotSupportedError' || /no supported source/i.test(raw)) {
    return '这期节目的音频源已失效（可能是第三方播客下架了）'
  }
  if (name === 'AbortError') return '播放被中断，请重试'
  if (/Failed to fetch|NetworkError/i.test(raw)) return '网络错误，请检查连接后重试'
  return raw || '播放失败'
}

function destroyHls() {
  if (hls) {
    try {
      hls.destroy()
    } catch {
      /* ignore */
    }
    hls = null
  }
}

/** 挂载 HLS 流。hls.js 体积不小，所以按需动态加载，不进首屏包。 */
async function attachHls(el: HTMLAudioElement, url: string) {
  destroyHls()
  // Safari / iOS 原生支持 m3u8，交给浏览器自己处理
  if (el.canPlayType('application/vnd.apple.mpegurl')) {
    el.src = url
    return
  }
  const { default: Hls } = await import('hls.js')
  if (!Hls.isSupported()) throw new Error('当前浏览器不支持 HLS 播放')
  const instance = new Hls({ enableWorker: true, lowLatencyMode: false })
  instance.loadSource(url)
  instance.attachMedia(el)
  hls = instance as unknown as typeof hls
}

/** 把某期节目挂到 audio 元素上（不播放）： restore 与正常播放共用 */
async function loadAudio(track: Track, rate: number, volume: number) {
  const el = getAudio()
  let url: string
  if (track.mediaType === 'protected_audio') {
    if (!getAuth()) throw new Error('这期节目需要登录机核账号')
    const session = await startListeningSession(track.radioId, getDeviceId())
    url = session.url
    releaseSession = { id: session.sessionId ?? null, tracked: session.tracked && Boolean(session.sessionId) }
    if (releaseSession.id && releaseSession.tracked) startHeartbeat(releaseSession.id, session.heartbeatInterval)
    usePlayer.setState({ sessionId: session.sessionId ?? null, tracked: session.tracked })
  } else {
    url = await resolveFreeUrl(track)
    usePlayer.setState({ sessionId: null, tracked: false })
  }
  if (track.playback === 'hls') await attachHls(el, url)
  else {
    destroyHls()
    el.src = url
  }
  el.playbackRate = rate
  el.volume = volume
  return url
}

function clearHeartbeat() {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

async function releaseCurrentSession() {
  clearHeartbeat()
  const { id, tracked } = releaseSession
  releaseSession = { id: null, tracked: false }
  if (id && tracked) {
    try {
      await releaseListeningSession(id)
    } catch {
      /* 释放失败不影响本地播放 */
    }
  }
}

function startHeartbeat(sessionId: string, intervalSec: number) {
  clearHeartbeat()
  heartbeatTimer = window.setInterval(async () => {
    try {
      const res = await heartbeatListeningSession(sessionId)
      if (!res.tracked) {
        // 会话失效：停止并提示
        clearHeartbeat()
        usePlayer.setState({ playing: false, error: '会员收听会话已失效，请重新播放' })
        getAudio().pause()
      }
    } catch {
      /* 网络抖动时忽略，下个周期重试 */
    }
  }, intervalSec * 1000)
}

/** 免费节目需要先查 media.audio，详情接口里已带上，这里兜底查一次 */
async function resolveFreeUrl(track: Track): Promise<string> {
  if (track.audioFile) return freeAudioUrl(track.audioFile)
  // 机核 FM 的 media.audio 直接是 .m3u8 绝对地址（playback-type: hls），不能拼 alioss 前缀
  if (track.playback === 'hls') {
    const doc = await request<{
      data: { relationships?: Record<string, { data?: { id: string } | { id: string }[] | null }> }
    }>(`/radios/${track.radioId}`, { params: { include: 'media' } })
    const mediaRef = doc.data.relationships?.media?.data
    const mid = Array.isArray(mediaRef) ? mediaRef[0]?.id : mediaRef?.id
    if (!mid) throw new Error('这期 FM 没有音频流')
    const res = await request<{ data: { attributes: { audio?: string } } }>(`/medias/${mid}`)
    const src = res.data.attributes.audio
    if (!src) throw new Error('这期 FM 没有音频流')
    return src
  }
  const doc = await request<{
    data: { relationships?: Record<string, { data?: { id: string } | { id: string }[] | null }> }
  }>(`/radios/${track.radioId}`, { params: { include: 'media' } })
  const mediaId = doc.data.relationships?.media?.data
  const id = Array.isArray(mediaId) ? mediaId[0]?.id : mediaId?.id
  if (!id) throw new Error('这期节目没有音频')
  const res = await request<{ data: { attributes: { audio?: string } } }>(`/medias/${id}`)
  const file = res.data.attributes.audio
  if (!file) throw new Error('这期节目没有音频')
  return freeAudioUrl(file)
}

function setMediaSession(track: Track) {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.djs?.join(' · ') ?? '机核 GCORES',
      album: track.category ?? '机核播客',
      artwork: [{ src: track.cover, sizes: '512x512', type: 'image/jpeg' }],
    })
  } catch {
    /* 部分浏览器不支持 MediaMetadata */
  }
}

function bindMediaSessionActions() {
  if (!('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  ms.setActionHandler('play', () => void usePlayer.getState().toggle())
  ms.setActionHandler('pause', () => void usePlayer.getState().toggle())
  ms.setActionHandler('seekbackward', () => usePlayer.getState().skip(-15))
  ms.setActionHandler('seekforward', () => usePlayer.getState().skip(30))
  ms.setActionHandler('previoustrack', () => usePlayer.getState().prev())
  ms.setActionHandler('nexttrack', () => usePlayer.getState().next())
}

let bound = false

export const usePlayer = create<PlayerState>((set, get) => {
  if (!bound) {
    bound = true
    const el = getAudio()
    el.addEventListener('timeupdate', () => {
      set({ position: el.currentTime })
      const cur = get().current
      if (cur) {
        lastTrack = cur
        lastPosition = el.currentTime
        schedulePersist()
      }
    })
    el.addEventListener('durationchange', () => {
      if (Number.isFinite(el.duration)) set({ duration: el.duration })
    })
    el.addEventListener('play', () => set({ playing: true }))
    el.addEventListener('pause', () => set({ playing: false }))
    el.addEventListener('waiting', () => set({ loading: true }))
    el.addEventListener('playing', () => set({ loading: false }))
    el.addEventListener('ended', () => {
      const { repeat } = get()
      if (repeat === 'one') {
        el.currentTime = 0
        void el.play()
        return
      }
      get().next()
    })
    el.addEventListener('error', () => set({ error: '音频加载失败', loading: false }))
    bindMediaSessionActions()
  }

  return {
    queue: [],
    index: -1,
    current: null,
    playing: false,
    position: 0,
    duration: 0,
    loading: false,
    error: null,
    rate: 1,
    volume: 1,
    repeat: 'off',
    expanded: false,
    sessionId: null,
    tracked: false,
    customQueue: null,

    playCustomQueue(tracks) {
      if (!tracks.length) return
      set({ customQueue: tracks })
      void get().playTrack(tracks[0], tracks)
    },

    setQueue(tracks, startIndex) {
      set({ queue: tracks, index: startIndex ?? get().index })
    },

    async playTrack(track, nextQueue) {
      const queue = nextQueue ?? get().queue
      const idx = queue.findIndex((t) => t.radioId === track.radioId)

      set({
        queue,
        index: idx >= 0 ? idx : 0,
        current: track,
        loading: true,
        error: null,
        position: 0,
        duration: track.duration,
      })

      try {
        await releaseCurrentSession()
        await loadAudio(track, get().rate, get().volume)
        const el = getAudio()
        await el.play()
        setMediaSession(track)
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
        lastTrack = track
        lastPosition = el.currentTime || 0
        persistLast()
        set({ loading: false })
      } catch (err) {
        set({ error: humanizeError(err), loading: false, playing: false })
      }
    },

    toggle() {
      const el = getAudio()
      if (!get().current) return
      if (el.paused) void el.play()
      else el.pause()
    },

    next() {
      const custom = get().customQueue
      if (custom && custom.length > (get().queue === custom ? 0 : 0)) {
        const cur = get().current
        const at = cur ? custom.findIndex((t) => t.radioId === cur.radioId) : -1
        const target = custom[at + 1] ?? (get().repeat === 'off' ? null : custom[0])
        if (!target) {
          set({ playing: false })
          return
        }
        set({ queue: custom, index: custom.indexOf(target) })
        void get().playTrack(target, custom)
        return
      }
      const { queue, index, repeat } = get()
      if (!queue.length) return
      let nextIndex = index + 1
      if (nextIndex >= queue.length) {
        if (repeat === 'off') {
          set({ playing: false })
          return
        }
        nextIndex = 0
      }
      void get().playTrack(queue[nextIndex], queue)
    },

    prev() {
      const { queue, index } = get()
      const el = getAudio()
      // 超过 3 秒先回到开头，符合常见播客习惯
      if (el.currentTime > 3) {
        el.currentTime = 0
        return
      }
      if (!queue.length) return
      const prevIndex = index <= 0 ? queue.length - 1 : index - 1
      void get().playTrack(queue[prevIndex], queue)
    },

    seek(sec) {
      const el = getAudio()
      if (!Number.isFinite(el.duration)) return
      el.currentTime = Math.min(Math.max(sec, 0), el.duration)
      set({ position: el.currentTime })
    },

    skip(delta) {
      const el = getAudio()
      get().seek(el.currentTime + delta)
    },

    setRate(rate) {
      getAudio().playbackRate = rate
      set({ rate })
    },

    cycleRate() {
      const order = [0.75, 1, 1.25, 1.5, 2]
      const next = order[(order.indexOf(get().rate) + 1) % order.length] ?? 1
      getAudio().playbackRate = next
      set({ rate: next })
    },

    likes: readLikes(),

    liked(radioId) {
      return Boolean(get().likes[radioId])
    },

    toggleLike(radioId) {
      const likes = { ...get().likes }
      if (likes[radioId]) delete likes[radioId]
      else likes[radioId] = true
      set({ likes })
      writeLikes(likes)
    },

    setVolume(v) {
      getAudio().volume = v
      set({ volume: v })
    },

    cycleRepeat() {
      const order: RepeatMode[] = ['off', 'all', 'one']
      set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] })
    },

    setExpanded(expanded) {
      set({ expanded })
    },

    stop() {
      lastTrack = null
      lastPosition = 0
      try {
        localStorage.removeItem(LAST_KEY)
      } catch {
        /* ignore */
      }
      destroyHls()
      getAudio().pause()
      getAudio().removeAttribute('src')
      void releaseCurrentSession()
      set({ playing: false, current: null, position: 0, sessionId: null, tracked: false })
    },
  }
})

/** 页面卸载前尽量归还收听会话时长 */
window.addEventListener('pagehide', () => {
  persistLast()
  const { id, tracked } = releaseSession
  releaseSession = { id: null, tracked: false }
  if (id && tracked) {
    void releaseListeningSession(id).catch(() => {})
  }
})