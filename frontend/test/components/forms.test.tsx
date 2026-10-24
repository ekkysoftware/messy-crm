import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import NewContactForm from '@/components/NewContactForm'
import NoteForm from '@/components/NoteForm'
import StatusForm from '@/components/StatusForm'
import { filters, statusChoices } from '../fixtures'
import { router, usePage } from '../mocks/inertia'
import { renderWithQueryClient } from '../render'

const newContactFilters = { q: 'alt', status: 'lead' }

function showErrors(errors: Record<string, string> = {}) {
  usePage.mockReturnValue({ props: { errors }, flash: { messages: [] } })
}

describe('NewContactForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    showErrors()
  })

  it('posts the entered contact to the create endpoint with the active filters', async () => {
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    renderWithQueryClient(
      <NewContactForm filters={newContactFilters} statusChoices={statusChoices} />,
    )

    await user.type(screen.getByPlaceholderText('Name'), 'Ekky')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(router.post).toHaveBeenCalledWith(
      '/contacts/',
      expect.objectContaining({
        name: 'Ekky',
        new_status: 'lead',
        q: 'alt',
        status: 'lead',
      }),
      expect.objectContaining({ preserveScroll: true }),
    )
  })

  it('shows the server error carried by the page payload', () => {
    showErrors({ name: 'Name is required' })

    renderWithQueryClient(
      <NewContactForm filters={filters} statusChoices={statusChoices} />,
    )

    expect(screen.getByText('Name is required')).toBeInTheDocument()
  })

  it('disables submit while the write is pending and resets after it settles', async () => {
    let finish: (() => void) | undefined
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      finish = () => options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    renderWithQueryClient(
      <NewContactForm filters={filters} statusChoices={statusChoices} />,
    )

    const nameInput = screen.getByPlaceholderText('Name')
    const addButton = screen.getByRole('button', { name: 'Add' })

    await user.type(nameInput, 'Ekky')
    await user.click(addButton)

    await waitFor(() => expect(addButton).toBeDisabled())
    expect(nameInput).toHaveValue('Ekky')

    await act(async () => {
      finish?.()
    })

    await waitFor(() => expect(addButton).toBeEnabled())
    expect(nameInput).toHaveValue('')
  })
})

describe('StatusForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    showErrors()
  })

  it('patches the status endpoint for the selected contact', async () => {
    vi.mocked(router.patch).mockImplementationOnce((_url, _data, options) => {
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    renderWithQueryClient(
      <StatusForm
        contactId={7}
        currentStatus="lead"
        filters={filters}
        statusChoices={statusChoices}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox'), 'customer')
    await user.click(screen.getByRole('button', { name: 'Update status' }))

    expect(router.patch).toHaveBeenCalledWith(
      '/contacts/7/status/',
      expect.objectContaining({ new_status: 'customer', q: '', status: '' }),
      expect.objectContaining({ preserveScroll: true }),
    )
  })

  it('shows a validation error for the status field from the page payload', () => {
    showErrors({ new_status: 'Select a valid choice.' })

    renderWithQueryClient(
      <StatusForm
        contactId={1}
        currentStatus="lead"
        filters={filters}
        statusChoices={statusChoices}
      />,
    )

    expect(screen.getByText('Select a valid choice.')).toBeInTheDocument()
  })
})

describe('NoteForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    showErrors()
  })

  it('posts the note to the contact notes endpoint and resets after settling', async () => {
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    renderWithQueryClient(<NoteForm contactId={3} filters={filters} />)

    const noteInput = screen.getByPlaceholderText('Add a note')
    await user.type(noteInput, 'Called back')
    await user.click(screen.getByRole('button', { name: 'Save note' }))

    expect(router.post).toHaveBeenCalledWith(
      '/contacts/3/notes/',
      expect.objectContaining({ note: 'Called back' }),
      expect.objectContaining({ preserveScroll: true }),
    )
    await waitFor(() => expect(noteInput).toHaveValue(''))
  })
})
