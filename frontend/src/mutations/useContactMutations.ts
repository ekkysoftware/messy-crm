import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { router } from '@inertiajs/react'

import { dashboardRootKey } from '@/lib/queryKeys'
import { visitToPromise } from '@/mutations/visitToPromise'
import type { ContactStatus, DashboardFilters } from '@/types'

export interface CreateContactInput {
  name: string
  email: string
  company: string
  owner: string
  phone: string
  value: string
  new_status: ContactStatus
}

export interface UpdateContactInput extends CreateContactInput {
  contactId: number
}

export interface StatusChangeInput {
  contactId: number
  new_status: ContactStatus
}

export interface NoteInput {
  contactId: number
  note: string
}

export interface DeleteContactInput {
  contactId: number
}

function activeFilters(filters: DashboardFilters) {
  return { q: filters.q, status: filters.status }
}

/**
 * The redirect's payload is what repaints the view, so cached entries are only
 * marked stale. Refetching would be pointless: query functions never fetch.
 */
function invalidateDashboard(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: dashboardRootKey, refetchType: 'none' })
}

export function useCreateContactMutation(filters: DashboardFilters) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, CreateContactInput>({
    mutationFn: (input) =>
      visitToPromise(({ onFinish, onCancel }) =>
        router.post(
          '/contacts/',
          { ...input, ...activeFilters(filters) },
          { preserveScroll: true, onFinish, onCancel },
        ),
      ),
    onSuccess: () => invalidateDashboard(queryClient),
  })
}

export function useUpdateContactMutation(filters: DashboardFilters) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, UpdateContactInput>({
    mutationFn: ({ contactId, ...input }) =>
      visitToPromise(({ onFinish, onCancel }) =>
        router.patch(
          `/contacts/${contactId}/`,
          { ...input, ...activeFilters(filters) },
          { preserveScroll: true, onFinish, onCancel },
        ),
      ),
    onSuccess: () => invalidateDashboard(queryClient),
  })
}

export function useUpdateStatusMutation(filters: DashboardFilters) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, StatusChangeInput>({
    mutationFn: ({ contactId, new_status }) =>
      visitToPromise(({ onFinish, onCancel }) =>
        router.patch(
          `/contacts/${contactId}/status/`,
          { new_status, ...activeFilters(filters) },
          { preserveScroll: true, onFinish, onCancel },
        ),
      ),
    onSuccess: () => invalidateDashboard(queryClient),
  })
}

export function useAddNoteMutation(filters: DashboardFilters) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, NoteInput>({
    mutationFn: ({ contactId, note }) =>
      visitToPromise(({ onFinish, onCancel }) =>
        router.post(
          `/contacts/${contactId}/notes/`,
          { note, ...activeFilters(filters) },
          { preserveScroll: true, onFinish, onCancel },
        ),
      ),
    onSuccess: () => invalidateDashboard(queryClient),
  })
}

export function useDeleteContactMutation(filters: DashboardFilters) {
  const queryClient = useQueryClient()

  return useMutation<void, Error, DeleteContactInput>({
    mutationFn: ({ contactId }) =>
      visitToPromise(({ onFinish, onCancel }) =>
        router.delete(`/contacts/${contactId}/`, {
          data: activeFilters(filters),
          preserveScroll: true,
          onFinish,
          onCancel,
        }),
      ),
    onSuccess: () => invalidateDashboard(queryClient),
  })
}
