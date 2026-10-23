import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@inertiajs/core')>()
  return {
    ...actual,
    router: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  }
})

import { router } from '@inertiajs/core'
import NewContactForm from '@/components/NewContactForm'
import NoteForm from '@/components/NoteForm'
import StatusForm from '@/components/StatusForm'
import { filters, statusChoices } from '../fixtures'

const newContactFilters = { q: 'alt', status: 'lead' }

describe('NewContactForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts the entered contact to the create endpoint with the active filters', async () => {
    const user = userEvent.setup()
    render(<NewContactForm filters={newContactFilters} statusChoices={statusChoices} />)

    await user.type(screen.getByPlaceholderText('Name'), 'Ekky')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(router.post).toHaveBeenCalledWith(
      '/contacts/',
      expect.objectContaining({ name: 'Ekky', new_status: 'lead', q: 'alt', status: 'lead' }),
      expect.objectContaining({ preserveScroll: true }),
    )
  })

  it('shows the server error and disables submit while processing', async () => {
    const user = userEvent.setup()
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      options?.onStart?.({} as never)
      options?.onError?.({ name: 'Name is required' })
    })

    render(<NewContactForm filters={filters} statusChoices={statusChoices} />)
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })
})

describe('StatusForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('patches the status endpoint for the selected contact', async () => {
    const user = userEvent.setup()
    render(
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

  it('shows a validation error for the status field', async () => {
    const user = userEvent.setup()
    vi.mocked(router.patch).mockImplementationOnce((_url, _data, options) => {
      options?.onError?.({ new_status: 'Select a valid choice.' })
    })

    render(
      <StatusForm
        contactId={1}
        currentStatus="lead"
        filters={filters}
        statusChoices={statusChoices}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Update status' }))

    expect(screen.getByText('Select a valid choice.')).toBeInTheDocument()
  })
})

describe('NoteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts the note to the contact notes endpoint', async () => {
    const user = userEvent.setup()
    render(<NoteForm contactId={3} filters={filters} />)

    await user.type(screen.getByPlaceholderText('Add a note'), 'Called back')
    await user.click(screen.getByRole('button', { name: 'Save note' }))

    expect(router.post).toHaveBeenCalledWith(
      '/contacts/3/notes/',
      expect.objectContaining({ note: 'Called back' }),
      expect.objectContaining({ preserveScroll: true }),
    )
  })
})
