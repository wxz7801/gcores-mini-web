import { request, requestWithBody, type JsonApiDoc, type JsonApiResource, type Query } from './client'
import { getAuth } from './auth'
import { cleanText } from '../lib/format'

// ---------- 类型：只列出我们会用到的字段 ----------

export interface RadioAttrs {
  title: string
  desc: string | null
  summary: string | null
  duration: number
  cover: string
  thumb: string
  'published-at': number
  'likes-count': number
  'comments-count': number
  plays: number
  'is-free': boolean
  'is-require-privilege': boolean
  'is-fm'?: boolean
  'media-type'?: string | null
  content?: unknown
}

export interface MediaAttrs {
  'media-type': 'audio' | 'protected_audio' | string
  audio?: string | null
  'radio-uuid'?: string | null
}

export interface TimelineAttrs {
  at: number
  title: string
  content: string | null
  quote?: string | null
  asset?: string | null
}

export interface CategoryAttrs {
  name: string
  'bg-color'?: string
  'text-color'?: string
  logo?: string | null
  background?: string | null
  'display-order'?: number
  /** original = 站内原创栏目；imported = 入驻播客（RSS 导入） */
  scope?: string
}

export interface DjAttrs {
  nickname: string
  thumb?: string | null
}

export interface AlbumAttrs {
  title: string
  desc?: string | null
  cover: string
  'display-type': 'audiobook' | 'album' | string
  'is-free': boolean
  'is-require-privilege': boolean
  credit: number
  'chapters-count'?: number
  'radios-count'?: number
  'published-at'?: number
  'owner-type'?: string
  'subscriptions-count'?: number
  description?: string
  author?: string | null
  background?: string | null
}

// ---------- 播客列表 ----------

export interface RadioListItem {
  id: string
  title: string
  desc: string
  cover: string
  thumb: string
  duration: number
  publishedAt: number
  likes: number
  comments: number
  plays: number
  isFree: boolean
  isRequirePrivilege: boolean
  /** audio=直链 mp3/m4a；hls=机核 FM 的 m3u8 分片流 */
  playbackType: 'file' | 'hls'
  /** 媒体是受保护的（录音笔 / GPASS 节目）：必须走收听会话，直链 404 */
  isProtectedAudio: boolean
  isFm: boolean
  /** 入驻播客（RSS 导入的第三方播客），对应栏目「入驻播客」 */
  isImported: boolean
  /** 时间轴挂在 media 上，需要这个 id 才能取 */
  mediaId: string | null
  /** media.audio 原值：免费节目直接用它播，不必再拉一次详情 */
  audioFile: string | null
  categories: { id: string; name: string }[]
  djs: { id: string; nickname: string; avatar: string | null }[]
}

function toRadioItem(r: JsonApiResource<RadioAttrs>, included: JsonApiResource[]): RadioListItem {
  const rel = r.relationships ?? {}
  // 注意：category 是单个对象关系，djs 是数组关系，两者形状不同
  const catRef = rel.category?.data as { id: string } | { id: string }[] | null | undefined
  const catIds = (Array.isArray(catRef) ? catRef : catRef ? [catRef] : []).map((x) => x.id)
  const djRef = rel.djs?.data as { id: string } | { id: string }[] | null | undefined
  const djIds = (Array.isArray(djRef) ? djRef : djRef ? [djRef] : []).map((x) => x.id)
  const lookup = new Map(included.map((x) => [`${x.type}:${x.id}`, x]))
  const mediaRef = rel.media?.data as { id: string } | { id: string }[] | null | undefined
  const mediaId = Array.isArray(mediaRef) ? mediaRef[0]?.id : mediaRef?.id
  return {
    id: r.id,
    title: r.attributes.title,
    desc: r.attributes.desc ?? r.attributes.summary ?? '',
    cover: r.attributes.cover,
    thumb: r.attributes.thumb,
    duration: r.attributes.duration,
    publishedAt: r.attributes['published-at'],
    likes: r.attributes['likes-count'] ?? 0,
    comments: r.attributes['comments-count'] ?? 0,
    plays: r.attributes.plays ?? 0,
    isFree: r.attributes['is-free'],
    isRequirePrivilege: r.attributes['is-require-privilege'],
    playbackType: r.attributes['is-fm'] ? 'hls' : 'file',
    isProtectedAudio: (lookup.get(`medias:${mediaId}`)?.attributes as MediaAttrs | undefined)?.['media-type'] === 'protected_audio',
    isFm: Boolean(r.attributes['is-fm']),
    isImported: catIds.some((id) => (lookup.get(`categories:${id}`)?.attributes.name as string) === '入驻播客'),
    mediaId: mediaId ?? null,
    audioFile: (lookup.get(`medias:${mediaId}`)?.attributes as MediaAttrs | undefined)?.audio ?? null,
    categories: catIds.map((id) => {
      const c = lookup.get(`categories:${id}`)
      return { id, name: (c?.attributes.name as string) ?? '' }
    }),
    djs: djIds.map((id) => {
      const u = lookup.get(`users:${id}`)
      return {
        id,
        nickname: (u?.attributes.nickname as string) ?? '',
        avatar: (u?.attributes.thumb as string) ?? null,
      }
    }),
  }
}

