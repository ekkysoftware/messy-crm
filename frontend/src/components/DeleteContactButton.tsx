import { router } from '@inertiajs/react'

import type { DashboardFilters } from '@/types'

interface DeleteContactButtonProps {
  contactId: number
  filters: DashboardFilters
}

export default function DeleteContactButton({ contactId, filters }: DeleteContactButtonProps) {
  function remove() {
    if (!window.confirm('Delete this contact?')) {
      return
    }

    router.delete(`/contacts/${contactId}/`, {
      data: { q: filters.q, status: filters.status },
      preserveScroll: true,
    })
  }

  return (
    <button type="button" className="btn danger" onClick={remove}>
      Delete contact
    </button>
  )
}
