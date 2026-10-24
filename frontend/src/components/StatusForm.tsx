import { usePage } from '@inertiajs/react'
import type { FormEvent } from 'react'

import { formField } from '@/lib/formData'
import { useUpdateStatusMutation } from '@/mutations/useContactMutations'
import type { ContactStatus, DashboardFilters, StatusChoice } from '@/types'

interface StatusFormProps {
  contactId: number
  currentStatus: ContactStatus
  filters: DashboardFilters
  statusChoices: StatusChoice[]
}

export default function StatusForm({
  contactId,
  currentStatus,
  filters,
  statusChoices,
}: StatusFormProps) {
  const { errors } = usePage().props
  const updateStatus = useUpdateStatusMutation(filters)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (updateStatus.isPending) {
      return
    }

    const data = new FormData(event.currentTarget)
    updateStatus.mutate({
      contactId,
      new_status: formField(data, 'new_status') as ContactStatus,
    })
  }

  return (
    <form onSubmit={submit}>
      {/* Keyed on the contact so the uncontrolled select picks up the new status. */}
      <select name="new_status" key={contactId} defaultValue={currentStatus}>
        {statusChoices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
      <button className="btn" disabled={updateStatus.isPending}>
        Update status
      </button>
      {errors?.new_status && <div className="error">{errors.new_status}</div>}
    </form>
  )
}
