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

/** 评论正文/昵称里夹带的零宽字符和连续空白，一起清掉 */
export function cleanText(s: string | null | undefined): string {
  if (!s) return ''
  return (
    s
      .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '')
      // 只压「连续两个以上」的空白。别写成 \s+ → ' '：那会把单个换行也换成空格，
      // 先碰到 "原来" 这种字会被拆成 "原 来"。单个换行交给渲染端处理。
      .replace(/[ \t\u3000]{2,}/g, ' ')
      .replace(/([ \t\u3000]*)\n+([ \t\u3000]*)/g, '\n')
      .trim()
  )
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