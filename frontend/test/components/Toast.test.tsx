import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import Toast from '@/components/Toast'
import type { FlashLevel, FlashMessage } from '@/types'
import { usePage } from '../mocks/inertia'

const TOAST_DURATION_MS = 5000

function showFlash(messages?: FlashMessage[]) {
  usePage.mockReturnValue({ props: { errors: {} }, flash: { messages } })
}

describe('Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    showFlash([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders each message text', () => {
    showFlash([{ level: 'success', message: 'Contact deleted' }])

    render(<Toast />)

    expect(screen.getByText('Contact deleted')).toBeInTheDocument()
  })

  it('keeps the queued order', () => {
    showFlash([
      { level: 'success', message: 'Note added' },
      { level: 'info', message: 'Export queued' },
    ])

    render(<Toast />)

    const rendered = screen.getAllByRole('status').map((toast) => toast.textContent)
    expect(rendered).toEqual(['Note added', 'Export queued'])
  })

  it('announces success politely and errors assertively', () => {
    showFlash([
      { level: 'success', message: 'Status changed to qualified' },
      { level: 'error', message: 'Import failed' },
    ])

    render(<Toast />)

    expect(screen.getByRole('status')).toHaveTextContent('Status changed to qualified')
    expect(screen.getByRole('alert')).toHaveTextContent('Import failed')
  })

  it('styles each message by its level', () => {
    showFlash([
      { level: 'success', message: 'Saved' },
      { level: 'info', message: 'Queued' },
      { level: 'warning', message: 'Slow' },
      { level: 'error', message: 'Failed' },
    ])

    render(<Toast />)

    expect(screen.getByText('Saved')).toHaveClass('toast', 'toast-success')
    expect(screen.getByText('Queued')).toHaveClass('toast', 'toast-info')
    expect(screen.getByText('Slow')).toHaveClass('toast', 'toast-warning')
    expect(screen.getByText('Failed')).toHaveClass('toast', 'toast-error')
  })

  it('falls back to info styling for an unknown level', () => {
    showFlash([{ level: 'notice' as FlashLevel, message: 'Heads up' }])

    render(<Toast />)

    expect(screen.getByRole('status')).toHaveClass('toast-info')
  })

  it('keeps a toast until its delay elapses', () => {
    showFlash([{ level: 'success', message: 'Contact deleted' }])

    render(<Toast />)
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1))

    expect(screen.getByText('Contact deleted')).toBeInTheDocument()
  })

  it('removes a toast once its delay elapses', () => {
    showFlash([{ level: 'success', message: 'Contact deleted' }])

    render(<Toast />)
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS))

    expect(screen.queryByText('Contact deleted')).not.toBeInTheDocument()
  })

  it('removes every toast of a visit', () => {
    showFlash([
      { level: 'success', message: 'Note added' },
      { level: 'info', message: 'Export queued' },
    ])

    const { rerender } = render(<Toast />)
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(<Toast />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows its messages again when a new page payload arrives', () => {
    showFlash([{ level: 'success', message: 'Contact deleted' }])

    const { rerender } = render(<Toast />)
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS))
    expect(screen.queryByText('Contact deleted')).not.toBeInTheDocument()

    showFlash([{ level: 'success', message: 'Contact deleted' }])
    rerender(<Toast />)

    expect(screen.getByText('Contact deleted')).toBeInTheDocument()
  })

  it('renders nothing when the page has no flash entry', () => {
    usePage.mockReturnValue({ props: { errors: {} } })

    const { container } = render(<Toast />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the message list is empty', () => {
    const { container } = render(<Toast />)

    expect(container).toBeEmptyDOMElement()
  })
})
