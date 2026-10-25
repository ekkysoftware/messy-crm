import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import Dashboard from '@/pages/crm/Dashboard'
import type { ContactRow, DashboardProps } from '@/types'
import { contactDetail, contactRow, dashboardProps } from '../fixtures'
import { router, usePage } from '../mocks/inertia'
import { renderWithQueryClient } from '../render'

const secondRow: ContactRow = {
  ...contactRow,
  id: 2,
  name: 'Second Person',
  email: 'second@example.com',
  selected: false,
  url: '/?contact=2',
}

const twoContacts: DashboardProps = {
  ...dashboardProps,
  contacts: [contactRow, secondRow],
  summary: { total: 2, pipeline: 2000, statusCounts: { lead: 2 } },
}

function showPage(props: DashboardProps) {
  usePage.mockReturnValue({ props, flash: { messages: [] } })
}

function detailPanel(): HTMLElement {
  const panel = screen.getByRole('button', { name: 'Delete contact' }).closest('.panel')
  if (!(panel instanceof HTMLElement)) throw new Error('detail panel not found')
  return panel
}

async function openCreateDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'New contact' }))
}

describe('Dashboard writes repaint from the response payload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    showPage(twoContacts)
  })

  it('removes a deleted contact and clears the selection', async () => {
    vi.mocked(router.delete).mockImplementationOnce((_url, options) => {
      showPage({
        ...twoContacts,
        contacts: [{ ...secondRow, selected: false }],
        selected: null,
        summary: { total: 1, pipeline: 1000, statusCounts: { lead: 1 } },
      })
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    const { rerender } = renderWithQueryClient(<Dashboard />)
    expect(screen.getAllByText('Ekky Example').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Delete contact' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    rerender(<Dashboard />)

    expect(screen.queryByText('Ekky Example')).not.toBeInTheDocument()
    expect(screen.getByText('Select a contact.')).toBeInTheDocument()
    expect(screen.getByText('Second Person')).toBeInTheDocument()
  })

  it('renders the created contact as selected', async () => {
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      showPage({
        ...twoContacts,
        contacts: [
          contactRow,
          {
            ...secondRow,
            name: 'Created Person',
            email: 'created@example.com',
            selected: true,
          },
        ],
        selected: {
          ...contactDetail,
          id: 2,
          name: 'Created Person',
          email: 'created@example.com',
        },
      })
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    const { rerender } = renderWithQueryClient(<Dashboard />)
    await openCreateDialog(user)
    await user.type(screen.getByLabelText('Name'), 'Created Person')
    await user.click(screen.getByRole('button', { name: 'Create contact' }))
    rerender(<Dashboard />)

    expect(screen.getByRole('heading', { name: 'Created Person' })).toBeInTheDocument()
    expect(screen.getAllByText('created@example.com').length).toBeGreaterThan(0)
  })

  it('renders the status change activity after a status write', async () => {
    vi.mocked(router.patch).mockImplementationOnce((_url, _data, options) => {
      showPage({
        ...twoContacts,
        contacts: [
          contactRow,
          {
            ...secondRow,
            name: 'Second Person',
            selected: true,
          },
        ],
        selected: {
          ...contactDetail,
          id: 2,
          name: 'Second Person',
          activities: [
            {
              kind: 'status',
              body: 'Status changed from lead to qualified',
              createdBy: 'Interview User',
              createdAt: '24 Oct 2026 12:00',
            },
            ...contactDetail.activities,
          ],
        },
      })
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    const { rerender } = renderWithQueryClient(<Dashboard />)
    await user.click(within(detailPanel()).getByRole('button', { name: 'Status: Lead' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Qualified' }))
    rerender(<Dashboard />)

    expect(screen.getByRole('heading', { name: 'Second Person' })).toBeInTheDocument()
    expect(
      screen.getAllByText('Status changed from lead to qualified').length,
    ).toBeGreaterThan(0)
  })

  it('renders the new note after a note write', async () => {
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      showPage({
        ...twoContacts,
        selected: {
          ...contactDetail,
          activities: [
            {
              kind: 'note',
              body: 'Called customer',
              createdBy: 'Interview User',
              createdAt: '24 Oct 2026 12:05',
            },
            ...contactDetail.activities,
          ],
        },
      })
      options?.onFinish?.({} as never)
    })
    const user = userEvent.setup()

    const { rerender } = renderWithQueryClient(<Dashboard />)
    await user.type(screen.getByPlaceholderText('Add a note…'), 'Called customer')
    await user.click(screen.getByRole('button', { name: 'Save note' }))
    rerender(<Dashboard />)

    expect(screen.getByText('Called customer')).toBeInTheDocument()
  })

  it('replaces a cached view with the post-write payload instead of resurrecting it', () => {
    const { client, rerender } = renderWithQueryClient(<Dashboard />)
    expect(screen.getByRole('heading', { name: 'Ekky Example' })).toBeInTheDocument()

    const updated: DashboardProps = {
      ...dashboardProps,
      selected: {
        ...contactDetail,
        activities: [
          {
            kind: 'note',
            body: 'Fresh from the redirect',
            createdBy: 'Interview User',
            createdAt: '24 Oct 2026 12:10',
          },
          ...contactDetail.activities,
        ],
      },
    }
    showPage(updated)
    rerender(<Dashboard />)

    expect(screen.getByText('Fresh from the redirect')).toBeInTheDocument()
    // Same filters and same selection: one cached entry, refreshed in place.
    expect(client.getQueryCache().getAll()).toHaveLength(1)
  })
})
