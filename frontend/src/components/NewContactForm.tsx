import { Form } from '@inertiajs/react'

import type { DashboardFilters, StatusChoice } from '@/types'

interface NewContactFormProps {
  filters: DashboardFilters
  statusChoices: StatusChoice[]
}

export default function NewContactForm({ filters, statusChoices }: NewContactFormProps) {
  return (
    <div className="newbox">
      <b>Add contact</b>
      <Form
        action="/contacts/"
        method="post"
        transform={(data) => ({ ...data, q: filters.q, status: filters.status })}
        options={{ preserveScroll: true }}
        resetOnSuccess
      >
        {({ errors, processing }) => (
          <>
            <input name="name" placeholder="Name" />
            <input name="email" placeholder="Email" />
            <input name="company" placeholder="Company" />
            <input name="owner" placeholder="Owner" />
            <input name="phone" placeholder="Phone" />
            <input name="value" placeholder="Value" />
            <select name="new_status" defaultValue="lead">
              {statusChoices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            <button className="btn" disabled={processing}>
              Add
            </button>
            {errors.name && <div className="error">{errors.name}</div>}
          </>
        )}
      </Form>
    </div>
  )
}
