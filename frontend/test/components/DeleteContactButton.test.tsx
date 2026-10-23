import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import DeleteContactButton from '@/components/DeleteContactButton'
import { filters } from '../fixtures'
import { router } from '../mocks/inertia'

describe('DeleteContactButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('does nothing when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()

    render(<DeleteContactButton contactId={5} filters={filters} />)
    await user.click(screen.getByRole('button', { name: 'Delete contact' }))

    expect(router.delete).not.toHaveBeenCalled()
  })

  it('deletes the contact and carries the active filters', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    render(<DeleteContactButton contactId={5} filters={{ q: 'alt', status: 'lead' }} />)
    await user.click(screen.getByRole('button', { name: 'Delete contact' }))

    expect(router.delete).toHaveBeenCalledWith('/contacts/5/', {
      data: { q: 'alt', status: 'lead' },
      preserveScroll: true,
    })
  })
})
