import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import Dashboard from '@/pages/crm/Dashboard'
import type { DashboardProps } from '@/types'
import { dashboardProps } from '../fixtures'
import { router, usePage } from '../mocks/inertia'
import { renderWithQueryClient } from '../render'

function showPage(props: DashboardProps & { errors?: Record<string, string> }) {
  usePage.mockReturnValue({ props, flash: { messages: [] } })
}

describe('Dashboard feedback contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    showPage(dashboardProps)
  })

  it('keeps the contact listed and shows no confirmation while a delete is pending', async () => {
    let finish: (() => void) | undefined
    vi.mocked(router.delete).mockImplementationOnce((_url, options) => {
      finish = () => options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    renderWithQueryClient(<Dashboard />)

    await user.click(screen.getByRole('button', { name: 'Delete contact' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Delete contact' })).toBeDisabled(),
    )
    // No optimistic removal: the row is still there until the payload arrives.
    expect(screen.getAllByText('Ekky Example').length).toBeGreaterThan(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(document.querySelector('.toast')).toBeNull()

    await act(async () => {
      finish?.()
    })
  })

  it('shows only the payload error after a rejected write', async () => {
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      showPage({ ...dashboardProps, errors: { name: 'Name is required' } })
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    const { rerender } = renderWithQueryClient(<Dashboard />)

    await user.click(screen.getByRole('button', { name: 'New contact' }))
    await user.type(screen.getByLabelText('Name'), 'Nameless')
    await user.click(screen.getByRole('button', { name: 'Create contact' }))
    rerender(<Dashboard />)

    // The banner and the create form both surface the shared error.
    expect(screen.getAllByText('Name is required').length).toBeGreaterThan(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Created /)).not.toBeInTheDocument()
  })
})
