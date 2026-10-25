import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import ContactDetail from '@/components/ContactDetail'
import { contactDetail, filters, statusChoices } from '../fixtures'
import { router } from '../mocks/inertia'
import { renderWithQueryClient } from '../render'

describe('ContactDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('renders the selected contact, its actions and activity history', () => {
    renderWithQueryClient(
      <ContactDetail selected={contactDetail} filters={filters} statusChoices={statusChoices} />,
    )

    expect(screen.getByRole('heading', { name: 'Ekky Example' })).toBeInTheDocument()
    expect(screen.getByText('ekky@example.com')).toBeInTheDocument()
    expect(screen.getByText('+62 555 0100')).toBeInTheDocument()
    expect(screen.getByText('Mina')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()

    expect(screen.getByText('Status changed from lead to qualified')).toBeInTheDocument()
    expect(screen.getByText('Contact created')).toBeInTheDocument()
    expect(screen.getByText('22 Oct 2026 10:00')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Status: Lead' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete contact' })).toBeInTheDocument()
  })

  it('prompts to select a contact when nothing is selected', () => {
    renderWithQueryClient(
      <ContactDetail selected={null} filters={filters} statusChoices={statusChoices} />,
    )

    expect(screen.getByText('Select a contact.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete contact' })).toBeNull()
  })

  it('asks in a popup before deleting and sends nothing until confirmed', async () => {
    const user = userEvent.setup()

    renderWithQueryClient(
      <ContactDetail selected={contactDetail} filters={filters} statusChoices={statusChoices} />,
    )

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete contact' }))

    expect(
      screen.getByRole('alertdialog', { name: 'Delete this contact?' }),
    ).toBeInTheDocument()
    expect(router.delete).not.toHaveBeenCalled()
  })

  it('deletes the contact once the popup is confirmed', async () => {
    vi.mocked(router.delete).mockImplementationOnce((_url, options) => {
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    renderWithQueryClient(
      <ContactDetail
        selected={contactDetail}
        filters={{ q: 'alt', status: 'lead' }}
        statusChoices={statusChoices}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete contact' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(router.delete).toHaveBeenCalledWith(
      `/contacts/${contactDetail.id}/`,
      expect.objectContaining({ data: { q: 'alt', status: 'lead' }, preserveScroll: true }),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('cancelling the popup leaves the contact alone', async () => {
    const user = userEvent.setup()

    renderWithQueryClient(
      <ContactDetail selected={contactDetail} filters={filters} statusChoices={statusChoices} />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete contact' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(router.delete).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
