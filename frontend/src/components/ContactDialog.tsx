import { useEffect, useRef } from 'react'

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
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  // Capture before the form's autoFocus moves focus during the commit.
  const openerRef = useRef(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = openerRef.current
    if (!dialog) return

    const focusableControls = () => {
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]',
        ),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(':disabled') &&
          !element.closest('[hidden], [inert]'),
      )
    }

    if (!dialog.contains(document.activeElement)) {
      const initialFocus = focusableControls()[0] ?? dialog
      initialFocus.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const controls = focusableControls()
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first) {
        event.preventDefault()
        dialog.focus()
      } else if (!controls.includes(document.activeElement as HTMLElement)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      opener?.focus()
    }
  }, [])

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
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
