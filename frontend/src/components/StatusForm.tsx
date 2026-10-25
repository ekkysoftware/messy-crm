import { usePage } from '@inertiajs/react'

import StatusDropdown from '@/components/StatusDropdown'
import { useUpdateStatusMutation } from '@/mutations/useContactMutations'
import type { ContactStatus, DashboardFilters, StatusChoice } from '@/types'

interface StatusFormProps {
  contactId: number
  currentStatus: ContactStatus
  filters: DashboardFilters
  statusChoices: StatusChoice[]
}

/**
 * The status pill opens the status menu; picking a status saves it and closes
 * the menu, so the selection is the confirmation.
 */
export default function StatusForm({
  contactId,
  currentStatus,
  filters,
  statusChoices,
}: StatusFormProps) {
  const { errors } = usePage().props
  const updateStatus = useUpdateStatusMutation(filters)

  return (
    <>
      <StatusDropdown<ContactStatus>
        value={currentStatus}
        options={statusChoices.map((choice) => ({
          value: choice.value,
          label: choice.label,
          tone: choice.value,
        }))}
        onSelect={(status) => updateStatus.mutate({ contactId, new_status: status })}
        triggerClassName={`status-trigger pill-${currentStatus}`}
        ariaLabel="Status"
        disabled={updateStatus.isPending}
      />
      {errors?.new_status && <div className="error">{errors.new_status}</div>}
    </>
  )
}
