import { usePage } from '@inertiajs/react'

import ContactDetail from '@/components/ContactDetail'
import ContactList from '@/components/ContactList'
import StatsRow from '@/components/StatsRow'
import Toast from '@/components/Toast'
import Toolbar from '@/components/Toolbar'
import type { DashboardProps } from '@/types'

export default function Dashboard({
  contacts,
  selected,
  filters,
  summary,
  statusChoices,
}: DashboardProps) {
  const { errors } = usePage().props

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
        <Toolbar filters={filters} statusChoices={statusChoices} />
        <div className="grid">
          <ContactList contacts={contacts} filters={filters} statusChoices={statusChoices} />
          <ContactDetail selected={selected} filters={filters} statusChoices={statusChoices} />
        </div>
      </div>
    </>
  )
}
