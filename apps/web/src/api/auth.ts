import { request, requestWithBody } from './client'

// 登录态只存 localStorage：token + 用户信息。代理层不落盘。

const STORAGE_KEY = 'gcores.auth.v1'

export interface AuthUser {
  id: string
  nickname: string
  thumb: string | null
  hasMembership?: boolean
  isFounderMember?: boolean
}

export interface AuthState {
  token: string
  userId: string
  user?: AuthUser
  savedAt: number
}

let state: AuthState | null = readState()
const listeners = new Set<(s: AuthState | null) => void>()

function readState(): AuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthState
    if (!parsed?.token) return null
    return parsed
  } catch {
    return null
  }
}

function writeState(next: AuthState | null) {
  state = next
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 隐私模式下可能失败，忽略 */
  }
  listeners.forEach((fn) => fn(next))
}

export function getAuth() {
  return state
}
export function getToken() {
  return state?.token ?? null
}
export function subscribeAuth(fn: (s: AuthState | null) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function signOut() {
  writeState(null)
}

/** 登录接口返回 { data: { token, user-id } } */
function saveSession(token: string, userId: string) {
  writeState({ token, userId, savedAt: Date.now() })
  void loadProfile().catch(() => {
    /* 拉资料失败不影响登录态 */
  })
}

export async function loadProfile(): Promise<AuthUser | null> {
  if (!state) return null
  const doc = await request<{ data: { id: string; attributes: Record<string, unknown> } }>(`/users/${state.userId}`)
  const user: AuthUser = {
    id: doc.data.id,
    nickname: (doc.data.attributes.nickname as string) ?? '',
    thumb: (doc.data.attributes.thumb as string) ?? null,
    hasMembership: Boolean(doc.data.attributes['has-membership']),
    isFounderMember: Boolean(doc.data.attributes['is-founder-member']),
  }
  writeState({ ...state, user })
  return user
}

// ---------- 手机号 + 密码 ----------

export async function signInWithPassword(username: string, password: string) {
  const res = await requestWithBody<{ token: string; 'user-id': string }>('/tokens/refresh', 'POST', {
    provider: 'identity',
    username,
    password,
    remember: true,
  })
  if (!res?.token || !res['user-id']) throw new Error('登录响应缺少 token')
  saveSession(res.token, String(res['user-id']))
  return res
}

// ---------- App 扫码 ----------

export type QrStatus = 'created' | 'scanned' | 'confirmed' | 'expired'

export interface QrSession {
  code: string
  expireAt: number
  status: QrStatus
  token?: string
  userId?: string
}

export async function createQrCode(): Promise<QrSession> {
  const res = await request<{ data: { code: string; 'expired-at': number } }>('/security/generate-qr-code', {
    method: 'POST',
    anonymous: true,
  })
  return { code: res.data.code, expireAt: res.data['expired-at'], status: 'created' }
}

/** 未确认时返回 404，视为“还没扫” */
export async function pollQrCode(code: string): Promise<QrSession> {
  try {
    const res = await request<{
      data: { token?: string; 'user-id'?: string; 'is-scanned'?: boolean }
    }>('/security/signin-with-qr-code', {
      method: 'POST',
      body: JSON.stringify({ data: { code } }),
      anonymous: true,
    })
    const d = res.data ?? {}
    if (d.token && d['user-id']) {
      saveSession(d.token, String(d['user-id']))
      return { code, expireAt: 0, status: 'confirmed', token: d.token, userId: String(d['user-id']) }
    }
    return { code, expireAt: 0, status: d['is-scanned'] ? 'scanned' : 'created' }
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 404 || status === 403) return { code, expireAt: 0, status: 'created' }
    throw err
  }
}

/** 扫码登录页地址，二维码里就画这个 */
export function qrContent(code: string) {
  return `https://www.gcores.com/qr/${code}`
}

// ---------- 设备 ID（收听会话需要） ----------

const DEVICE_KEY = 'gcores.device-id.v1'

/**
 * 收听会话要求带一个稳定的设备 UUID。必须是真 UUID，
 * 空串 / 非 UUID 会被服务端以 400 "device-id param is missing" 拒绝。
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing && existing.length >= 32) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}