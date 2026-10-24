import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import Toolbar from '@/components/Toolbar'
import type { DashboardFilters } from '@/types'
import { dashboardProps } from '../fixtures'
import { router, usePage } from '../mocks/inertia'
import { renderWithQueryClient } from '../render'

function showPage(filters: DashboardFilters = { q: '', status: '' }) {
  usePage.mockReturnValue({
    props: { ...dashboardProps, filters },
    flash: { messages: [] },
  })
}

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    showPage()
  })

  it('requests the dashboard with the entered filters', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<Toolbar />)

    await user.type(screen.getByPlaceholderText('Search name, company, email'), 'alt')
    await user.selectOptions(screen.getByRole('combobox'), 'customer')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(router.get).toHaveBeenCalledWith(
      '/',
      { q: 'alt', status: 'customer' },
      expect.objectContaining({ preserveScroll: true, preserveState: true }),
    )
  })

  it('applies the status filter immediately when the selection changes', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<Toolbar />)

    await user.type(screen.getByPlaceholderText('Search name, company, email'), 'alt')
    await user.selectOptions(screen.getByRole('combobox'), 'customer')

    expect(router.get).toHaveBeenCalledWith(
      '/',
      { q: 'alt', status: 'customer' },
      expect.objectContaining({ preserveScroll: true, preserveState: true, replace: true }),
    )
  })

  it('omits empty filters from the request', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<Toolbar />)

    await user.type(screen.getByPlaceholderText('Search name, company, email'), '   ')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(router.get).toHaveBeenCalledWith('/', {}, expect.anything())
  })

  it('initialises the draft from the cached view filters', () => {
    showPage({ q: 'alt', status: 'lead' })

    renderWithQueryClient(<Toolbar />)

    expect(screen.getByPlaceholderText('Search name, company, email')).toHaveValue('alt')
    expect(screen.getByRole('combobox')).toHaveValue('lead')
  })

  it('keeps the export link pointing at the plain CSV endpoint', () => {
    renderWithQueryClient(<Toolbar />)

    expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', '/export/')
  })
})
