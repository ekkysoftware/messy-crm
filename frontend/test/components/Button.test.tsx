import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Button from '@/components/Button'

describe('Button', () => {
  it('renders its label as a non-submitting primary button by default', () => {
    render(<Button label="Save" />)
    const button = screen.getByRole('button', { name: 'Save' })

    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('btn')
    expect(button).not.toBeDisabled()
  })

  it('adds the danger class for the danger variant', () => {
    render(<Button label="Delete" variant="danger" />)
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('btn', 'danger')
  })

  it('can submit a form', () => {
    render(<Button label="Add" type="submit" />)
    expect(screen.getByRole('button', { name: 'Add' })).toHaveAttribute('type', 'submit')
  })

  it('forwards clicks and stops them while disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<Button label="Go" onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<Button label="Go" onClick={onClick} disabled />)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
