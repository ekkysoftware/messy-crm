import { usePage } from '@inertiajs/react'
import { useState } from 'react'

import AppHeader from '@/components/AppHeader'
import ContactDetail from '@/components/ContactDetail'
import ContactDialog from '@/components/ContactDialog'
import ContactList from '@/components/ContactList'
import Metrics from '@/components/Metrics'
import PageHeader from '@/components/PageHeader'
import Sidebar from '@/components/Sidebar'
import Toast from '@/components/Toast'
import { navigateToContacts } from '@/lib/navigate'
import { useDashboardView } from '@/queries/useDashboardView'

export default function Dashboard() {
  const { errors } = usePage().props
  const { contacts, selected, filters, summary, statusChoices } = useDashboardView()
  const [q, setQ] = useState(filters.q)
  const [status, setStatus] = useState(filters.status)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)

  function applyFilters(nextQuery: string, nextStatus: string) {
    setQ(nextQuery)
    setStatus(nextStatus)
    navigateToContacts(nextQuery, nextStatus)
  }

  return (
    <div className="app">
      <AppHeader q={q} onQChange={setQ} onSubmit={() => applyFilters(q, status)} />

      <div className="app-body">
        <Sidebar />
        <main className="main">
          <Toast />
          {Object.entries(errors ?? {}).map(([field, message]) => (
            <div className="error" key={field}>
              {message}
            </div>
          ))}

          <PageHeader total={summary.total} onNewContact={() => setCreating(true)} />
          <Metrics summary={summary} />

          <div className="split">
            <ContactList
              contacts={contacts}
              total={summary.total}
              status={status}
              statusChoices={statusChoices}
              onStatusChange={(nextStatus) => applyFilters(q, nextStatus)}
              onNewContact={() => setCreating(true)}
            />
            <ContactDetail
              selected={selected}
              filters={filters}
              statusChoices={statusChoices}
              onEdit={() => setEditing(true)}
            />
          </div>
        </main>
      </div>

      {creating && (
        <ContactDialog
          filters={filters}
          statusChoices={statusChoices}
          onClose={() => setCreating(false)}
        />
      )}

      {editing && selected && (
        <ContactDialog
          contact={selected}
          filters={filters}
          statusChoices={statusChoices}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
