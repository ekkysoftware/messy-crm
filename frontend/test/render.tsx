import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

import { dashboardKey } from '@/lib/queryKeys'
import { createDashboardCacheEntry } from '@/queries/useDashboardView'
import type { DashboardProps } from '@/types'

/**
 * A fresh client per test: no retries or background refreshes, and a cache
 * that lives only as long as the test.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function QueryProvider({
  client,
  children,
}: {
  client: QueryClient
  children: ReactNode
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

export interface RenderWithQueryResult extends RenderResult {
  client: QueryClient
}

/** Seeds a dashboard view so a component test starts from a cached view. */
export function seedDashboardView(client: QueryClient, props: DashboardProps) {
  const key = dashboardKey(props.filters, props.selected?.id ?? null)
  client.setQueryData(key, createDashboardCacheEntry(props))
  return key
}

export function renderWithQueryClient(
  ui: ReactElement,
  { client = createTestQueryClient(), ...options }: RenderOptions & { client?: QueryClient } = {},
): RenderWithQueryResult {
  return {
    client,
    ...render(ui, {
      wrapper: ({ children }) => <QueryProvider client={client}>{children}</QueryProvider>,
      ...options,
    }),
  }
}
