import { Link } from '@inertiajs/react'

import { formatCurrency, initials } from '@/lib/format'
import type { ContactRow as ContactRowData } from '@/types'

interface ContactRowProps {
  contact: ContactRowData
}

export default function ContactRow({ contact }: ContactRowProps) {
  return (
    <Link className={contact.selected ? 'row selected' : 'row'} href={contact.url} preserveScroll>
      <span className="cell-contact">
        <span className={`avatar avatar-sm avatar-${contact.status}`} aria-hidden="true">
          {initials(contact.name)}
        </span>
        <span className="cell-name-block">
          <span className="cell-name">{contact.name}</span>
          <span className="cell-email">{contact.email}</span>
        </span>
      </span>
      <span className="cell-company">{contact.company}</span>
      <span>
        <span className={`pill pill-${contact.status}`}>{contact.statusLabel}</span>
      </span>
      <span className="cell-owner">
        {contact.owner && (
          <>
            <span className="avatar avatar-owner" title={contact.owner} aria-hidden="true">
              {initials(contact.owner)}
            </span>
            <span className="sr-only">Owner: {contact.owner}</span>
          </>
        )}
      </span>
      <span className="cell-value">{formatCurrency(contact.value)}</span>
    </Link>
  )
}
