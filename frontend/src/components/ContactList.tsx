import type { ContactRow as ContactRowData, DashboardFilters, StatusChoice } from '@/types'
import ContactRow from '@/components/ContactRow'
import NewContactForm from '@/components/NewContactForm'

interface ContactListProps {
  contacts: ContactRowData[]
  filters: DashboardFilters
  statusChoices: StatusChoice[]
}

export default function ContactList({ contacts, filters, statusChoices }: ContactListProps) {
  return (
    <div className="panel">
      <h2>Contacts</h2>
      <div className="list">
        {contacts.map((contact) => (
          <ContactRow key={contact.id} contact={contact} />
        ))}
        {contacts.length === 0 && <p style={{ padding: 20 }}>No contacts found.</p>}
      </div>
      <NewContactForm filters={filters} statusChoices={statusChoices} />
    </div>
  )
}
