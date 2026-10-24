import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import ContactDetail from '@/components/ContactDetail'
import { contactDetail, filters, statusChoices } from '../fixtures'
import { renderWithQueryClient } from '../render'
describe('ContactDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the selected contact, its actions and activity history', () => {
    renderWithQueryClient(
      <ContactDetail selected={contactDetail} filters={filters} statusChoices={statusChoices} />,
    )

    expect(screen.getByRole('heading', { name: 'Ekky Example' })).toBeInTheDocument()
    expect(screen.getByText('ekky@example.com')).toBeInTheDocument()
    expect(screen.getByText('+62 555 0100')).toBeInTheDocument()
    expect(screen.getByText('Mina')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()

    expect(screen.getByText('Status changed from lead to qualified')).toBeInTheDocument()
    expect(screen.getByText('Contact created')).toBeInTheDocument()
    expect(screen.getByText('22 Oct 2026 10:00')).toBeInTheDocument()
    expect(screen.getAllByText('status').length).toBeGreaterThan(0)

    expect(screen.getByRole('button', { name: 'Update status' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save note' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete contact' })).toBeInTheDocument()
  })

  it('prompts to select a contact when nothing is selected', () => {
    renderWithQueryClient(
      <ContactDetail selected={null} filters={filters} statusChoices={statusChoices} />,
    )

    expect(screen.getByText('Select a contact.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Update status' })).toBeNull()
  })
})
