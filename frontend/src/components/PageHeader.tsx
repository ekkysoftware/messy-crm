import { Download, Plus } from 'lucide-react'

interface PageHeaderProps {
  total: number
  onNewContact: () => void
}

export default function PageHeader({ total, onNewContact }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-title-block">
        <h1 className="page-title">Contacts</h1>
        <p className="page-subtitle">
          {total === 1 ? '1 contact' : `${total} contacts`} in your workspace
        </p>
      </div>
      <div className="page-actions">
        <a className="btn btn-secondary" href="/export/">
          <Download size={13} aria-hidden="true" />
          Export CSV
        </a>
        <button type="button" className="btn" onClick={onNewContact}>
          <Plus size={14} aria-hidden="true" />
          New contact
        </button>
      </div>
    </div>
  )
}
