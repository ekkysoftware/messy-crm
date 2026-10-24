import { render, screen } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { createElement, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('./mocks/inertia'))

import Dashboard from '../src/pages/crm/Dashboard'
import { queryClient } from '../src/lib/queryClient'
import { createInertiaApp } from './mocks/inertia'

interface AppOptions {
  resolve: (name: string) => Promise<unknown>
  withApp?: (app: ReactElement) => ReactElement
}

// app.tsx boots Inertia at import time, so import it once and inspect the
// options object it handed to createInertiaApp().
const optionsPromise: Promise<AppOptions> = import('../src/app').then(() => {
  expect(createInertiaApp).toHaveBeenCalledTimes(1)
  return createInertiaApp.mock.calls[0][0] as AppOptions
})

describe('Inertia page resolver', () => {
  it('resolves the page name served by Django (crm/Dashboard)', async () => {
    const { resolve } = await optionsPromise

    const page = await resolve('crm/Dashboard')

    // The resolver hands back the component itself, not the module object.
    expect(page).toBe(Dashboard)
  })

  it('rejects names that have no matching file under pages/', async () => {
    const { resolve } = await optionsPromise

    await expect(resolve('crm/DoesNotExist')).rejects.toThrow(
      'Unknown Inertia page: crm/DoesNotExist',
    )
  })
})

describe('Inertia app bootstrap', () => {
  it('wraps the app in the shared query client', async () => {
    const { withApp } = await optionsPromise
    expect(withApp).toBeTypeOf('function')

    function Probe() {
      const client = useQueryClient()
      return createElement('span', null, client === queryClient ? 'shared client' : 'other client')
    }

    render(withApp!(createElement(Probe)))

    expect(screen.getByText('shared client')).toBeInTheDocument()
  })
})
