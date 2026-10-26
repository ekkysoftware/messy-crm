import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import NewContactDialog from '@/components/NewContactDialog'
import { filters, statusChoices } from '../fixtures'
import { usePage } from '../mocks/inertia'
import { renderWithQueryClient } from '../render'

describe('ContactDialog keyboard focus', () => {
  beforeEach(() => {
    usePage.mockReturnValue({ props: { errors: {} }, flash: { messages: [] } })
  })

  it('wraps Tab and Shift+Tab within the dialog', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(
      <NewContactDialog filters={filters} statusChoices={statusChoices} onClose={vi.fn()} />,
    )

    expect(screen.getByLabelText('Name')).toHaveFocus()
    const first = screen.getByRole('button', { name: 'Close' })
    const last = screen.getByRole('button', { name: 'Create contact' })

    last.focus()
    await user.tab()
    expect(first).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()

    screen.getByLabelText('Name').focus()
    await user.tab()
    expect(screen.getByLabelText('Email')).toHaveFocus()
  })

  it('uses the latest close callback and restores the original opener after rerender', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const latestOnClose = vi.fn()
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { rerender, unmount } = renderWithQueryClient(
      <NewContactDialog filters={filters} statusChoices={statusChoices} onClose={onClose} />,
    )
    const email = screen.getByLabelText('Email')
    email.focus()
    rerender(
      <NewContactDialog filters={filters} statusChoices={statusChoices} onClose={latestOnClose} />,
    )
    expect(email).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(latestOnClose).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })

  it('skips disabled controls and keeps focus on the container when none remain', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(
      <NewContactDialog filters={filters} statusChoices={statusChoices} onClose={vi.fn()} />,
    )
    const dialog = screen.getByRole('dialog')
    for (const element of dialog.querySelectorAll('button, input')) {
      element.setAttribute('disabled', '')
    }

    await user.tab()
    expect(dialog).toHaveFocus()
    await user.tab({ shift: true })
    expect(dialog).toHaveFocus()

    const close = within(dialog).getByRole('button', { name: 'Close' })
    close.removeAttribute('disabled')
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(close).toHaveFocus()
  })
})
