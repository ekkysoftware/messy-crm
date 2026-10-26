import { renderHook, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@inertiajs/react', async () => await import('../mocks/inertia'))

import { dashboardRootKey } from '@/lib/queryKeys'
import {
  useAddNoteMutation,
  useCreateContactMutation,
  useDeleteContactMutation,
  useUpdateStatusMutation,
} from '@/mutations/useContactMutations'
import { router } from '../mocks/inertia'
import { createTestQueryClient, QueryProvider } from '../render'

const filters = { q: 'alt', status: 'lead' }

function renderMutation<T>(useMutationHook: () => T) {
  const client = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryProvider client={client}>{children}</QueryProvider>
  )

  return { client, ...renderHook(useMutationHook, { wrapper }) }
}

describe('contact mutation hooks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a contact with the active filters and invalidates the dashboard', async () => {
    const invalidateSpy = vi.fn().mockResolvedValue(undefined)
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      options?.onSuccess?.({} as never)
      options?.onFinish?.({} as never)
    })

    const { result, client } = renderMutation(() => useCreateContactMutation(filters))
    vi.spyOn(client, 'invalidateQueries').mockImplementation(invalidateSpy)

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Ekky',
        email: 'ekky@example.com',
        company: 'Altogether',
        owner: 'Mina',
        phone: '555',
        value: '1000',
        new_status: 'lead',
      })
    })

    expect(router.post).toHaveBeenCalledWith(
      '/contacts/',
      {
        name: 'Ekky',
        email: 'ekky@example.com',
        company: 'Altogether',
        owner: 'Mina',
        phone: '555',
        value: '1000',
        new_status: 'lead',
        q: 'alt',
        status: 'lead',
      },
      expect.objectContaining({ preserveScroll: true }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: dashboardRootKey,
      refetchType: 'none',
    })
  })

  it('patches a status with the active filters and invalidates the dashboard', async () => {
    const invalidateSpy = vi.fn().mockResolvedValue(undefined)
    vi.mocked(router.patch).mockImplementationOnce((_url, _data, options) => {
      options?.onSuccess?.({} as never)
      options?.onFinish?.({} as never)
    })

    const { result, client } = renderMutation(() => useUpdateStatusMutation(filters))
    vi.spyOn(client, 'invalidateQueries').mockImplementation(invalidateSpy)

    await act(async () => {
      await result.current.mutateAsync({ contactId: 7, new_status: 'customer' })
    })

    expect(router.patch).toHaveBeenCalledWith(
      '/contacts/7/status/',
      { new_status: 'customer', q: 'alt', status: 'lead' },
      expect.objectContaining({ preserveScroll: true }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: dashboardRootKey,
      refetchType: 'none',
    })
  })

  it('adds a note with the active filters and invalidates the dashboard', async () => {
    const invalidateSpy = vi.fn().mockResolvedValue(undefined)
    vi.mocked(router.post).mockImplementationOnce((_url, _data, options) => {
      options?.onSuccess?.({} as never)
      options?.onFinish?.({} as never)
    })

    const { result, client } = renderMutation(() => useAddNoteMutation(filters))
    vi.spyOn(client, 'invalidateQueries').mockImplementation(invalidateSpy)

    await act(async () => {
      await result.current.mutateAsync({ contactId: 3, note: 'Called back' })
    })

    expect(router.post).toHaveBeenCalledWith(
      '/contacts/3/notes/',
      { note: 'Called back', q: 'alt', status: 'lead' },
      expect.objectContaining({ preserveScroll: true }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: dashboardRootKey,
      refetchType: 'none',
    })
  })

  it('deletes a contact with the active filters and invalidates the dashboard', async () => {
    const invalidateSpy = vi.fn().mockResolvedValue(undefined)
    vi.mocked(router.delete).mockImplementationOnce((_url, options) => {
      options?.onSuccess?.({} as never)
      options?.onFinish?.({} as never)
    })

    const { result, client } = renderMutation(() => useDeleteContactMutation(filters))
    vi.spyOn(client, 'invalidateQueries').mockImplementation(invalidateSpy)

    await act(async () => {
      await result.current.mutateAsync({ contactId: 5 })
    })

    expect(router.delete).toHaveBeenCalledWith(
      '/contacts/5/',
      expect.objectContaining({ data: { q: 'alt', status: 'lead' }, preserveScroll: true }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: dashboardRootKey,
      refetchType: 'none',
    })
  })

  it('stays pending until the visit settles', async () => {
    let finish: (() => void) | undefined
    vi.mocked(router.delete).mockImplementationOnce((_url, options) => {
      finish = () => {
        options?.onSuccess?.({} as never)
        options?.onFinish?.({} as never)
      }
    })

    const { result } = renderMutation(() => useDeleteContactMutation(filters))

    act(() => {
      result.current.mutate({ contactId: 5 })
    })

    await waitFor(() => expect(result.current.isPending).toBe(true))

    await act(async () => {
      finish?.()
    })

    await waitFor(() => expect(result.current.isPending).toBe(false))
  })
})
