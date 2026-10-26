import { Plus } from 'lucide-react'

import ContactRow from '@/components/ContactRow'
import ContactSearch from '@/components/ContactSearch'
import StatusDropdown from '@/components/StatusDropdown'
import type { ContactRow as ContactRowData, StatusChoice } from '@/types'

interface ContactListProps {
  contacts: ContactRowData[]
  total: number
  q: string
  status: string
  statusChoices: StatusChoice[]
  onQChange: (q: string) => void
  onSearch: () => void
  onStatusChange: (status: string) => void
  onNewContact: () => void
}

export default function ContactList({
  contacts,
  total,
  q,
  status,
  statusChoices,
  onQChange,
  onSearch,
  onStatusChange,
  onNewContact,
}: ContactListProps) {
  return (
    <div className="panel list-panel">
      <div className="list-header">
        <div className="list-title">
          All contacts
          <span className="count-chip">{contacts.length}</span>
        </div>
        <StatusDropdown<string>
          value={status}
          options={[
            { value: '', label: 'All statuses', tone: null },
            ...statusChoices.map((choice) => ({
              value: choice.value,
              label: choice.label,
              tone: choice.value,
            })),
          ]}
          onSelect={onStatusChange}
          triggerClassName="status-filter"
          ariaLabel="Status filter"
          align="end"
        />
      </div>

      <div className="list-search-row">
        <ContactSearch q={q} onQChange={onQChange} onSubmit={onSearch} />
      </div>

      <div className="list-columns" aria-hidden="true">
        <span>Contact</span>
        <span className="col-company">Company</span>
        <span>Status</span>
        <span className="col-owner">Owner</span>
        <span className="col-value">Value</span>
      </div>

      <div className="list-scroll">
        {contacts.map((contact) => (
          <ContactRow key={contact.id} contact={contact} />
        ))}
        {contacts.length === 0 && <p className="list-empty">No contacts found.</p>}
      </div>

      <div className="list-footer">
        <button type="button" className="add-contact" onClick={onNewContact}>
          <Plus size={13} aria-hidden="true" />
          Add contact
        </button>
        <span className="list-count">
          Showing {contacts.length} of {total}
        </span>
      </div>
    </div>
  )
}
