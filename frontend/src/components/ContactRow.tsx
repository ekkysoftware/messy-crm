import { Link } from '@inertiajs/react'

import { formatCurrency } from '@/lib/format'
import type { ContactRow as ContactRowData } from '@/types'

interface ContactRowProps {
  contact: ContactRowData
}

export default function ContactRow({ contact }: ContactRowProps) {
  return (
    <Link
      className={contact.selected ? 'row selected' : 'row'}
      href={contact.url}
      preserveScroll
    >
      <span>
        <b>{contact.name}</b>
        <div className="muted">{contact.email}</div>
      </span>
      <span>{contact.company}</span>
      <span>
        <span className="pill">{contact.statusLabel}</span>
      </span>
      <span>{formatCurrency(contact.value)}</span>
    </Link>
  )
}
