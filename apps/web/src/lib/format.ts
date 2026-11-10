/** 秒 → 25:10 / 1:05:30 */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00'
  const s = Math.floor(sec % 60)
  const m = Math.floor((sec / 60) % 60)
  const h = Math.floor(sec / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** 相对时间：14 小时前 / 1 天前 / 11.07 */
export function relativeDate(ts: number): string {
  const diff = Date.now() - ts
  const min = diff / 60000
  if (min < 60) return `${Math.max(1, Math.floor(min))} 分钟前`
  const hour = min / 60
  if (hour < 24) return `${Math.floor(hour)} 小时前`
  const day = hour / 24
  if (day < 30) return `${Math.floor(day)} 天前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
}

export function coverUrl(file: string | null | undefined, w: number, h = w): string {
  if (!file) return ''
  if (file.startsWith('http')) return file
  if (file.startsWith('/')) return file
  return `https://image.gcores.com/${file}?x-oss-process=image/resize,limit_1,m_fill,w_${w},h_${h}/quality,q_90`
}

export function cn(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(' ')
}

export function plural(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  return String(n)
}