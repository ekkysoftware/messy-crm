import { usePage } from '@inertiajs/react'

import ContactDetail from '@/components/ContactDetail'
import ContactList from '@/components/ContactList'
import StatsRow from '@/components/StatsRow'
import Toast from '@/components/Toast'
import Toolbar from '@/components/Toolbar'
import { useDashboardView } from '@/queries/useDashboardView'

export default function Dashboard() {
  const { errors } = usePage().props
  const { contacts, selected, filters, summary, statusChoices } = useDashboardView()

  return (
    <>
      <div className="top">Jellybean CRM</div>
      <div className="wrap">
        <Toast />
        {Object.entries(errors ?? {}).map(([field, message]) => (
          <div className="error" key={field}>
            {message}
          </div>
        ))}
        <StatsRow total={summary.total} pipeline={summary.pipeline} />
        <Toolbar />
        <div className="grid">
          <ContactList contacts={contacts} filters={filters} statusChoices={statusChoices} />
          <ContactDetail selected={selected} filters={filters} statusChoices={statusChoices} />
        </div>
      </div>
    </>
  )
}
