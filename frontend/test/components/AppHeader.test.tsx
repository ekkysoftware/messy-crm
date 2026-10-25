import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import AppHeader from '@/components/AppHeader'

describe('AppHeader', () => {
  it('renders the wordmark and the current search draft', () => {
    render(<AppHeader q="alt" onQChange={() => {}} onSubmit={() => {}} />)

    expect(screen.getByText('Jellybean')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search contacts' })).toHaveValue('alt')
    expect(screen.getByText('⌘ K')).toBeInTheDocument()
  })

  it('reports typing and submits the search on Enter', async () => {
    const onQChange = vi.fn()
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(<AppHeader q="" onQChange={onQChange} onSubmit={onSubmit} />)

    await user.type(screen.getByRole('textbox', { name: 'Search contacts' }), 'alt{Enter}')

    expect(onQChange).toHaveBeenCalled()
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('focuses the search field with the Cmd+K shortcut', () => {
    render(<AppHeader q="" onQChange={() => {}} onSubmit={() => {}} />)

    const input = screen.getByRole('textbox', { name: 'Search contacts' })
    expect(input).not.toHaveFocus()

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    expect(input).toHaveFocus()
  })
})
