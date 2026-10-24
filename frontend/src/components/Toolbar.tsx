import { router } from '@inertiajs/react'
import { useState, type FormEvent } from 'react'

import { useDashboardView } from '@/queries/useDashboardView'

export default function Toolbar() {
  const { filters, statusChoices } = useDashboardView()
  const [q, setQ] = useState(filters.q)
  const [status, setStatus] = useState(filters.status)

  function navigate(nextQuery: string, nextStatus: string) {
    const params: Record<string, string> = {}
    if (nextQuery.trim()) {
      params.q = nextQuery.trim()
    }
    if (nextStatus) {
      params.status = nextStatus
    }

    router.get('/', params, { preserveState: true, preserveScroll: true, replace: true })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(q, status)
  }

  function changeStatus(nextStatus: string) {
    setStatus(nextStatus)
    navigate(q, nextStatus)
  }

  return (
    <div className="toolbar">
      <form role="search" onSubmit={submit}>
        <input
          name="q"
          value={q}
          placeholder="Search name, company, email"
          onChange={(event) => setQ(event.target.value)}
        />
        <select
          name="status"
          value={status}
          onChange={(event) => changeStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {statusChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
        <button className="btn">Search</button>
        <a href="/export/" style={{ padding: 9 }}>
          Export CSV
        </a>
      </form>
    </div>
  )
}