export interface RadioPage {
  items: RadioListItem[]
  total: number
}

export async function fetchRadios(opts: {
  offset?: number
  limit?: number
  categoryId?: string
  userId?: string
  isFm?: boolean
  sort?: string
}): Promise<RadioPage> {
  const params: Query = {
    'page[limit]': opts.limit ?? 20,
    'page[offset]': opts.offset ?? 0,
    sort: opts.sort ?? '-published-at',
    // 需要 media：一是免费音频的文件名，二是时间轴要按 media id 去取
    include: 'category,djs,media',
  }
  if (opts.categoryId) {
    const doc = await request<JsonApiDoc<RadioAttrs>>(`/categories/${opts.categoryId}/radios`, { params })
    const included = doc.included ?? []
    const arr = Array.isArray(doc.data) ? doc.data : [doc.data]
    return { items: arr.map((r) => toRadioItem(r, included)), total: doc.meta?.['record-count'] ?? 0 }
  }
  if (opts.userId) {
    const doc = await request<JsonApiDoc<RadioAttrs>>(`/users/${opts.userId}/radios`, { params })
    const included = doc.included ?? []
    const arr = Array.isArray(doc.data) ? doc.data : [doc.data]
    return { items: arr.map((r) => toRadioItem(r, included)), total: doc.meta?.['record-count'] ?? 0 }
  }
  if (opts.isFm) params['filter[is-fm]'] = 1
  const doc = await request<JsonApiDoc<RadioAttrs>>('/radios', { params })
  const included = doc.included ?? []
  const arr = Array.isArray(doc.data) ? doc.data : [doc.data]
  return { items: arr.map((r) => toRadioItem(r, included)), total: doc.meta?.['record-count'] ?? 0 }
}

// ---------- 节目详情 + 时间轴 ----------

export interface RadioDetail {
  id: string
  title: string
  desc: string
  cover: string
  duration: number
  publishedAt: number
  likes: number
  comments: number
  plays: number
  isFree: boolean
  isRequirePrivilege: boolean
  /** 媒体是受保护的（录音笔 / GPASS 节目）：必须走收听会话，直链 404 */
  isProtectedAudio: boolean
  mediaType: string
  isFm: boolean
  mediaId: string | null
  audioFile: string | null
  categories: { id: string; name: string }[]
  djs: { id: string; nickname: string; avatar: string | null }[]
  timelines: Timeline[]
}

export interface Timeline {
  id: string
  at: number
  title: string
  content: string | null
  asset: string | null
  quote: string | null
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = s
  // cleanText：去掉零宽字符、把连续空白（含全角空格）压成一个。
  // 内联元素之间原本没有换行，压掉之后不该出现「原 来」这种断层。
  return cleanText(tmp.textContent)
}

