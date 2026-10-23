import { describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('./mocks/inertia'))

import Dashboard from '../src/pages/crm/Dashboard'
import { createInertiaApp } from './mocks/inertia'

interface ResolveOptions {
  resolve: (name: string) => Promise<unknown>
}

// app.tsx boots Inertia at import time, so import it once and inspect the
// options object it handed to createInertiaApp().
const optionsPromise: Promise<ResolveOptions> = import('../src/app').then(() => {
  expect(createInertiaApp).toHaveBeenCalledTimes(1)
  return createInertiaApp.mock.calls[0][0] as ResolveOptions
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
