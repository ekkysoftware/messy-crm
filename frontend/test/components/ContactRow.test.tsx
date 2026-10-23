import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import ContactRow from '@/components/ContactRow'
import { contactRow } from '../fixtures'

describe('ContactRow', () => {
  it('renders the contact fields and links to the selection URL', () => {
    render(<ContactRow contact={contactRow} />)

    expect(screen.getByText('Ekky Example')).toBeInTheDocument()
    expect(screen.getByText('ekky@example.com')).toBeInTheDocument()
    expect(screen.getByText('Altogether')).toBeInTheDocument()
    expect(screen.getByText('Lead')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/?contact=1')
    expect(link.className).toContain('selected')
  })

  it('marks unselected rows without the selected class', () => {
    render(<ContactRow contact={{ ...contactRow, selected: false }} />)
    expect(screen.getByRole('link').className).not.toContain('selected')
  })

  it('renders markup-like names as text, not HTML', () => {
    const malicious = '<img src=x onerror=alert(1)>'
    render(<ContactRow contact={{ ...contactRow, name: malicious }} />)

    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText(malicious)).toBeInTheDocument()
  })
})
