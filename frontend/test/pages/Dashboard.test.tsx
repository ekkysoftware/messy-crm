import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import Dashboard from '@/pages/crm/Dashboard'
import type { FlashMessage } from '@/types'
import { dashboardProps } from '../fixtures'
import { usePage } from '../mocks/inertia'
import { renderWithQueryClient } from '../render'

function showPage(
  props: Partial<typeof dashboardProps> & { errors?: Record<string, string> } = {},
  flash?: { messages?: FlashMessage[] },
) {
  usePage.mockReturnValue({ props: { ...dashboardProps, ...props }, flash })
}

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    showPage({}, { messages: [] })
  })

  it('renders the screen from page props', () => {
    renderWithQueryClient(<Dashboard />)

    expect(screen.getByText('Jellybean CRM')).toBeInTheDocument()
    expect(screen.getByText('All contacts')).toBeInTheDocument()
    expect(screen.getByText('Pipeline value')).toBeInTheDocument()
    // Stats, the contact row and the detail panel each show the value.
    expect(screen.getAllByText('$1,000')).toHaveLength(3)
    expect(screen.getAllByText('Ekky Example').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Contact details' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument()
  })

  it('renders shared validation errors as a banner', () => {
    showPage({ errors: { name: 'Name is required' } }, { messages: [] })

    renderWithQueryClient(<Dashboard />)

    // The banner and the create form both surface the shared error.
    expect(screen.getAllByText('Name is required').length).toBeGreaterThan(0)
  })

  it('renders flash messages as toasts', () => {
    showPage({}, { messages: [{ level: 'success', message: 'Contact deleted' }] })

    renderWithQueryClient(<Dashboard />)

    expect(screen.getByRole('status')).toHaveTextContent('Contact deleted')
  })

  it('renders no toast when flash data is absent or empty', () => {
    showPage({})

    const { container, rerender } = renderWithQueryClient(<Dashboard />)

    expect(container.querySelector('.toast')).toBeNull()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    showPage({}, { messages: [] })
    rerender(<Dashboard />)

    expect(container.querySelector('.toast')).toBeNull()
  })
})
