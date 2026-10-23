import { formatCurrency } from '@/lib/format'

interface StatsRowProps {
  total: number
  pipeline: number
}

export default function StatsRow({ total, pipeline }: StatsRowProps) {
  return (
    <div className="stats">
      <div className="stat">
        <b>{total}</b>
        <div className="muted">All contacts</div>
      </div>
      <div className="stat">
        <b>{formatCurrency(pipeline)}</b>
        <div className="muted">Pipeline value</div>
      </div>
    </div>
  )
}
