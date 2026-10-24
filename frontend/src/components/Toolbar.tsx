import { router } from '@inertiajs/react'
import { useState, type FormEvent } from 'react'

import { useDashboardView } from '@/queries/useDashboardView'

export default function Toolbar() {
  const { filters, statusChoices } = useDashboardView()
  const [q, setQ] = useState(filters.q)
  const [status, setStatus] = useState(filters.status)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const params: Record<string, string> = {}
    if (q.trim()) {
      params.q = q.trim()
    }
    if (status) {
      params.status = status
    }

    router.get('/', params, { preserveState: true, preserveScroll: true, replace: true })
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
        <select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
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
