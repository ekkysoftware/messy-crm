import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import { dashboardKey } from '@/lib/queryKeys'
import { useDashboardView } from '@/queries/useDashboardView'
import type { DashboardProps } from '@/types'
import { contactDetail, dashboardProps } from '../fixtures'
import { usePage } from '../mocks/inertia'
import { createTestQueryClient, QueryProvider, seedDashboardView } from '../render'

const fetchSpy = vi.fn()

function showPage(props: DashboardProps) {
  usePage.mockReturnValue({ props, flash: { messages: [] } })
}

function renderDashboardView(client = createTestQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryProvider client={client}>{children}</QueryProvider>
  )

  return { client, ...renderHook(() => useDashboardView(), { wrapper }) }
}

describe('useDashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('seeds the cache from the page payload on first mount', () => {
    showPage(dashboardProps)

    const { result, client } = renderDashboardView()

    expect(result.current.contacts).toEqual(dashboardProps.contacts)
    expect(result.current.selected).toEqual(dashboardProps.selected)
    expect(result.current.summary).toEqual(dashboardProps.summary)
    expect(result.current.filters).toEqual(dashboardProps.filters)
    expect(result.current.statusChoices).toEqual(dashboardProps.statusChoices)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(
      client.getQueryState(dashboardKey(dashboardProps.filters, contactDetail.id))?.fetchStatus,
    ).toBe('idle')
  })

  it('reads a seeded view from the cache without a request', () => {
    showPage(dashboardProps)
    const client = createTestQueryClient()
    seedDashboardView(client, dashboardProps)

    const { result } = renderDashboardView(client)

    expect(result.current.summary).toEqual(dashboardProps.summary)
    expect(result.current.statusChoices).toEqual(dashboardProps.statusChoices)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(client.getQueryCache().getAll()).toHaveLength(1)
  })

  it('updates a cached view when the same key receives a new payload', () => {
    showPage(dashboardProps)

    const { result, rerender, client } = renderDashboardView()

    const updated: DashboardProps = {
      ...dashboardProps,
      summary: { total: 2, pipeline: 2000, statusCounts: { lead: 2 } },
      selected: {
        ...contactDetail,
        activities: [
          {
            kind: 'note',
            body: 'Called customer',
            createdBy: 'Interview User',
            createdAt: '23 Oct 2026 11:00',
          },
          ...contactDetail.activities,
        ],
      },
    }
    showPage(updated)
    rerender()

    expect(result.current.summary.total).toBe(2)
    expect(result.current.selected?.activities[0].body).toBe('Called customer')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(client.getQueryCache().getAll()).toHaveLength(1)
  })

  it('keeps a separate entry when the view key changes', () => {
    showPage(dashboardProps)

    const { result, rerender, client } = renderDashboardView()

    const filtered: DashboardProps = {
      ...dashboardProps,
      contacts: [],
      selected: null,
      filters: { q: 'missing', status: 'lead' },
      summary: { total: 0, pipeline: 0, statusCounts: { lead: 0 } },
    }
    showPage(filtered)
    rerender()

    expect(result.current.contacts).toEqual([])
    expect(result.current.selected).toBeNull()
    expect(result.current.filters).toEqual({ q: 'missing', status: 'lead' })
    expect(result.current.summary.total).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(client.getQueryCache().getAll()).toHaveLength(2)
  })
})
