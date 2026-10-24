import { useLayoutEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePage } from '@inertiajs/react'

import { dashboardKey } from '@/lib/queryKeys'
import type { DashboardProps } from '@/types'

export interface DashboardView {
  contacts: DashboardProps['contacts']
  selected: DashboardProps['selected']
  summary: DashboardProps['summary']
  filters: DashboardProps['filters']
  statusChoices: DashboardProps['statusChoices']
}

export interface DashboardCacheEntry {
  view: DashboardView
  /** The page payload that produced this entry; compared by reference. */
  source: DashboardProps
}

/** Builds the cache entry for a page payload; also used to seed test caches. */
export function createDashboardCacheEntry(props: DashboardProps): DashboardCacheEntry {
  return {
    view: {
      contacts: props.contacts,
      selected: props.selected,
      summary: props.summary,
      filters: props.filters,
      statusChoices: props.statusChoices,
    },
    source: props,
  }
}

/**
 * Reads the dashboard from the query cache, seeded from the payload Inertia
 * just delivered.
 *
 * The cache is a mirror, not a fetcher: the query function only replays the
 * current payload, so no request is made. A changed payload for an already
 * cached view is written in a layout effect (before paint); comparing the
 * stored `source` by reference keeps repeat calls idempotent.
 *
 * Structural sharing is off because it would hand back the previous entry
 * object when two payloads are deeply equal, which defeats that reference
 * comparison and makes the sync loop.
 */
export function useDashboardView(): DashboardView {
  // `DashboardProps` has no index signature, which `usePage`'s generic requires.
  const props = usePage<DashboardProps & Record<string, unknown>>().props
  const queryClient = useQueryClient()
  const queryKey = dashboardKey(props.filters, props.selected?.id ?? null)

  const { data } = useQuery<DashboardCacheEntry>({
    queryKey,
    queryFn: () => createDashboardCacheEntry(props),
    initialData: () => createDashboardCacheEntry(props),
    staleTime: Infinity,
    structuralSharing: false,
  })

  useLayoutEffect(() => {
    const cached = queryClient.getQueryData<DashboardCacheEntry>(queryKey)
    if (cached?.source !== props) {
      queryClient.setQueryData(queryKey, createDashboardCacheEntry(props))
    }
  }, [props, queryClient, queryKey])

  return data!.view
}
