import { fetchAlbumDetail, fetchAlbumRadios, type RadioListItem } from './gcores'

/**
 * 系列（录音笔这类长期连载的会员节目）
 *
 * 机核官方并没有「系列」这个资源：`录音笔` 在接口里是**一组以年份命名的专辑**，
 * 每年一季，独立成一个 album（display-type=album）：
 *   199 录音笔 2023 / 214 录音笔 2024 / 247 录音笔 2025 / 333 录音笔 2026
 * 所以系列页 = 把这几季拼起来，用标题里的 VOL 号排成一条连续的线。
 */

export interface Series {
  /** 内部 id，同时用于路由 /series/:slug */
  slug: string
  name: string
  desc: string
  /** 各季的 albums id，按新到旧 */
  seasonIds: string[]
}

export const SERIES: Series[] = [
  {
    slug: 'recorder',
    name: '录音笔',
    desc: 'GPASS 会员专享 · 机核办公室里那些短小、随性、不成体统的日常录音，全年连载。',
    seasonIds: ['333', '247', '214', '199'],
  },
]

export function findSeries(slug: string): Series | undefined {
  return SERIES.find((s) => s.slug === slug)
}

/** 录音笔各季专辑 id：首页 / GPASS 分流时用来把这 800 多期摘出去 */
export const RECORDER_SEASON_IDS: string[] = SERIES[0].seasonIds

/** 这张专辑是不是录音笔的某一季 */
export function isRecorderAlbum(albumId: string): boolean {
  return RECORDER_SEASON_IDS.includes(albumId)
}

/** 「录音笔 VOL.816」/「录音笔 Vol.1」/「（番外篇）xxx，录音笔VOL.639」→ 816 */
const VOL_RE = /录音笔\s*[Vv][Oo][Ll]\.?\s*(\d+)/

export function volOf(title: string): number | null {
  const m = VOL_RE.exec(title)
  return m ? Number(m[1]) : null
}

export interface Episode {
  radio: RadioListItem
  /** 系列内期号；写不出期号的（番外/特别篇）是 null */
  vol: number | null
  season: string
}

export interface SeasonInfo {
  id: string
  title: string
  count: number
  cover: string
  /** 被摘要掉的期数（详情页仍在，只是不在列表里摊开） */
  rest: number
}

export interface SeriesData {
  seasons: SeasonInfo[]
  episodes: Episode[]
  /** 全系列期数（各季 record-count 之和，可能含已下架） */
  total: number
  cover: string
  /** 最新一期节目（列表里单独摊开的那一条） */
  latest: Episode | null
  /** 最新一期之外还剩多少期（= total - 1） */
  rest: number
}

/**
 * 拉全系列：接口单页上限 100（page[limit]=250 会 400），所以每季用 /albums/{id} 的
 * radios-count 决定翻几页，四季节约 10 个请求。
 * 排序：期号大的在前；没有期号的跟随它发布时间更近的那一期。
 */
export async function fetchSeries(series: Series): Promise<SeriesData> {
  const details = await Promise.all(series.seasonIds.map((id) => fetchAlbumDetail(id).catch(() => null)))
  const countOf: Record<string, number> = {}
  details.forEach((d) => {
    if (d) countOf[d.id] = d.count
  })

  const pages = await Promise.all(
    series.seasonIds.map(async (id) => {
      // 接口单页上限 100（page[limit]=250 → 400），每季 1~3 页就够翻完；
      // 用本季首页的 total 反推还要不要继续翻，遇到空页就停。
      const size = 100
      const chunks: RadioListItem[][] = []
      let total = countOf[id] ?? 0
      for (let i = 0; i < 4; i++) {
        const page = await fetchAlbumRadios(id, i * size, size)
        if (!total) total = page.total
        chunks.push(page.items)
        const got = (i + 1) * size
        if (page.items.length < size || (total && got >= total)) break
      }
      const items = chunks.flat()
      return { id, items, total: total || items.length }
    }),
  )

  const covers: Record<string, string> = {}
  const titles: Record<string, string> = {}
  details.forEach((d) => {
    if (!d) return
    covers[d.id] = d.cover
    titles[d.id] = d.title
  })

  const seen = new Set<string>()
  const episodes: Episode[] = []
  const seasons: SeasonInfo[] = []
  let total = 0

  pages.forEach((p) => {
    const count = p.total || p.items.length
    total += count
    const info = { id: p.id, title: titles[p.id] ?? '', count, cover: covers[p.id] ?? '', rest: Math.max(0, count - 1) }
    seasons.push(info)
    p.items.forEach((r) => {
      if (seen.has(r.id)) return
      seen.add(r.id)
      episodes.push({ radio: r, vol: volOf(r.title), season: info.title })
    })
  })

  // 期号大的在前；没有期号的先排在最后，稍后用锚点插回去
  episodes.sort((a, b) => {
    const av = a.vol ?? -1
    const bv = b.vol ?? -1
    if (av !== bv) return bv - av
    return (b.radio.publishedAt || 0) - (a.radio.publishedAt || 0)
  })

  // 番外没有期号：取「发布时间不晚于它的最近一期」的期号当锚点，排在那一期后面
  const byDate = [...episodes].sort((a, b) => (b.radio.publishedAt || 0) - (a.radio.publishedAt || 0))
  const anchor = new Map<string, number>()
  let prevVol = Number.POSITIVE_INFINITY
  for (const e of byDate) {
    if (e.vol !== null) prevVol = e.vol
    anchor.set(e.radio.id, prevVol)
  }
  const rank = (e: Episode) => (e.vol ?? anchor.get(e.radio.id) ?? 0) - (e.vol === null ? 0.5 : 0)
  episodes.sort((a, b) => {
    const diff = rank(b) - rank(a)
    if (diff !== 0) return diff
    return (b.radio.publishedAt || 0) - (a.radio.publishedAt || 0)
  })

  return {
    seasons,
    episodes,
    total,
    cover: series.seasonIds.map((id) => covers[id]).find(Boolean) ?? '',
    latest: episodes[0] ?? null,
    rest: Math.max(0, total - 1),
  }
}