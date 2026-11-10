import { useQuery } from '@tanstack/react-query'
import { fetchRadioTimelines } from '../api/gcores'

/**
 * 时间轴跟着节目走：首页舞台、详情页、全屏播放页都用同一个 queryKey，
 * 切页面不会重复请求。数据在播放时后台预取（列表里不预取，原因见 fetchRadioTimelines）。
 */
export function useTimelines(radioId: string | null | undefined) {
  return useQuery({
    queryKey: ['timelines', radioId],
    enabled: Boolean(radioId),
    staleTime: 30 * 60 * 1000, // 时间轴几乎不会变，缓存半小时
    queryFn: () => fetchRadioTimelines(radioId as string),
  })
}

/** 章节时间戳按音频实际时长做一次比例校准 */
export function fitTimelines<T extends { at: number }>(timelines: T[], audioDuration: number) {
  if (!timelines.length || audioDuration <= 0) return timelines
  const last = timelines[timelines.length - 1].at
  if (last <= audioDuration) return timelines
  const k = (audioDuration - 5) / last
  return timelines.map((t) => ({ ...t, at: Math.max(0, Math.round(t.at * k)) }))
}
