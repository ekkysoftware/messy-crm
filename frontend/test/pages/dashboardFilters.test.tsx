import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import Dashboard from '@/pages/crm/Dashboard'
import type { DashboardFilters, DashboardProps } from '@/types'
import { dashboardProps } from '../fixtures'
import { router, usePage } from '../mocks/inertia'
import { renderWithQueryClient } from '../render'

function showPage(filters: DashboardFilters = { q: '', status: '' }) {
  const props: DashboardProps = { ...dashboardProps, filters }
  usePage.mockReturnValue({ props, flash: { messages: [] } })
}

function searchBox() {
  return screen.getByRole('textbox', { name: 'Search contacts' })
}

function statusFilter() {
  return screen.getByRole('button', { name: /^Status filter: / })
}

describe('Dashboard filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    showPage()
  })

  it('requests the dashboard with the entered search on Enter', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<Dashboard />)

    await user.type(searchBox(), 'alt{Enter}')

    expect(router.get).toHaveBeenCalledWith(
      '/',
      { q: 'alt' },
      expect.objectContaining({ preserveScroll: true, preserveState: true, replace: true }),
    )
  })

  it('applies the status filter immediately, keeping the typed search', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<Dashboard />)

    await user.type(searchBox(), 'alt')
    await user.click(statusFilter())
    await user.click(screen.getByRole('menuitemradio', { name: 'Customer' }))

    expect(router.get).toHaveBeenCalledWith(
      '/',
      { q: 'alt', status: 'customer' },
      expect.objectContaining({ preserveScroll: true, preserveState: true, replace: true }),
    )
  })

  it('clears the status from the All statuses option', async () => {
    showPage({ q: 'alt', status: 'customer' })
    const user = userEvent.setup()
    renderWithQueryClient(<Dashboard />)

    await user.click(statusFilter())
    await user.click(screen.getByRole('menuitemradio', { name: 'All statuses' }))

    expect(router.get).toHaveBeenCalledWith(
      '/',
      { q: 'alt' },
      expect.objectContaining({ preserveScroll: true, preserveState: true, replace: true }),
    )
  })

  it('omits blank filters from the request', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<Dashboard />)

    await user.type(searchBox(), '   {Enter}')

    expect(router.get).toHaveBeenCalledWith('/', {}, expect.anything())
  })

  it('seeds both controls from the applied filters', () => {
    showPage({ q: 'alt', status: 'lead' })

    renderWithQueryClient(<Dashboard />)

    expect(searchBox()).toHaveValue('alt')
    expect(screen.getByRole('button', { name: 'Status filter: Lead' })).toBeInTheDocument()
  })

  it('keeps the export link pointing at the plain CSV endpoint', () => {
    renderWithQueryClient(<Dashboard />)

    expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', '/export/')
  })
})