export async function fetchRadioDetail(id: string): Promise<RadioDetail> {
  const doc = await request<JsonApiDoc<RadioAttrs>>(`/radios/${id}`, {
    params: { include: 'media.timelines,category,djs' },
  })
  const r = Array.isArray(doc.data) ? doc.data[0] : doc.data
  const included = doc.included ?? []
  const rel = r.relationships ?? {}
  const lookup = new Map(included.map((x) => [`${x.type}:${x.id}`, x]))

  // 注意：category 是单个对象关系，djs 是数组关系，两者形状不同
  const catRef = rel.category?.data as { id: string } | { id: string }[] | null | undefined
  const catIds = (Array.isArray(catRef) ? catRef : catRef ? [catRef] : []).map((x) => x.id)
  const djRef = rel.djs?.data as { id: string } | { id: string }[] | null | undefined
  const djIds = (Array.isArray(djRef) ? djRef : djRef ? [djRef] : []).map((x) => x.id)

  const mediaIds = (rel.media?.data as { id: string } | { id: string }[] | undefined) ?? []
  const mediaId = Array.isArray(mediaIds) ? mediaIds[0]?.id : mediaIds?.id
  // 坑：media 资源在 included 里的 type 是复数 "medias"，不是关系名 "media"。
  // 查错了 key 会永远查不到 → mediaType 退回 'audio' → 把 protected_audio
  // 当成免费直链去拼 alioss（而录音笔这类会员音频并不在 alioss），播放必挂。
  const media = mediaId ? (lookup.get(`medias:${mediaId}`) ?? lookup.get(`media:${mediaId}`)) : undefined
  const mediaType = ((media?.attributes as MediaAttrs | undefined)?.['media-type'] as string) ?? 'audio'

  const timelines: Timeline[] = included
    .filter((x) => x.type === 'timelines')
    .map((x) => {
      const a = x.attributes as unknown as TimelineAttrs
      return {
        id: x.id,
        at: a.at,
        title: a.title,
        content: a.content,
        asset: a.asset ?? null,
        quote: a.quote ?? null,
      }
    })
    .sort((a, b) => a.at - b.at)

  return {
    id: r.id,
    mediaId: mediaId ?? null,
    audioFile: (media?.attributes as MediaAttrs | undefined)?.audio ?? null,
    title: r.attributes.title,
    desc: stripHtml(r.attributes.desc) || stripHtml(r.attributes.summary),
    cover: r.attributes.cover,
    duration: r.attributes.duration,
    publishedAt: r.attributes['published-at'],
    likes: r.attributes['likes-count'] ?? 0,
    comments: r.attributes['comments-count'] ?? 0,
    plays: r.attributes.plays ?? 0,
    isFree: r.attributes['is-free'],
    isRequirePrivilege: r.attributes['is-require-privilege'],
    // 录音笔这类节目本体是「限免」（is-free=true），但媒体仍是 protected_audio，
    // 直链 404。所以不能拿 is-free 当「能不能直连播」用，必须看媒体的 media-type。
    isProtectedAudio: mediaType === 'protected_audio',
    mediaType,
    isFm: Boolean(r.attributes['is-fm']),
    categories: catIds.map((id) => {
      const c = lookup.get(`categories:${id}`)
      return { id, name: (c?.attributes.name as string) ?? '' }
    }),
    djs: djIds.map((id) => {
      const u = lookup.get(`users:${id}`)
      return {
        id,
        nickname: (u?.attributes.nickname as string) ?? '',
        avatar: (u?.attributes.thumb as string) ?? null,
      }
    }),
    timelines,
  }
}

// ---------- 栏目 ----------

