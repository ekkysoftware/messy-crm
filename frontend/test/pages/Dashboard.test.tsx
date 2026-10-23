import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import Dashboard from '@/pages/crm/Dashboard'
import { dashboardProps } from '../fixtures'
import { usePage } from '../mocks/inertia'

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePage.mockReturnValue({ props: { errors: {} }, flash: { messages: [] } })
  })

  it('renders the screen from page props', () => {
    render(<Dashboard {...dashboardProps} />)

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
    usePage.mockReturnValue({
      props: { errors: { name: 'Name is required' } },
      flash: { messages: [] },
    })

    render(<Dashboard {...dashboardProps} />)

    expect(screen.getByText('Name is required')).toBeInTheDocument()
  })

  it('renders flash messages as toasts', () => {
    usePage.mockReturnValue({
      props: { errors: {} },
      flash: { messages: [{ level: 'success', message: 'Contact deleted' }] },
    })

    render(<Dashboard {...dashboardProps} />)

    expect(screen.getByRole('status')).toHaveTextContent('Contact deleted')
  })

  it('renders no toast when flash data is absent or empty', () => {
    usePage.mockReturnValue({ props: { errors: {} } })
    const { container, rerender } = render(<Dashboard {...dashboardProps} />)

    expect(container.querySelector('.toast')).toBeNull()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    usePage.mockReturnValue({ props: { errors: {} }, flash: { messages: [] } })
    rerender(<Dashboard {...dashboardProps} />)

    expect(container.querySelector('.toast')).toBeNull()
  })
})
