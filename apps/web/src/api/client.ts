const BASE = '/gapi/v1'

export class ApiError extends Error {
  status: number
  title: string
  detail?: string
  constructor(status: number, title: string, detail?: string) {
    super(title)
    this.status = status
    this.title = title
    this.detail = detail
  }
}

export interface JsonApiResource<A = Record<string, unknown>> {
  id: string
  type: string
  attributes: A
  relationships?: Record<string, { data: { id: string; type: string } | { id: string; type: string }[] | null }>
}

export interface JsonApiDoc<A = Record<string, unknown>> {
  data: JsonApiResource<A> | JsonApiResource<A>[]
  included?: JsonApiResource[]
  meta?: { 'record-count'?: number }
  links?: Record<string, string>
}

export type Query = Record<string, string | number | boolean | undefined>

/** JSON:API 参数序列化：{ 'page[limit]': 20 } → page%5Blimit%5D=20 */
export function buildQuery(params: Query): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

let tokenGetter: () => string | null = () => null
let onUnauthorized: () => void = () => {}

export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn
}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

export async function request<T = JsonApiDoc>(
  path: string,
  init: RequestInit & { params?: Query; anonymous?: boolean } = {},
): Promise<T> {
  const { params, anonymous, ...rest } = init
  const headers: Record<string, string> = {
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    ...((rest.headers as Record<string, string>) ?? {}),
  }
  const token = anonymous ? null : tokenGetter()
  if (token) headers.Authorization = `Token token=${token}`

  const res = await fetch(BASE + path + buildQuery(params ?? {}), { ...rest, headers })

  if (res.status === 401) onUnauthorized()
  if (!res.ok) {
    let title = `请求失败（${res.status}）`
    let detail: string | undefined
    try {
      const body = await res.json()
      const err = body?.errors?.[0]
      if (err) {
        title = err.title ?? title
        detail = err.detail
      }
    } catch {
      /* 非 JSON 响应 */
    }
    throw new ApiError(res.status, title, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** body 一律包成 { data: ... } 再发 */
export function requestWithBody<T = unknown>(path: string, method: string, data: unknown, extra?: RequestInit) {
  return request<T>(path, { method, body: JSON.stringify({ data }), ...extra })
}

export const API_BASE = BASE