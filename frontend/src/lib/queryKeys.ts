import type { DashboardFilters } from '@/types'

/** Root key for every cached dashboard view; mutations invalidate this prefix. */
export const dashboardRootKey = ['dashboard'] as const

export type DashboardQueryKey = readonly [
  'dashboard',
  { q: string; status: string; contact: number | null },
]

/**
 * One cache entry per dashboard view. Selection is part of the key so that a
 * response returning "same filters, no selection" cannot collide with the
 * pre-write view that still has a selected contact.
 */
export function dashboardKey(
  filters: DashboardFilters,
  contactId: number | null,
): DashboardQueryKey {
  return [dashboardRootKey[0], { q: filters.q, status: filters.status, contact: contactId }]
}
