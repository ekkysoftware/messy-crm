import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { queryClient } from '@/lib/queryClient'

describe('queryClient', () => {
  it('is a single QueryClient instance', () => {
    expect(queryClient).toBeInstanceOf(QueryClient)
  })

  it('never refetches a query on its own', () => {
    const { queries } = queryClient.getDefaultOptions()

    expect(queries?.staleTime).toBe(Infinity)
    expect(queries?.gcTime).toBe(5 * 60 * 1000)
    expect(queries?.retry).toBe(false)
    expect(queries?.refetchOnMount).toBe(false)
    expect(queries?.refetchOnWindowFocus).toBe(false)
    expect(queries?.refetchOnReconnect).toBe(false)
  })

  it('does not retry mutations', () => {
    const { mutations } = queryClient.getDefaultOptions()

    expect(mutations?.retry).toBe(false)
  })
})
