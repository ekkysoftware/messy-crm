import { Form } from '@inertiajs/react'

import type { DashboardFilters } from '@/types'

interface NoteFormProps {
  contactId: number
  filters: DashboardFilters
}

export default function NoteForm({ contactId, filters }: NoteFormProps) {
  return (
    <Form
      action={`/contacts/${contactId}/notes/`}
      method="post"
      transform={(data) => ({ ...data, q: filters.q, status: filters.status })}
      options={{ preserveScroll: true }}
      resetOnSuccess
    >
      {({ processing }) => (
        <>
          <textarea name="note" placeholder="Add a note" />
          <button className="btn" disabled={processing}>
            Save note
          </button>
        </>
      )}
    </Form>
  )
}
