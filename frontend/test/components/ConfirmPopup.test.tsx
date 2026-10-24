import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ConfirmPopup from '@/components/ConfirmPopup'

function renderPopup(overrides: Partial<Parameters<typeof ConfirmPopup>[0]> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()

  const result = render(
    <ConfirmPopup
      label="Delete this contact?"
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  )

  return { ...result, onConfirm, onCancel }
}

describe('ConfirmPopup', () => {
  it('renders the question as a modal dialog', () => {
    renderPopup()

    const dialog = screen.getByRole('alertdialog', { name: 'Delete this contact?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Delete this contact?')).toBeInTheDocument()
  })

  it('focuses the dismissive answer first', () => {
    renderPopup()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('reports a confirmation', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = renderPopup()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('reports a cancellation from the button, the backdrop and Escape', async () => {
    const user = userEvent.setup()
    const { container, onCancel, onConfirm } = renderPopup()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    const backdrop = container.querySelector('.popup-backdrop')
    if (!(backdrop instanceof HTMLElement)) throw new Error('backdrop not found')
    await user.click(backdrop)
    expect(onCancel).toHaveBeenCalledTimes(2)

    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(3)

    expect(onConfirm).not.toHaveBeenCalled()
  })
})
