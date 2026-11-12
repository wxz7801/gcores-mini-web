import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAuth, subscribeAuth } from '../api/auth'
import {
  fetchRadioDetail,
  fetchComments,
  fetchSimilarRadios,
  fetchBookmarks,
  createBookmark,
  deleteBookmark,
  type Timeline,
  type RadioDetail,
} from '../api/gcores'
import { CoverImage } from '../components/CoverImage'
import { RadioRow } from '../components/RadioRow'
import { coverUrl, formatTime, relativeDate, cn } from '../lib/format'
import { useTimelines } from '../hooks/useTimelines'
import { usePlayer } from '../store/player'
import { toTrack } from '../components/RadioRow'

type Tab = 'timeline' | 'intro' | 'comments'

/** 评论一次拉多少条。接口上限 100（page[size] 超过就 400）；一次 30 条，不够再点「加载更多」 */
const COMMENT_PAGE_SIZE = 30

export function RadioDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [tabState, setTab] = useState<Tab>('intro')
  const tab = tabState

  const q = useQuery({
    queryKey: ['radio', id],
    queryFn: () => fetchRadioDetail(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  })

  const current = usePlayer((s) => s.current)
  const playing = usePlayer((s) => s.playing)
  const playTrack = usePlayer((s) => s.playTrack)
  const toggle = usePlayer((s) => s.toggle)
  const seek = usePlayer((s) => s.seek)

  const detail = q.data
  const isCurrent = current?.radioId === detail?.id

  // 时间轴单独按 mediaId 取：详情接口的 include 不稳定，media 路由最可靠
  const tl = useTimelines(detail?.id)
  const timelines: Timeline[] = tl.data?.length ? tl.data : (detail?.timelines ?? [])
  // 一旦拿到章节就默认落在「时间轴」页签（机核自制节目基本都有）
  const [autoTabbed, setAutoTabbed] = useState(false)
  useEffect(() => {
    if (autoTabbed || !timelines.length) return
    setAutoTabbed(true)
    setTab('timeline')
  }, [autoTabbed, timelines.length])

  // 收藏状态：从「我的收藏」里找这一期（收藏接口没有按资源查询的入口）
  const qc = useQueryClient()
  const [loggedIn, setLoggedIn] = useState(Boolean(getAuth()))
  useEffect(() => subscribeAuth((a) => setLoggedIn(Boolean(a))), [])
  const bookmarks = useQuery({
    queryKey: ['bookmarks', 'radios', 60],
    queryFn: () => fetchBookmarks({ limit: 60 }),
    enabled: loggedIn,
    staleTime: 60 * 1000,
  })
  const myBookmark = bookmarks.data?.entries.find((b) => b.targetId === id)
  const toggleBookmark = useMutation({
    mutationFn: async () => {
      if (myBookmark) await deleteBookmark(myBookmark.bookmarkId)
      else await createBookmark(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  })

  const onPlay = () => {
    if (!detail) return
    if (isCurrent) {
      toggle()
      return
    }
    void playTrack(toTrackFromDetail(detail))
  }

  return (
    <div className="pb-40">
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-ink/92 px-2 pt-[max(8px,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <button type="button" onClick={() => nav(-1)} aria-label="返回" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[#e8eaef] active:bg-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 text-center text-[15px] text-[#8a92a3]">节目详情</div>
        <button
          type="button"
          onClick={() => {
            if (!loggedIn) {
              nav('/login')
              return
            }
            toggleBookmark.mutate()
          }}
          disabled={toggleBookmark.isPending}
          aria-label={myBookmark ? '取消收藏' : '收藏'}
          aria-pressed={Boolean(myBookmark)}
          className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', myBookmark ? 'text-gcores' : 'text-[#e8eaef]')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill={myBookmark ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path d="M6 4h12a1 1 0 011 1v15l-7-4.5L5 20V5a1 1 0 011-1z" />
          </svg>
        </button>
      </header>

      {q.isLoading && <SkeletonDetail />}
      {q.error && <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">加载失败，下拉重试</div>}

      {detail && (
        <>
          {/* 头图区：大封面 + 标题 */}
          <div className="px-4 pt-2">
            <div className="flex gap-3">
              <CoverImage
                src={coverUrl(detail.cover, 400)}
                eager
                className="h-[104px] w-[104px] shrink-0 rounded-2xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <h1 className="line-clamp-3 text-[20px] leading-snug font-bold text-white">{detail.title}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#8a92a3]">
                  <span>{detail.djs.map((d) => d.nickname).join(' · ') || '机核'}</span>
                  <span>·</span>
                  <span>{relativeDate(detail.publishedAt)}</span>
                  <span>·</span>
                  <span>{formatTime(detail.duration)}</span>
                </div>
                {detail.categories[0] && (
                  <span className="mt-1.5 inline-block rounded bg-card px-1.5 py-0.5 text-[12px] text-[#cfd3da]">
                    {detail.categories[0].name}
                  </span>
                )}
              </div>
            </div>

            {/* 大播放钮：拇指最易触达 */}
            <button
              type="button"
              onClick={onPlay}
              className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-gcores text-[19px] font-semibold text-white active:scale-[0.99]"
            >
              {isCurrent && playing ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                  暂停
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 4l14 8-14 8z" />
                  </svg>
                  {isCurrent ? '继续播放' : '立即收听'}
                  {detail.isRequirePrivilege && (
                    <span className="ml-1 rounded bg-black/25 px-1.5 py-0.5 text-[12px]">GPASS</span>
                  )}
                </>
              )}
            </button>
          </div>

          {/* Tab：时间轴 / 简介 / 评论 */}
          <div className="sticky top-[52px] z-10 mt-3 flex gap-1 bg-ink/95 px-3 pt-1 pb-1 backdrop-blur">
            {(
              [
                ...(timelines.length ? [{ id: 'timeline' as Tab, label: '时间轴' }] : []),
                { id: 'intro' as Tab, label: '简介' },
                { id: 'comments' as Tab, label: `评论 ${detail.comments || ''}` },
              ]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative flex min-h-[48px] flex-1 items-center justify-center rounded-xl text-[17px]',
                  tab === t.id ? 'font-semibold text-white' : 'text-[#8a92a3]',
                )}
              >
                {t.label.trim()}
                {tab === t.id && <span className="absolute inset-x-5 -bottom-px h-0.5 rounded bg-gcores" />}
              </button>
            ))}
          </div>

          {tab === 'timeline' && (
            <TimelineList timelines={timelines} onJump={(sec) => (isCurrent ? seek(sec) : onPlay())} />
          )}
          {tab === 'intro' && (
            <>
              <Intro detail={detail} />
              <MoreLikeThis radioId={detail.id} />
            </>
          )}
          {tab === 'comments' && <Comments radioId={detail.id} />}
        </>
      )}
    </div>
  )
}

function toTrackFromDetail(d: RadioDetail) {
  return toTrack({
    id: d.id,
    title: d.title,
    desc: d.desc,
    cover: d.cover,
    thumb: '',
    duration: d.duration,
    publishedAt: d.publishedAt,
    likes: d.likes,
    comments: d.comments,
    plays: d.plays,
    isFree: d.isFree,
    isRequirePrivilege: d.isRequirePrivilege,
    playbackType: d.isFm ? 'hls' : 'file',
    isFm: d.isFm,
    isImported: false,
    isProtectedAudio: d.isProtectedAudio,
    mediaId: d.mediaId ?? null,
    audioFile: d.audioFile ?? null,
    categories: d.categories,
    djs: d.djs,
  })
}

function SkeletonDetail() {
  return (
    <div className="animate-pulse px-4 pt-2">
      <div className="flex gap-3">
        <div className="h-[104px] w-[104px] rounded-2xl bg-card" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-4/5 rounded bg-card" />
          <div className="h-4 w-3/5 rounded bg-card" />
          <div className="h-3 w-2/5 rounded bg-card" />
        </div>
      </div>
      <div className="mt-4 h-12 rounded-full bg-card" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-card" />
        ))}
      </div>
    </div>
  )
}

