import { useEffect } from 'react'

import ContactForm from '@/components/ContactForm'
import type { ContactDetail, DashboardFilters, StatusChoice } from '@/types'

interface ContactDialogProps {
  filters: DashboardFilters
  statusChoices: StatusChoice[]
  /** When present the dialog edits this contact; otherwise it creates one. */
  contact?: ContactDetail | null
  onClose: () => void
}

/** Modal wrapper around the create/edit form, opened from the page or detail panel. */
export default function ContactDialog({
  filters,
  statusChoices,
  contact,
  onClose,
}: ContactDialogProps) {
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
        aria-labelledby="contact-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <ContactForm
          filters={filters}
          statusChoices={statusChoices}
          contact={contact}
          onCancel={onClose}
          onSaved={onClose}
        />
      </div>
    </div>
  )
}
