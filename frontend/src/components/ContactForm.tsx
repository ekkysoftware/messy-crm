import { usePage } from '@inertiajs/react'
import { Check, Plus, UserRound, X } from 'lucide-react'
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { formField } from '@/lib/formData'
import { initials } from '@/lib/format'
import {
  useCreateContactMutation,
  useUpdateContactMutation,
} from '@/mutations/useContactMutations'
import type {
  ContactDetail as ContactDetailData,
  ContactStatus,
  DashboardFilters,
  StatusChoice,
} from '@/types'

interface ContactFormProps {
  filters: DashboardFilters
  statusChoices: StatusChoice[]
  /** When present the form edits this contact; otherwise it creates one. */
  contact?: ContactDetailData | null
  onCancel?: () => void
  onSaved?: () => void
}

/**
 * The create/edit contact dialog. `name` and `owner` are mirrored in state only
 * to preview their initials; every field still submits through FormData.
 */
export default function ContactForm({
  filters,
  statusChoices,
  contact,
  onCancel,
  onSaved,
}: ContactFormProps) {
  const { errors } = usePage().props
  const createContact = useCreateContactMutation(filters)
  const updateContact = useUpdateContactMutation(filters)
  const formRef = useRef<HTMLFormElement>(null)
  const [name, setName] = useState(contact?.name ?? '')
  const [owner, setOwner] = useState(contact?.owner ?? '')
  const [status, setStatus] = useState<ContactStatus>(contact?.status ?? 'lead')

  const isEditing = Boolean(contact)
  const saving = createContact.isPending || updateContact.isPending

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) {
      return
    }

    const data = new FormData(event.currentTarget)
    const input = {
      name: formField(data, 'name'),
      email: formField(data, 'email'),
      company: formField(data, 'company'),
      owner: formField(data, 'owner'),
      phone: formField(data, 'phone'),
      value: formField(data, 'value'),
      new_status: formField(data, 'new_status') as ContactStatus,
    }

    if (contact) {
      updateContact.mutate(
        { contactId: contact.id, ...input },
        { onSuccess: () => onSaved?.() },
      )
      return
    }

    createContact.mutate(input, {
      onSuccess: () => {
        formRef.current?.reset()
        setName('')
        setOwner('')
        setStatus('lead')
        onSaved?.()
      },
    })
  }

  function submitWithShortcut(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  return (
    <form className="dialog-form" ref={formRef} onSubmit={submit} onKeyDown={submitWithShortcut}>
      <div className="dialog-header">
        <div className="dialog-heading">
          <span className="dialog-avatar" aria-hidden="true">
            <Initials name={name} fallbackSize={14} />
          </span>
          <div>
            <h2 className="dialog-title" id="contact-form-title">
              {isEditing ? 'Edit contact' : 'New contact'}
            </h2>
            <p className="dialog-subtitle">
              {isEditing ? 'Update this contact' : 'Add a record to All contacts'}
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            className="dialog-close"
            aria-label="Close"
            onClick={onCancel}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="dialog-body">
        <section className="form-section">
          <h3 className="form-section-label">CONTACT</h3>
          <div className="form-row">
            <div className="form-field">
              <div className="form-label">
                <label htmlFor="contact-name">Name</label>
                <span className="form-required" aria-hidden="true">
                  *
                </span>
              </div>
              <input
                id="contact-name"
                className="form-input"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
              {errors?.name && <span className="field-error">{errors.name}</span>}
            </div>
            <div className="form-field">
              <div className="form-label">
                <label htmlFor="contact-email">Email</label>
              </div>
              <input
                id="contact-email"
                className="form-input"
                name="email"
                type="text"
                placeholder="name@company.com"
                defaultValue={contact?.email ?? ''}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <div className="form-label">
                <label htmlFor="contact-company">Company</label>
              </div>
              <input
                id="contact-company"
                className="form-input"
                name="company"
                placeholder="Company name"
                defaultValue={contact?.company ?? ''}
              />
            </div>
            <div className="form-field">
              <div className="form-label">
                <label htmlFor="contact-phone">Phone</label>
              </div>
              <input
                id="contact-phone"
                className="form-input"
                name="phone"
                placeholder="Add phone"
                defaultValue={contact?.phone ?? ''}
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section-label">DEAL</h3>
          <div className="form-row">
            <div className="form-field">
              <div className="form-label">
                <label htmlFor="contact-owner">Owner</label>
              </div>
              <div className="input-box">
                <span className="owner-chip" aria-hidden="true">
                  <Initials name={owner} fallbackSize={12} />
                </span>
                <input
                  id="contact-owner"
                  className="bare-input"
                  name="owner"
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  placeholder="Unassigned"
                />
              </div>
            </div>
            <div className="form-field">
              <div className="form-label">
                <label htmlFor="contact-value">Deal value</label>
              </div>
              <div className="input-box">
                <span className="input-affix" aria-hidden="true">
                  $
                </span>
                <input
                  id="contact-value"
                  className="bare-input"
                  name="value"
                  inputMode="decimal"
                  placeholder="0"
                  defaultValue={contact ? String(contact.value) : ''}
                />
                <span className="input-affix input-affix-end" aria-hidden="true">
                  USD
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="form-section">
          <h3 className="form-section-label">STATUS</h3>
          <div className="status-options" role="radiogroup" aria-label="Status">
            {statusChoices.map((choice) => (
              <label
                key={choice.value}
                className={`status-option status-option-${choice.value}${
                  status === choice.value ? ' is-selected' : ''
                }`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="new_status"
                  value={choice.value}
                  checked={status === choice.value}
                  onChange={() => setStatus(choice.value)}
                />
                <span className={`status-dot status-dot-${choice.value}`} aria-hidden="true" />
                {choice.label}
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="dialog-footer">
        <span className="dialog-hint">
          {isEditing ? '⌘ ↵ to save' : '⌘ ↵ to create'}
        </span>
        <div className="dialog-actions">
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="btn" disabled={saving}>
            {isEditing ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <Plus size={13} aria-hidden="true" />
            )}
            {isEditing ? 'Save changes' : 'Create contact'}
          </button>
        </div>
      </div>
    </form>
  )
}

/** Initials of the value being typed, or a person icon while it is empty. */
function Initials({ name, fallbackSize }: { name: string; fallbackSize: number }) {
  if (!name.trim()) {
    return <UserRound size={fallbackSize} />
  }

  return <>{initials(name)}</>
}
