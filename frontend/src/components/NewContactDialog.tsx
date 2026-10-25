import { useEffect } from 'react'

import NewContactForm from '@/components/NewContactForm'
import type { DashboardFilters, StatusChoice } from '@/types'

interface NewContactDialogProps {
  filters: DashboardFilters
  statusChoices: StatusChoice[]
  onClose: () => void
}

/** Modal wrapper around the create form, opened from the page header or the list footer. */
export default function NewContactDialog({
  filters,
  statusChoices,
  onClose,
}: NewContactDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-contact-title"
        onClick={(event) => event.stopPropagation()}
      >
        <NewContactForm
          filters={filters}
          statusChoices={statusChoices}
          onCancel={onClose}
          onCreated={onClose}
        />
      </div>
    </div>
  )
}
