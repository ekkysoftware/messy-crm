import { useDeleteContactMutation } from '@/mutations/useContactMutations'
import type { DashboardFilters } from '@/types'

interface DeleteContactButtonProps {
  contactId: number
  filters: DashboardFilters
}

export default function DeleteContactButton({ contactId, filters }: DeleteContactButtonProps) {
  const deleteContact = useDeleteContactMutation(filters)

  function remove() {
    if (deleteContact.isPending) {
      return
    }

    if (!window.confirm('Delete this contact?')) {
      return
    }

    deleteContact.mutate({ contactId })
  }

  return (
    <button type="button" className="btn danger" onClick={remove} disabled={deleteContact.isPending}>
      Delete contact
    </button>
  )
}
