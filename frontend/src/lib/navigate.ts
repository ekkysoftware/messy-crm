import { router } from '@inertiajs/react'

/** Asks Django for the dashboard filtered by the applied query and status. */
export function navigateToContacts(query: string, status: string) {
  const params: Record<string, string> = {}
  if (query.trim()) {
    params.q = query.trim()
  }
  if (status) {
    params.status = status
  }

  router.get('/', params, { preserveState: true, preserveScroll: true, replace: true })
}
