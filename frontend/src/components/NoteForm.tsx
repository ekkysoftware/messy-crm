import { useRef, type FormEvent } from 'react'

import { formField } from '@/lib/formData'
import { useAddNoteMutation } from '@/mutations/useContactMutations'
import type { DashboardFilters } from '@/types'

interface NoteFormProps {
  contactId: number
  filters: DashboardFilters
}

export default function NoteForm({ contactId, filters }: NoteFormProps) {
  const addNote = useAddNoteMutation(filters)
  const formRef = useRef<HTMLFormElement>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (addNote.isPending) {
      return
    }

    const data = new FormData(event.currentTarget)
    addNote.mutate(
      { contactId, note: formField(data, 'note') },
      { onSuccess: () => formRef.current?.reset() },
    )
  }

  return (
    <form ref={formRef} onSubmit={submit}>
      <textarea name="note" placeholder="Add a note" />
      <button className="btn" disabled={addNote.isPending}>
        Save note
      </button>
    </form>
  )
}
