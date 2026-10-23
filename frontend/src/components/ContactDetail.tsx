import { formatCurrency } from '@/lib/format'
import type { ContactDetail as ContactDetailData, DashboardFilters, StatusChoice } from '@/types'
import DeleteContactButton from '@/components/DeleteContactButton'
import NoteForm from '@/components/NoteForm'
import StatusForm from '@/components/StatusForm'

interface ContactDetailProps {
  selected: ContactDetailData | null
  filters: DashboardFilters
  statusChoices: StatusChoice[]
}

export default function ContactDetail({ selected, filters, statusChoices }: ContactDetailProps) {
  return (
    <div className="panel">
      <h2>Contact details</h2>
      <div className="detail">
        {selected ? (
          <>
            <h3>{selected.name}</h3>
            <dl>
              <dt>Company</dt>
              <dd>{selected.company}</dd>
              <dt>Email</dt>
              <dd>{selected.email}</dd>
              <dt>Phone</dt>
              <dd>{selected.phone}</dd>
              <dt>Owner</dt>
              <dd>{selected.owner}</dd>
              <dt>Value</dt>
              <dd>{formatCurrency(selected.value)}</dd>
            </dl>
            <div className="actions">
              <StatusForm
                contactId={selected.id}
                currentStatus={selected.status}
                filters={filters}
                statusChoices={statusChoices}
              />
              <NoteForm contactId={selected.id} filters={filters} />
              <DeleteContactButton contactId={selected.id} filters={filters} />
              <h4>Activity</h4>
              {selected.activities.map((activity, index) => (
                <p key={`${activity.createdAt}-${index}`}>
                  <span className="pill">{activity.kind}</span> {activity.body}
                  <br />
                  <span className="muted">{activity.createdAt}</span>
                </p>
              ))}
            </div>
          </>
        ) : (
          <p>Select a contact.</p>
        )}
      </div>
    </div>
  )
}
