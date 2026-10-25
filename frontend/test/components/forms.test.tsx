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

    await user.type(screen.getByLabelText('Name'), 'Ekky')
    await user.click(screen.getByRole('button', { name: 'Create contact' }))

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

  it('submits the picked status and previews the name initials', async () => {
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    renderWithQueryClient(
      <NewContactForm filters={filters} statusChoices={statusChoices} />,
    )

    expect(screen.queryByText('SL')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Name'), 'Sarah Lim')
    expect(screen.getByText('SL')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Customer' }))
    await user.click(screen.getByRole('button', { name: 'Create contact' }))

    expect(router.post).toHaveBeenCalledWith(
      '/contacts/',
      expect.objectContaining({ name: 'Sarah Lim', new_status: 'customer' }),
      expect.anything(),
    )
  })

  it('creates on Cmd+Enter', async () => {
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    renderWithQueryClient(
      <NewContactForm filters={filters} statusChoices={statusChoices} />,
    )

    await user.type(screen.getByLabelText('Name'), 'Ekky')
    await user.keyboard('{Meta>}{Enter}{/Meta}')

    expect(router.post).toHaveBeenCalledWith(
      '/contacts/',
      expect.objectContaining({ name: 'Ekky' }),
      expect.anything(),
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

    const nameInput = screen.getByLabelText('Name')
    const addButton = screen.getByRole('button', { name: 'Create contact' })

    await user.type(nameInput, 'Ekky')
    await user.click(addButton)

    await waitFor(() => expect(addButton).toBeDisabled())
    expect(nameInput).toHaveValue('Ekky')

    await act(async () => {
      finish?.()
    })

    await waitFor(() => expect(addButton).toBeEnabled())
    expect(nameInput).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'Lead' })).toBeChecked()
  })
})

describe('StatusForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    showErrors()
  })

  it('patches the status endpoint as soon as a status is selected', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Status: Lead' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Customer' }))

    expect(router.patch).toHaveBeenCalledWith(
      '/contacts/7/status/',
      expect.objectContaining({ new_status: 'customer', q: '', status: '' }),
      expect.objectContaining({ preserveScroll: true }),
    )
  })

  it('marks the current status and closes the menu on Escape', async () => {
    const user = userEvent.setup()

    renderWithQueryClient(
      <StatusForm
        contactId={1}
        currentStatus="lead"
        filters={filters}
        statusChoices={statusChoices}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Status: Lead' }))

    expect(screen.getByRole('menu', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Lead' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('menuitemradio', { name: 'Qualified' })).toHaveAttribute(
      'aria-checked',
      'false',
    )

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu', { name: 'Status' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Status: Lead' })).toHaveFocus()
    expect(router.patch).not.toHaveBeenCalled()
  })

  it('does not write when the current status is picked again', async () => {
    const user = userEvent.setup()

    renderWithQueryClient(
      <StatusForm
        contactId={1}
        currentStatus="lead"
        filters={filters}
        statusChoices={statusChoices}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Status: Lead' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Lead' }))

    expect(router.patch).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu', { name: 'Status' })).not.toBeInTheDocument()
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

    const noteInput = screen.getByPlaceholderText('Add a note…')
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
