import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import DeleteContactButton from '@/components/DeleteContactButton'
import { filters } from '../fixtures'
import { router } from '../mocks/inertia'
import { renderWithQueryClient } from '../render'

describe('DeleteContactButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('does nothing when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()

    renderWithQueryClient(<DeleteContactButton contactId={5} filters={filters} />)
    await user.click(screen.getByRole('button', { name: 'Delete contact' }))

    expect(router.delete).not.toHaveBeenCalled()
  })

  it('deletes the contact and carries the active filters', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(router.delete).mockImplementationOnce((_url, options) => {
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    renderWithQueryClient(
      <DeleteContactButton contactId={5} filters={{ q: 'alt', status: 'lead' }} />,
    )
    await user.click(screen.getByRole('button', { name: 'Delete contact' }))

    expect(router.delete).toHaveBeenCalledWith(
      '/contacts/5/',
      expect.objectContaining({ data: { q: 'alt', status: 'lead' }, preserveScroll: true }),
    )
  })

  it('disables itself while the delete is in flight and accepts only one click', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let finish: (() => void) | undefined
    vi.mocked(router.delete).mockImplementationOnce((_url, options) => {
      finish = () => options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    renderWithQueryClient(<DeleteContactButton contactId={5} filters={filters} />)
    const button = screen.getByRole('button', { name: 'Delete contact' })

    await user.click(button)
    await user.click(button)

    expect(router.delete).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(button).toBeDisabled())

    await act(async () => {
      finish?.()
    })

    await waitFor(() => expect(button).toBeEnabled())
  })
})
