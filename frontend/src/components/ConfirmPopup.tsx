import { useEffect } from 'react'

import Button from '@/components/Button'

interface ConfirmPopupProps {
  label: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A modal question with one affirmative and one dismissive answer.
 *
 * It replaces `window.confirm` because a suppressed native dialog returns false
 * without showing anything: the click is swallowed and the control looks dead.
 * Focus starts on Cancel so a stray Enter does not confirm.
 */
export default function ConfirmPopup({
  label,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmPopupProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="popup-backdrop" onClick={onCancel}>
      <div
        className="popup"
        role="alertdialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        <p>{label}</p>
        <div className="popup-actions">
          <Button label="Cancel" onClick={onCancel} autoFocus />
          <Button label={confirmLabel} variant="danger" onClick={onConfirm} />
        </div>
      </div>
    </div>
  )
}
