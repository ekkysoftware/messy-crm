import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import Dashboard from '@/pages/crm/Dashboard'
import type { DashboardProps } from '@/types'
import { contactDetail, contactRow, dashboardProps } from '../fixtures'
import { usePage } from '../mocks/inertia'
import { createTestQueryClient, renderWithQueryClient } from '../render'

const secondContact: DashboardProps = {
  ...dashboardProps,
  contacts: [
    {
      ...contactRow,
      id: 2,
      name: 'Second Person',
      email: 'second@example.com',
      company: 'Second Co',
      selected: true,
      url: '/?contact=2',
    },
  ],
  selected: {
    ...contactDetail,
    id: 2,
    name: 'Second Person',
    email: 'second@example.com',
    company: 'Second Co',
  },
}

function showPage(props: DashboardProps) {
  usePage.mockReturnValue({ props, flash: { messages: [] } })
}

describe('Dashboard cache lifetime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    showPage(dashboardProps)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not write cached data to browser storage', () => {
    // localStorage and sessionStorage share Storage.prototype; spying on an
    // instance would make jsdom store the spy itself as an item.
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    renderWithQueryClient(<Dashboard />)

    expect(screen.getAllByText('Ekky Example').length).toBeGreaterThan(0)
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('starts a fresh client empty and renders only its own payload', () => {
    const first = renderWithQueryClient(<Dashboard />)
    expect(screen.getAllByText('Ekky Example').length).toBeGreaterThan(0)
    expect(first.client.getQueryCache().getAll()).toHaveLength(1)
    first.unmount()

    showPage(secondContact)
    renderWithQueryClient(<Dashboard />, { client: createTestQueryClient() })

    expect(screen.getAllByText('Second Person').length).toBeGreaterThan(0)
    expect(screen.queryByText('Ekky Example')).not.toBeInTheDocument()
    expect(screen.queryByText('Altogether')).not.toBeInTheDocument()
  })
})
