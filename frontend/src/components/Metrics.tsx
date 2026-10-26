import { formatCurrency } from '@/lib/format'
import type { DashboardSummary } from '@/types'

interface MetricsProps {
  summary: DashboardSummary
}

/**
 * The four totals above the list. Average deal size is derived from the two
 * payload numbers the dashboard already receives.
 */
export default function Metrics({ summary }: MetricsProps) {
  const { total, pipeline, statusCounts } = summary
  const averageDeal = total > 0 ? Math.round(pipeline / total) : 0

  const metrics = [
    { label: 'All contacts', value: String(total) },
    { label: 'Pipeline value', value: formatCurrency(pipeline) },
    { label: 'Avg. deal size', value: formatCurrency(averageDeal) },
    { label: 'Customers', value: String(statusCounts.customer ?? 0) },
  ]

  return (
    <section className="metrics" aria-label="Summary">
      {metrics.map((metric) => (
        <div className="metric" key={metric.label}>
          <span className="metric-label">{metric.label}</span>
          <span className="metric-value">{metric.value}</span>
        </div>
      ))}
    </section>
  )
}
