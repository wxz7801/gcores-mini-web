import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { fetchRadios, type RadioPage } from '../api/gcores'

const PAGE = 20

export function useRadioFeed(opts: { categoryId?: string; userId?: string; isFm?: boolean; enabled?: boolean }) {
  const { categoryId, userId, isFm, enabled = true } = opts
  return useInfiniteQuery<RadioPage>({
    queryKey: ['radios', { categoryId, userId, isFm }],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchRadios({
        offset: pageParam as number,
        limit: PAGE,
        categoryId,
        userId,
        isFm,
      }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      if (last.items.length < PAGE) return undefined
      if (last.total && loaded >= last.total) return undefined
      return loaded
    },
  })
}

export function useGpassRadios(categoryId?: string, limit = 10) {
  return useQuery({
    queryKey: ['radios', 'gpass', categoryId],
    queryFn: () => fetchRadios({ limit, categoryId }),
    staleTime: 5 * 60 * 1000,
  })
}