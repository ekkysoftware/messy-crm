import { usePage } from '@inertiajs/react'
import { useRef, type FormEvent } from 'react'

import { formField } from '@/lib/formData'
import { useCreateContactMutation } from '@/mutations/useContactMutations'
import type { ContactStatus, DashboardFilters, StatusChoice } from '@/types'

interface NewContactFormProps {
  filters: DashboardFilters
  statusChoices: StatusChoice[]
}

export default function NewContactForm({ filters, statusChoices }: NewContactFormProps) {
  const { errors } = usePage().props
  const createContact = useCreateContactMutation(filters)
  const formRef = useRef<HTMLFormElement>(null)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (createContact.isPending) {
      return
    }

    const data = new FormData(event.currentTarget)
    createContact.mutate(
      {
        name: formField(data, 'name'),
        email: formField(data, 'email'),
        company: formField(data, 'company'),
        owner: formField(data, 'owner'),
        phone: formField(data, 'phone'),
        value: formField(data, 'value'),
        new_status: formField(data, 'new_status') as ContactStatus,
      },
      // `resetOnSuccess` reset after any completed visit, including a redirect
      // carrying validation errors; keep that behavior.
      { onSuccess: () => formRef.current?.reset() },
    )
  }

  return (
    <div className="newbox">
      <b>Add contact</b>
      <form ref={formRef} onSubmit={submit}>
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
        <button className="btn" disabled={createContact.isPending}>
          Add
        </button>
        {errors?.name && <div className="error">{errors.name}</div>}
      </form>
    </div>
  )
}
