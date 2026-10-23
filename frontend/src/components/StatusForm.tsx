import { Form } from '@inertiajs/react'

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
  return (
    <Form
      action={`/contacts/${contactId}/status/`}
      method="patch"
      transform={(data) => ({ ...data, q: filters.q, status: filters.status })}
      options={{ preserveScroll: true }}
    >
      {({ errors, processing }) => (
        <>
          {/* Keyed on the contact so the uncontrolled select picks up the new status. */}
          <select name="new_status" key={contactId} defaultValue={currentStatus}>
            {statusChoices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
          <button className="btn" disabled={processing}>
            Update status
          </button>
          {errors.new_status && <div className="error">{errors.new_status}</div>}
        </>
      )}
    </Form>
  )
}
