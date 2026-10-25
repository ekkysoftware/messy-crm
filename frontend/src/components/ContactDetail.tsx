import {
  Building2,
  CircleDollarSign,
  CircleDot,
  Mail,
  Phone,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'

import ConfirmPopup from '@/components/ConfirmPopup'
import NoteForm from '@/components/NoteForm'
import StatusForm from '@/components/StatusForm'
import { formatCurrency, initials } from '@/lib/format'
import { useDeleteContactMutation } from '@/mutations/useContactMutations'
import type { ContactDetail as ContactDetailData, DashboardFilters, StatusChoice } from '@/types'

interface ContactDetailProps {
  selected: ContactDetailData | null
  filters: DashboardFilters
  statusChoices: StatusChoice[]
}

export default function ContactDetail({ selected, filters, statusChoices }: ContactDetailProps) {
  const deleteContact = useDeleteContactMutation(filters)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function confirmDelete(contactId: number) {
    setConfirmingDelete(false)
    deleteContact.mutate({ contactId })
  }

  if (!selected) {
    return (
      <aside className="panel detail-panel">
        <p className="detail-empty">Select a contact.</p>
      </aside>
    )
  }

  const activityCount = selected.activities.length

  return (
    <aside className="panel detail-panel">
      <div className="detail-header">
        <span className={`avatar avatar-lg avatar-${selected.status}`} aria-hidden="true">
          {initials(selected.name)}
        </span>
        <div className="detail-title">
          <h2 className="detail-name">{selected.name}</h2>
          <p className="detail-meta">{selected.company || 'No company'}</p>
        </div>
        <div className="detail-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="Delete contact"
            title="Delete contact"
            disabled={deleteContact.isPending}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <dl className="attributes">
        <div className="attr">
          <Mail size={14} aria-hidden="true" />
          <dt>Email</dt>
          <dd>{selected.email || '—'}</dd>
        </div>
        <div className="attr">
          <Phone size={14} aria-hidden="true" />
          <dt>Phone</dt>
          <dd>{selected.phone || '—'}</dd>
        </div>
        <div className="attr">
          <Building2 size={14} aria-hidden="true" />
          <dt>Company</dt>
          <dd>{selected.company || '—'}</dd>
        </div>
        <div className="attr">
          <UserRound size={14} aria-hidden="true" />
          <dt>Owner</dt>
          <dd>{selected.owner || '—'}</dd>
        </div>
        <div className="attr">
          <CircleDollarSign size={14} aria-hidden="true" />
          <dt>Value</dt>
          <dd>{formatCurrency(selected.value)}</dd>
        </div>
        <div className="attr attr-status">
          <CircleDot size={14} aria-hidden="true" />
          <dt>Status</dt>
          <dd>
            <StatusForm
              key={selected.id}
              contactId={selected.id}
              currentStatus={selected.status}
              filters={filters}
              statusChoices={statusChoices}
            />
          </dd>
        </div>
      </dl>

      <div className="detail-spacer" />

      <section className="note-block">
        <h3 className="section-label">NOTE</h3>
        <NoteForm contactId={selected.id} filters={filters} />
      </section>

      <section className="activity">
        <div className="activity-header">
          <h3 className="section-label">ACTIVITY</h3>
          <span className="activity-count">{activityCount === 1 ? '1 event' : `${activityCount} events`}</span>
        </div>
        {selected.activities.map((activity, index) => (
          <div className="event" key={`${activity.createdAt}-${index}`}>
            <span
              className={
                activity.kind === 'status' ? 'event-dot event-dot-status' : 'event-dot'
              }
              aria-hidden="true"
            />
            <div className="event-text">
              <p className="event-body">{activity.body}</p>
              <span className="event-time">{activity.createdAt}</span>
            </div>
          </div>
        ))}
        {activityCount === 0 && <p className="activity-empty">No activity yet.</p>}
      </section>

      {confirmingDelete && (
        <ConfirmPopup
          label="Delete this contact?"
          confirmLabel="Delete"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => confirmDelete(selected.id)}
        />
      )}
    </aside>
  )
}