export async function fetchCategories() {
  const doc = await request<JsonApiDoc<CategoryAttrs>>('/categories', {
    params: { 'filter[scope]': 'original', 'page[limit]': 100 },
  })
  const arr = Array.isArray(doc.data) ? doc.data : [doc.data]
  return arr
    .map((c) => ({
      id: c.id,
      name: c.attributes.name,
      logo: c.attributes.logo ?? null,
      background: c.attributes.background ?? null,
      scope: (c.attributes as CategoryAttrs & { scope?: string }).scope ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
    .map(({ id, name, logo, background, scope }) => ({ id, name, logo, background, scope }))
}

// ---------- 播单 / 有声书 ----------

export interface AlbumItem {
  id: string
  title: string
  cover: string
  displayType: string
  isFree: boolean
  isRequirePrivilege: boolean
  credit: number
  count: number
  /** 内容形态：这里的 record-count 恒为章节数，只有 audiobook 才是「章」 */
  kind: AlbumKind
  itemsLabel: string
}

/**
 * 机核的 albums 集合混装了两类东西：
 * - display-type=audiobook   有声书（章节 = 章）
 * - 其余（album / 空）        DJ 与玩家整理的节目合集（节目 = 期）
 * 同一个 id 从哪个入口点进来都要落到同一个详情页，所以按它分流，而不是按入口。
 */
export type AlbumKind = 'audiobook' | 'playlist'

export async function fetchAlbums(displayType: 'audiobook' | 'album', offset = 0, limit = 12) {
  const doc = await request<JsonApiDoc<AlbumAttrs>>('/albums', {
    params: { 'filter[display-type]': displayType, 'page[limit]': limit, 'page[offset]': offset },
  })
  const arr = Array.isArray(doc.data) ? doc.data : [doc.data]
  const items: AlbumItem[] = arr.map((a) => {
    const kind: AlbumKind = a.attributes['display-type'] === 'audiobook' ? 'audiobook' : 'playlist'
    return {
      id: a.id,
      title: a.attributes.title,
      cover: a.attributes.cover,
      displayType: a.attributes['display-type'],
      isFree: a.attributes['is-free'],
      isRequirePrivilege: a.attributes['is-require-privilege'],
      credit: a.attributes.credit,
      count: a.attributes['chapters-count'] ?? a.attributes['radios-count'] ?? 0,
      kind,
      itemsLabel: kind === 'audiobook' ? '章' : '期',
    }
  })
  return { items, total: doc.meta?.['record-count'] ?? 0 }
}

export async function fetchAlbumRadios(albumId: string, offset = 0, limit = 20) {
  // 服务端把这个路由的返回条数硬限制在 100：page[limit]=250 直接 400，
  // 需要更多时用 offset 100/200/… 继续翻（超过总数的 offset 返回空数组）。
  const size = Math.min(limit, 100)
  const doc = await request<JsonApiDoc<RadioAttrs>>(`/albums/${albumId}/published-radios`, {
    params: { 'page[limit]': size, 'page[offset]': offset, include: 'category,djs' },
  })
  const included = doc.included ?? []
  const arr = Array.isArray(doc.data) ? doc.data : [doc.data]
  return { items: arr.map((r) => toRadioItem(r, included)), total: doc.meta?.['record-count'] ?? 0 }
}

// ---------- 时间轴（按 media id 批量取） ----------

/**
 * 时间轴的唯一可靠来源是「详情」接口的复合文档：
 *   GET /radios/{id}?include=media.timelines
 * 注意两个坑：
 * 1. `/medias/{mediaId}/timelines` 是 404 —— 没有这个路由；
 * 2. 列表接口 `?include=media.timelines` 会返回几百条 timelines，但它们的
 *    relationships.media 都是空对象 `{}`，无法判断属于哪一期，所以不能靠列表预取。
 */
export async function fetchRadioTimelines(radioId: string): Promise<Timeline[]> {
  const doc = await request<JsonApiDoc<RadioAttrs>>(`/radios/${radioId}`, {
    params: { include: 'media.timelines' },
  })
  const included = doc.included ?? []
  const single = Array.isArray(doc.data) ? doc.data[0] : doc.data
  const mediaId = (single?.relationships?.['media'] as { data?: { id: string } } | undefined)?.data?.id
  const arr = included.filter((x) => x.type === 'timelines')
  const owned = mediaId
    ? arr.filter((x) => {
        const rel = (x.relationships?.['media'] as { data?: { id: string } } | undefined)?.data
        return !rel || rel.id === mediaId
      })
    : arr
  return owned
    .map((x) => {
      const a = x.attributes as unknown as TimelineAttrs & { 'quote-href'?: string }
      return {
        id: x.id,
        at: a.at ?? 0,
        title: a.title ?? '',
        content: a.content ?? null,
        asset: a.asset ?? null,
        quote: a['quote-href'] || a.quote || null,
      }
    })
    .sort((a, b) => a.at - b.at)
}

// ---------- 收听会话（付费音频） ----------

export interface ListeningSession {
  url: string
  tracked: boolean
  sessionId?: string
  heartbeatInterval: number
}

export async function startListeningSession(radioId: string, deviceId: string): Promise<ListeningSession> {
  const res = await requestWithBody<{
    url: string
    tracked?: boolean
    'session-id'?: string
    'heartbeat-interval'?: number
  }>(`/medias/protected/radios/${radioId}/listening-session`, 'POST', { 'device-id': deviceId })
  if (!res?.url) throw new Error('收听会话没有返回音频地址')
  return {
    url: res.url,
    tracked: Boolean(res.tracked),
    sessionId: res['session-id'],
    heartbeatInterval: Math.min(Math.max(res['heartbeat-interval'] ?? 60, 10), 600),
  }
}

export function heartbeatListeningSession(sessionId: string) {
  return requestWithBody<{ tracked: boolean }>('/medias/listening-session', 'PATCH', { 'session-id': sessionId })
}

export function releaseListeningSession(sessionId: string) {
  return requestWithBody('/medias/listening-session', 'DELETE', { 'session-id': sessionId })
}

/** 免费节目：直接拼 alioss 地址 */
export function freeAudioUrl(mediaAudio: string): string {
  // 入驻播客（RSS 导入）的 audio 是完整外链，机核自制的只有文件名
  if (/^https?:\/\//i.test(mediaAudio)) return mediaAudio
  return `https://alioss.gcores.com/uploads/audio/${mediaAudio}`
}

// ---------- 搜索 ----------

export async function searchRadios(query: string, offset = 0, limit = 20) {
  const doc = await request<JsonApiDoc<RadioAttrs>>('/search', {
    params: { query, type: 'radios', 'page[limit]': limit, 'page[offset]': offset, include: 'category,djs' },
  })
  const included = doc.included ?? []
  const arr = Array.isArray(doc.data) ? doc.data : [doc.data]
  return { items: arr.map((r) => toRadioItem(r, included)), total: doc.meta?.['record-count'] ?? 0 }
}
// ---------- 评论 ----------

export interface CommentUser {
  id: string
  nickname: string
  avatar: string | null
}

export interface CommentItem {
  id: string
  content: string
  createdAt: number
  likes: number
  /** 评论里带的时间点（radio-timestamp，秒），点到第几分钟就有的那种 */
  at: number | null
  user: CommentUser
  /** 楼层数：直接回复记 1，回复的回复记 2。缩进只在 1/2 层之间区分，更深的仍按 2 层排 */
  depth: number
  /** 楼主标记（机核官方的 liked-by-author） */
  fromAuthor: boolean
  /** 这一层下面还有几条（含间接），和实际拉到的不一定相等 */
  replyCount: number
  /**
   * 这条回复在回复谁（「A 回复 B」里的 B）。直接在顶层评论下说话时为 null。
   * 注意：拿不到时不要瞎猜，宁可留空。
   */
  replyToName: string | null
  /** replyToName 是猜出来的（服务端没给 parent），UI 上要标「可能」之类的字样 */
  replyToGuess: boolean
  replies: CommentItem[]
}

interface CommentAttrs {
  /** 正文，纯文本；机核里偶尔会带 HTML 实体，统一用 stripHtml 过一遍 */
  body?: string | null
  'created-at'?: string
  'likes-count'?: number
  'descendants-count'?: number
  'radio-timestamp'?: number | null
  'liked-by-author'?: boolean
  depth?: number
}

export interface CommentsPage {
  items: CommentItem[]
  /** 总条数（含回复），来自 meta.record-count */
  total: number
}

/** 拿不到昵称时的占位。别写成裸字符串，不然会被当成真的「B」用在「回复 X」里 */
const UNKNOWN_USER = '机核用户'

/** 机核评论接口的分页上限，写死了 page[size] 超过 100 就 400 */
const COMMENT_MAX_LIMIT = 100

/**
 * 拉节目评论。
 *
 * 坑（这几个都会静默把评论变成空列表，改之前先看一眼）：
 * 1. `include=replies` 会 400："replies is not a valid relationship of comments"。
 *    有效的子评论关系叫 **descendants**（还有 children / oldest-descendants）。
 * 2. 正文在 attributes.**body** 里，不是 content。
 * 3. created-at 是 ISO 字符串，不是时间戳，要 Date.parse。
 * 4. 顶层评论的 data 里没有 parent，但所有资源的关系对象都是 `{}`，
 *    所以只能靠 attributes.depth === 0 区分顶层，不能用 parent / children 判断。
 * 5. **必须写 `descendants.user`，光写 `user` 不够。**
 *    服务端对 included 里的子评论不下发 user 关系（返回 `{}`），
 *    只有顺着 descendants 再 include 一层 user，子评论的 user 才会回来。
 *    只写 `user` 时子评论作者全是「机核用户」，而且不报错，很难发现。
 *    同理，`descendants.parent.user` 才能拿到「回复的是谁」。
 */
export async function fetchComments(radioId: string, offset = 0, limit = 20): Promise<CommentsPage> {
  const doc = await request<JsonApiDoc<CommentAttrs>>(`/radios/${radioId}/comments`, {
    params: {
      'page[limit]': Math.min(limit, COMMENT_MAX_LIMIT),
      'page[offset]': offset,
      // 顺序别动：
      //   user                      顶层评论的作者
      //   descendants.user          回复的作者
      //   descendants.parent.user   回复的父评论及其作者（「A 回复 B」里的 B）
      //   descendants.root.user     根评论作者（兜底：parent 拿不到时用）
      include: 'user,descendants.user,descendants.parent.user,descendants.root.user',
    },
  })
  const arr = Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : []
  const lookup = new Map((doc.included ?? []).map((x) => [`${x.type}:${x.id}`, x]))

  const userOf = (res: JsonApiResource<CommentAttrs> | undefined): CommentUser => {
    const uid = (res?.relationships?.user?.data as { id: string } | undefined)?.id
    const u = uid ? lookup.get(`users:${uid}`) : undefined
    return {
      id: uid ?? '',
      nickname: cleanText(u?.attributes.nickname as string) || UNKNOWN_USER,
      avatar: (u?.attributes.thumb as string) ?? null,
    }
  }

  // 子评论按 id 去重后挂到父评论下
  const byId = new Map<string, JsonApiResource<CommentAttrs>>()
  for (const top of arr) {
    for (const ref of (top.relationships?.descendants?.data as { id: string }[] | undefined) ?? []) {
      const res = lookup.get(`comments:${ref.id}`)
      if (res) byId.set(res.id, res as JsonApiResource<CommentAttrs>)
    }
  }

  const toReply = (res: JsonApiResource<CommentAttrs>, topId: string): CommentItem => {
    // 「A 回复 B」的 B 怎么来（机核这个接口的关系给得不稳，按可用程度退）：
    //   1. parent 关系 -> 父评论的作者。注意只有真正回复了某条子评论时服务端才给，
    //      直接回复楼层时 parent 常常是空的（见下）
    //   2. root 关系 -> 根评论作者。只在 parent 指向的仍然是楼层本身时才有意义
    //   3. 兜底：depth >= 2 说明一定是在回复某条回复，而 descendant 是平铺的、
    //      没有树形结构可推，只能退成「上一条」。这是本次拿到的最接近的猜测，
    //      所以只有在 1、2 都拿不到时才用
    const top = arr.find((t) => t.id === topId)
    const topAuthor = userOf(top).nickname
    const parentId = (res.relationships?.parent?.data as { id: string } | undefined)?.id
    const parentRes = parentId ? lookup.get(`comments:${parentId}`) : undefined
    const parentName = parentRes ? userOf(parentRes as JsonApiResource<CommentAttrs>).nickname : null
    const rootId = (res.relationships?.root?.data as { id: string } | undefined)?.id
    const rootName = rootId ? userOf(lookup.get(`comments:${rootId}`) as JsonApiResource<CommentAttrs>).nickname : null

    let replyToName: string | null = null
    if (parentName && parentName !== topAuthor) replyToName = parentName
    else if (rootName && rootName !== topAuthor) replyToName = rootName
    // 占位昵称不算「找到了 B」——「回复 机核用户」既没信息量又到处乱窜
    if (replyToName === UNKNOWN_USER) replyToName = null

    return {
      id: res.id,
      content: stripHtml(res.attributes.body),
      createdAt: Date.parse(res.attributes['created-at'] ?? '') || 0,
      likes: res.attributes['likes-count'] ?? 0,
      at: res.attributes['radio-timestamp'] ?? null,
      user: userOf(res),
      depth: res.attributes.depth ?? 1,
      fromAuthor: Boolean(res.attributes['liked-by-author']),
      replyCount: res.attributes['descendants-count'] ?? 0,
      replyToName,
      replyToGuess: false,
      replies: [],
    }
  }

  /** 上一条回复的作者：只用于 depth>=2 但 parent/root 都没给的情况 */
  const prevAuthorOf = (list: JsonApiResource<CommentAttrs>[], i: number): string | null => {
    for (let k = i - 1; k >= 0; k--) {
      const nm = userOf(list[k]).nickname
      if (nm) return nm
    }
    return null
  }

  const items = arr
    .filter((c) => (c.attributes.depth ?? 0) === 0)
    .map<CommentItem>((c) => {
      const childIds = ((c.relationships?.descendants?.data as { id: string }[] | undefined) ?? [])
        .map((ref) => byId.get(ref.id))
        .filter(Boolean) as JsonApiResource<CommentAttrs>[]
      const children = childIds.map((r, i) => {
        const item = toReply(r, c.id)
        // depth>=2 却没有 parent/root 时，只能退成「上一条回复」，并在 UI 上标明是推测
        if (!item.replyToName && (r.attributes.depth ?? 0) >= 2) {
          const prev = prevAuthorOf(childIds, i)
          if (prev) {
            item.replyToName = prev
            item.replyToGuess = true
          }
        }
        return item
      })
      // 父评论 + 直接子评论（depth 1）都已经按时间倒序返回，顺序本身是可信的
      return {
        id: c.id,
        content: stripHtml(c.attributes.body),
        createdAt: Date.parse(c.attributes['created-at'] ?? '') || 0,
        likes: c.attributes['likes-count'] ?? 0,
        at: c.attributes['radio-timestamp'] ?? null,
        user: userOf(c),
        depth: 0,
        fromAuthor: Boolean(c.attributes['liked-by-author']),
        replyCount: c.attributes['descendants-count'] ?? children.length,
        replyToName: null,
        replyToGuess: false,
        replies: children,
      }
    })

  return { items, total: (doc.meta?.['record-count'] as number | undefined) ?? items.length }
}

/** 相似节目（用于详情页「更多节目」）。接口偶发 5xx，所以静默降级为空数组。 */
export async function fetchSimilarRadios(radioId: string, limit = 8): Promise<RadioListItem[]> {
  try {
    const doc = await request<JsonApiDoc<RadioAttrs>>(`/radios/${radioId}/similarities`, {
      params: { 'page[limit]': limit, include: 'category,djs' },
    })
    const included = doc.included ?? []
    const arr = Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : []
    return arr.map((r) => toRadioItem(r, included))
  } catch {
    return []
  }
}

// ---------- 批量获取（用于收听记录 / 收藏的水合） ----------

/**
 * 一次取多个节目：`/radios?filter[id]=1,2,3`（Rails 的 id 数组过滤，逗号分隔）。
 * 注意：返回顺序不保证与传入顺序一致，调用方需要自己按 id 重排。
 */
export async function fetchRadiosByIds(ids: string[]): Promise<RadioListItem[]> {
  if (!ids.length) return []
  const doc = await request<JsonApiDoc<RadioAttrs>>('/radios', {
    params: { 'filter[id]': ids.join(','), 'page[limit]': ids.length, include: 'category,djs' },
  })
  const included = doc.included ?? []
  const arr = Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : []
  return arr.map((r) => toRadioItem(r, included))
}

// ---------- 收听记录 ----------

export interface HistoryEntry {
  radioId: string
  /** 上次听到的位置（秒） */
  progress: number
  /** 最近一次收听时间（毫秒） */
  timestamp: number
}

/**
 * 收听记录。返回的是**非 JSON:API** 的私有结构：
 * `{ "updated-at": <ms>, "playlist": [{ id, type: "radios", progress, timestamp }], "readlist": [...] }`
 * 只有 id 没有标题，需要再用 fetchRadiosByIds 水合。需要登录（未登录 403）。
 */
export async function fetchHistory(): Promise<HistoryEntry[]> {
  const res = await request<{
    'updated-at'?: number
    playlist?: { id: string; type: string; progress?: number; timestamp?: number }[]
  }>('/history')
  const list = res?.playlist ?? []
  return list
    .filter((x) => x.type === 'radios')
    .map((x) => ({
      radioId: String(x.id),
      progress: Number(x.progress ?? 0),
      timestamp: Number(x.timestamp ?? res['updated-at'] ?? 0),
    }))
}

// ---------- 收藏 ----------

export interface BookmarkEntry {
  bookmarkId: string
  /** 被收藏的对象类型（这里只关心 radios） */
  type: string
  targetId: string
  updatedAt: number
}

/**
 * 收藏列表。`include=bookmarkable` 目前不会把被收藏的资源放进 included，
 * 所以只拿到关系 id，需要 fetchRadiosByIds 水合。需要登录。
 */
export async function fetchBookmarks(opts: { offset?: number; limit?: number; radioOnly?: boolean } = {}) {
  const { offset = 0, limit = 30, radioOnly = true } = opts
  const params: Query = {
    'page[limit]': limit,
    'page[offset]': offset,
    include: 'bookmarkable',
  }
  if (radioOnly) params['filter[bookmarkable-type]'] = 'radios'
  const uid = getAuth()?.userId
  if (!uid) throw new Error('请先登录')
  const doc = await request<JsonApiDoc<{ 'updated-at'?: string }>>(`/users/${uid}/bookmarks`, { params })
  const arr = Array.isArray(doc.data) ? doc.data : doc.data ? [doc.data] : []
  const entries: BookmarkEntry[] = arr.map((b) => {
    const target = b.relationships?.bookmarkable?.data as { id: string; type: string } | undefined
    return {
      bookmarkId: b.id,
      type: target?.type ?? '',
      targetId: target?.id ?? '',
      updatedAt: Date.parse(b.attributes['updated-at'] ?? '') || 0,
    }
  })
  return { entries, total: doc.meta?.['record-count'] ?? entries.length }
}

// ---------- 播单详情 ----------

export interface AlbumDetail extends AlbumItem {
  description: string
  author: string | null
  background: string | null
  publishedAt: number
  subscriptions: number
  ownerType: string | null
}

export async function fetchAlbumDetail(albumId: string): Promise<AlbumDetail> {
  // 注意：albums 没有 category 关系，带 include=category 会 400「category is not a valid relationship of albums」
  const doc = await request<JsonApiDoc<AlbumAttrs>>(`/albums/${albumId}`)
  const d = Array.isArray(doc.data) ? doc.data[0] : doc.data
  const a = d.attributes
  const kind: AlbumKind = a['display-type'] === 'audiobook' ? 'audiobook' : 'playlist'
  return {
    id: d.id,
    title: a.title,
    cover: a.cover,
    displayType: a['display-type'],
    isFree: a['is-free'],
    isRequirePrivilege: a['is-require-privilege'],
    credit: a.credit,
    count: a['chapters-count'] ?? a['radios-count'] ?? 0,
    kind,
    itemsLabel: kind === 'audiobook' ? '章' : '期',
    description: stripHtml(a.description ?? a.desc ?? ''),
    author: (a.author as string | undefined) ?? null,
    background: (a.background as string | undefined) ?? null,
    publishedAt: (a['published-at'] as number | undefined) ?? 0,
    subscriptions: a['subscriptions-count'] ?? 0,
    ownerType: (a['owner-type'] as string | undefined) ?? null,
  }
}

/**
 * 新增收藏：POST /bookmarks。
 * 必须同时给出 user 和 bookmarkable 两条 relationship（resource linkage），
 * 只给 bookmarkable 会 422「user-id - 已经被使用」。
 */
export async function createBookmark(radioId: string): Promise<string> {
  const userId = getAuth()?.userId
  if (!userId) throw new Error('请先登录')
  const doc = await requestWithBody<JsonApiDoc<Record<string, never>>>('/bookmarks', 'POST', {
    type: 'bookmarks',
    attributes: {},
    relationships: {
      bookmarkable: { data: { type: 'radios', id: radioId } },
      user: { data: { type: 'users', id: userId } },
    },
  })
  const d = Array.isArray(doc.data) ? doc.data[0] : doc.data
  return d?.id ?? ''
}

/** 取消收藏：DELETE /bookmarks/{bookmarkId}（204）。 */
export async function deleteBookmark(bookmarkId: string): Promise<void> {
  await request(`/bookmarks/${bookmarkId}`, { method: 'DELETE' })
}
