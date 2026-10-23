import { describe, expect, it } from 'vitest'

import { formatCurrency } from '../../src/lib/format'

describe('formatCurrency', () => {
  it('separates thousands like the previous dashboard script', () => {
    expect(formatCurrency(1000)).toBe('$1,000')
    expect(formatCurrency(250000)).toBe('$250,000')
  })

  it('renders zero and decimals', () => {
    expect(formatCurrency(0)).toBe('$0')
    expect(formatCurrency(1234.5)).toBe('$1,234.5')
  })

  it('accepts numeric strings from props', () => {
    expect(formatCurrency('2500')).toBe('$2,500')
  })
})