function TimelineList({ timelines, onJump }: { timelines: Timeline[]; onJump: (sec: number) => void }) {
  const current = usePlayer((s) => s.current)
  const position = usePlayer((s) => s.position)
  // 列表自己滚（而不是滚整页），否则「居中」会把页面标题也顶走
  const boxRef = useRef<HTMLDivElement>(null)
  const [follow, setFollow] = useState(true)
  // 面板换出来时才开始滚动：首次进页面时章节图还没加载，算出来的偏移会被夹在小高度上
  const [painted, setPainted] = useState(false)
  useEffect(() => {
    const t = window.requestAnimationFrame(() => setPainted(true))
    return () => window.cancelAnimationFrame(t)
  }, [])

  // 找到当前时间点对应的章节
  const activeId = useMemo(() => {
    if (!current) return null
    let active: Timeline | null = null
    for (const t of timelines) {
      if (t.at <= position) active = t
      else break
    }
    return active?.id ?? null
  }, [timelines, position, current])

  // 自动滚到正在播的那一段并垂直居中；once=false 时每次切段都跟，true 表示只居中一次
  const centerOn = (id: string | null, smooth: boolean) => {
    const box = boxRef.current
    if (!box || !id) return
    // scrollIntoView 在元素已可见时可能不滚——这里直接算相对滚动容器的偏移，确定性居中
    const el = box.querySelector<HTMLElement>(`[data-tl="${id}"]`)
    if (!el) return
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - (box.clientHeight - el.offsetHeight) / 2
    try {
      if (smooth) {
        programmatic.current = true
        window.setTimeout(() => {
          programmatic.current = false
        }, 600)
      }
      box.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
    } catch {
      box.scrollTop = Math.max(0, top)
    }
    // 跟不上时兜底：内容高度变化会夹住 scrollTo，下一帧直接赋 scrollTop
    if (!smooth) {
      window.requestAnimationFrame(() => {
        const b = boxRef.current
        if (!b) return
        const e2 = b.querySelector<HTMLElement>(`[data-tl="${id}"]`)
        if (!e2) return
        b.scrollTop = Math.max(0, e2.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - (b.clientHeight - e2.offsetHeight) / 2)
      })
    }
  }

  // 进入页面 / 切到时间轴页签：直接居中，不动画（等两帧让章节卡排好版）
  useEffect(() => {
    if (!follow || !activeId || !painted) return
    centerOn(activeId, false)
    const raf = window.requestAnimationFrame(() => centerOn(activeId, false))
    const t = window.setTimeout(() => centerOn(activeId, false), 200)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, painted, activeId])

  // 播放推进换段：平滑跟随（第一段由上面的「进入页面」负责居中，避免重复滚动）
  const lastCentered = useRef<string | null>(null)
  useEffect(() => {
    if (!follow || !activeId) return
    if (lastCentered.current === activeId) return
    lastCentered.current = activeId
    centerOn(activeId, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, follow])

  if (!timelines.length) return null

  // 用户划走了、当前章节不在可视区里 → 顶出一颗「返回当前播放」
  const [awayFromCurrent, setAwayFromCurrent] = useState(false)
  const checkAway = () => {
    const box = boxRef.current
    if (!box || !activeId) {
      setAwayFromCurrent(false)
      return
    }
    const el = box.querySelector<HTMLElement>(`[data-tl="${activeId}"]`)
    if (!el) {
      setAwayFromCurrent(false)
      return
    }
    const br = box.getBoundingClientRect()
    const ar = el.getBoundingClientRect()
    // 章节卡上下各留 40px 余量，半露在外面就算「还在」
    const visible = ar.bottom > br.top + 40 && ar.top < br.bottom - 40
    setAwayFromCurrent(!visible)
  }

  // 程序滚动（自动居中 / 点按钮回去）期间不判定，避免按钮闪一下
  const programmatic = useRef(false)
  const scrollAuto = (top: number) => {
    programmatic.current = true
    boxRef.current?.scrollTo({ top, behavior: 'smooth' })
    window.setTimeout(() => {
      programmatic.current = false
      checkAway()
    }, 600)
  }

  const backToCurrent = () => {
    const box = boxRef.current
    if (!box || !activeId) return
    setFollow(true)
    const el = box.querySelector<HTMLElement>(`[data-tl="${activeId}"]`)
    if (!el) return
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - (box.clientHeight - el.offsetHeight) / 2
    scrollAuto(Math.max(0, top))
    setAwayFromCurrent(false)
  }

  return (
    <div className="px-3 pt-2">
      {/* 三列网格：左右两列等宽（1fr），中列自适应——中列因此天然落在整行正中。
          不用 absolute 居中：全局 index.css 给所有 button 强制了 position: relative
          （为了撑热区），Tailwind 的 .absolute 会被它压掉，定位根本不生效。 */}
      <div className="mb-2 grid h-8 grid-cols-[1fr_auto_1fr] items-center gap-2 px-1">
        <span className="shrink-0 justify-self-start text-[14px] text-[#8a92a3]">点章节跳转</span>

        {/* 中间：返回当前播放（只在离开跟随、或列表不在当前章节时出现）。
            没出现时这格是空的，网格宽度仍由两侧决定，不会让左右文字跳动 */}
        <div className="flex justify-center">
          {awayFromCurrent && (
            <button
              type="button"
              onClick={backToCurrent}
              className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#2a2f3a] px-3.5 text-[15px] font-medium text-[#5b9dff] active:bg-[#343a46]"
            >
              返回当前播放
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFollow((v) => !v)}
          className={cn(
            'flex shrink-0 items-center gap-1 justify-self-end rounded-full px-2.5 py-1.5 text-[13px]',
            follow ? 'bg-gcores/15 text-gcores' : 'bg-card text-[#8a92a3]',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', follow ? 'bg-gcores' : 'bg-[#5c6371]')} />
          跟随播放
        </button>
      </div>

      <div
        ref={boxRef}
        onScroll={() => {
          if (!programmatic.current) checkAway()
        }}
        className="no-scrollbar relative max-h-[calc(100dvh-320px)] overflow-y-auto overscroll-contain"
      >
        {timelines.map((t) => {
          const active = t.id === activeId
          return (
            <button
              key={t.id}
              type="button"
              data-tl={t.id}
              onClick={() => onJump(t.at)}
              className={cn(
                // 占满整行减两侧留白，内边距压到 10px，给文字让位
                'relative mb-3 flex w-full gap-3 rounded-2xl p-2.5 text-left transition-colors',
                active ? 'bg-gcores/10 ring-1 ring-gcores/30' : 'active:bg-card',
              )}
            >
              {/* 左：方形缩略图（按原图比例，contain，不裁切） */}
              <div className="relative h-[112px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-black/40 sm:h-[148px] sm:w-[148px]">
                {t.asset ? (
                  <img
                    src={coverUrl(t.asset, 480)}
                    alt=""
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[13px] text-[#4c5361]">
                    无配图
                  </div>
                )}
              </div>

              {/* 右：章节名 + 时间戳 → 正文，末尾箭头提示可点 */}
              <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn('min-w-0 flex-1 text-[18px] leading-snug font-bold whitespace-pre-line', active ? 'text-gcores' : 'text-white')}
                  >
                    {t.title}
                  </span>
                  <span className="shrink-0 font-mono text-[14px] tabular-nums text-[#8a92a3]">
                    {formatTime(t.at)}
                  </span>
                </div>
                {t.content && (
                  <p className="mt-1 text-[15px] leading-[1.6] whitespace-pre-line text-[#b8bfcb]">{t.content}</p>
                )}
              </div>

              <svg
                className="mt-1 h-4 w-4 shrink-0 self-center text-[#5c6371]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          )
        })}
      </div>

    </div>
  )
}

/** 详情页底部：同栏目/相似节目，保证没有时间轴时页面也不空 */
function MoreLikeThis({ radioId }: { radioId: string }) {
  const nav = useNavigate()
  const q = useQuery({
    queryKey: ['similar', radioId],
    queryFn: () => fetchSimilarRadios(radioId, 8),
    staleTime: 5 * 60_000,
  })
  const items = q.data ?? []
  if (!items.length) return null
  return (
    <div className="mt-8 border-t border-line px-4 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-white">更多节目</h2>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {items.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => nav(`/radio/${r.id}`)}
            className="flex items-center gap-3 rounded-xl py-2 text-left active:bg-card"
          >
            <CoverImage src={coverUrl(r.cover || r.thumb, 112)} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[15px] leading-snug text-white">{r.title}</span>
              <span className="mt-1 block truncate text-[13px] text-[#8a92a3]">
                {r.djs?.map((d) => d.nickname).join(' · ')}
                {r.categories[0] ? ` · ${r.categories[0].name}` : ''}
                {r.duration ? ` · ${formatTime(r.duration)}` : ''}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Intro({ detail }: { detail: RadioDetail }) {
  return (
    <div className="px-4 pt-3">
      <p className="text-[16px] leading-[1.75] whitespace-pre-wrap text-[#cfd3da]">{detail.desc}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {detail.djs.map((d) => (
          <span key={d.id} className="flex items-center gap-2 rounded-full bg-card py-1 pr-3 pl-1 text-[14px] text-[#cfd3da]">
            {d.avatar && (
              <CoverImage src={coverUrl(d.avatar, 80)} className="h-6 w-6 rounded-full object-cover" />
            )}
            {d.nickname}
          </span>
        ))}
      </div>
      <div className="mt-6 flex gap-6 text-[14px] text-[#8a92a3]">
        <span>播放 {detail.plays.toLocaleString('zh-CN')}</span>
        <span>喜欢 {detail.likes}</span>
        <span>评论 {detail.comments}</span>
      </div>
    </div>
  )
}

function Comments({ radioId }: { radioId: string }) {
  // 接口只支持 offset 分页（没有游标），用 useInfiniteQuery 一页页往后翻
  const q = useInfiniteQuery({
    queryKey: ['comments', radioId],
    queryFn: ({ pageParam }) => fetchComments(radioId, pageParam, COMMENT_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      // 翻到底了（返回不满一页），或者已经够 total 条了，就不再请求
      const loaded = all.reduce((n, p) => n + p.items.length, 0)
      if (last.items.length < COMMENT_PAGE_SIZE) return undefined
      if (last.total > 0 && loaded >= last.total) return undefined
      return loaded
    },
    staleTime: 2 * 60 * 1000,
  })

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const items = q.data?.pages.flatMap((p) => p.items) ?? []
  const total = q.data?.pages.at(-1)?.total ?? 0

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (q.isLoading) return <div className="px-4 py-8 text-center text-[15px] text-[#8a92a3]">加载评论…</div>
  if (q.isError) return <div className="px-4 py-8 text-center text-[15px] text-[#8a92a3]">评论加载失败，稍后再试</div>
  if (!items.length) return <div className="px-4 py-10 text-center text-[15px] text-[#8a92a3]">还没有评论</div>

  const hasMore = Boolean(q.hasNextPage)

  return (
    <div className="px-4 pt-1">
      {/* 顶部只说明「已经加载了多少」；total 把回复也算进去了，对不上列表条数，所以叫「约」 */}
      <div className="pb-1 text-[13px] text-[#5c6371]">
        已加载 {items.length} 条{total > 0 ? ` · 共约 ${total} 条` : ''}
      </div>

      <div className="divide-y divide-line">
        {items.map((c) => {
          const showAll = expanded.has(c.id)
          // 默认折叠到 2 条，避免一条长楼把整屏占满
          const shown = showAll ? c.replies : c.replies.slice(0, 2)
          const hidden = c.replies.length - shown.length
          return (
            <div key={c.id} className="flex gap-2.5 py-3">
              {c.user.avatar ? (
                <CoverImage src={coverUrl(c.user.avatar, 80)} className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-9 w-9 shrink-0 rounded-full bg-card" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="truncate text-[#cfd3da]">{c.user.nickname}</span>
                  {c.fromAuthor && (
                    <span className="shrink-0 rounded bg-gcores/15 px-1.5 py-px text-[11px] text-gcores">作者</span>
                  )}
                  <span className="shrink-0 text-[#5c6371]">{relativeDate(c.createdAt)}</span>
                </div>

                <p className="mt-1 text-[15px] leading-relaxed break-words text-[#e8eaef]">{c.content}</p>

                <div className="mt-1.5 flex items-center gap-4 text-[13px] text-[#5c6371]">
                  {c.likes > 0 && <span>👍 {c.likes}</span>}
                  {c.replyCount > 0 && <span>{c.replyCount} 条回复</span>}
                </div>

                {shown.length > 0 && (
                  <div className="mt-2 space-y-2 rounded-lg bg-card px-3 py-2">
                    {shown.map((r) => (
                      // 嵌套的 flex：头部的「昵称 · 时间：」和其它内容分开，
                      // 回复本身多以中文开头，不能靠空白或省略号来分隔
                      <div
                        key={r.id}
                        className={cn(
                          'text-[14px] leading-relaxed break-words text-[#9aa2b1]',
                          r.depth >= 2 && 'pl-3',
                        )}
                      >
                        <span className="text-[#b6bcc8]">{r.user.nickname}</span>
                        {r.fromAuthor && <span className="ml-1 text-[11px] text-gcores">作者</span>}
                        {/* 「A 回复 B」：B 是 parent 关系的作者；拿不到时不标注，不瞎猜 */}
                        {r.replyToName && (
                          <span className="text-[#5c6371]"> ▸ 回复 {r.replyToName}</span>
                        )}
                        {/* 冒号后紧跟正文，中间不留空格：中文正文前面多一个空格会显出「」 */}
                        <span className="text-[#5c6371]"> · {relativeDate(r.createdAt)}：</span>
                        <span>{r.content}</span>
                      </div>
                    ))}
                    {(hidden > 0 || (showAll && c.replies.length > 2)) && (
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        className="text-[13px] text-[#5b9dff]"
                      >
                        {hidden > 0 ? `展开其余 ${hidden} 条回复` : '收起'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="py-5 text-center">
        {hasMore ? (
          <button
            type="button"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="min-h-[44px] rounded-full bg-card px-5 text-[14px] text-[#cfd3da] active:bg-[#343a46] disabled:opacity-60"
          >
            {q.isFetchingNextPage ? '加载中…' : '加载更多评论'}
          </button>
        ) : (
          <span className="text-[13px] text-[#5c6371]">已经到底了</span>
        )}
      </div>
    </div>
  )
}
export { RadioRow }
