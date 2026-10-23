import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import Toolbar from '@/components/Toolbar'
import { statusChoices } from '../fixtures'
import { router } from '../mocks/inertia'

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requests the dashboard with the entered filters', async () => {
    const user = userEvent.setup()
    render(<Toolbar filters={{ q: '', status: '' }} statusChoices={statusChoices} />)

    await user.type(screen.getByPlaceholderText('Search name, company, email'), 'alt')
    await user.selectOptions(screen.getByRole('combobox'), 'customer')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(router.get).toHaveBeenCalledWith(
      '/',
      { q: 'alt', status: 'customer' },
      expect.objectContaining({ preserveScroll: true, preserveState: true }),
    )
  })

  it('omits empty filters from the request', async () => {
    const user = userEvent.setup()
    render(<Toolbar filters={{ q: '', status: '' }} statusChoices={statusChoices} />)

    await user.type(screen.getByPlaceholderText('Search name, company, email'), '   ')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(router.get).toHaveBeenCalledWith('/', {}, expect.anything())
  })

  it('keeps the export link pointing at the plain CSV endpoint', () => {
    render(<Toolbar filters={{ q: 'x', status: 'lead' }} statusChoices={statusChoices} />)
    expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', '/export/')
  })
})
