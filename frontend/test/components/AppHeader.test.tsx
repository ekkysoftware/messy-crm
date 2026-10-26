import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import AppHeader from '@/components/AppHeader'

describe('AppHeader', () => {
  it('renders the wordmark without the contact search', () => {
    render(<AppHeader />)

    expect(screen.getByText('Jellybean')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Search contacts' })).not.toBeInTheDocument()
  })
})
