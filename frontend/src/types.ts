import '@inertiajs/core'

export type ContactStatus = 'lead' | 'qualified' | 'customer' | 'inactive'

export interface StatusChoice {
  value: ContactStatus
  label: string
}

export interface ContactActivity {
  kind: string
  body: string
  createdBy: string
  createdAt: string
}

export interface ContactRow {
  id: number
  name: string
  email: string
  company: string
  phone: string
  status: ContactStatus
  statusLabel: string
  owner: string
  value: number
  selected: boolean
  url: string
}

export interface ContactDetail {
  id: number
  name: string
  email: string
  company: string
  phone: string
  status: ContactStatus
  owner: string
  value: number
  activities: ContactActivity[]
}

export interface DashboardFilters {
  q: string
  status: string
}

export interface DashboardSummary {
  total: number
  pipeline: number
  statusCounts: Record<string, number>
}

export interface DashboardProps {
  contacts: ContactRow[]
  selected: ContactDetail | null
  filters: DashboardFilters
  summary: DashboardSummary
  statusChoices: StatusChoice[]
}

export type FlashLevel = 'debug' | 'info' | 'success' | 'warning' | 'error'

export interface FlashMessage {
  level: FlashLevel
  message: string
}

declare module '@inertiajs/core' {
  export interface InertiaConfig {
    sharedPageProps: {
      errors?: Record<string, string>
    }
    flashDataType: {
      messages?: FlashMessage[]
    }
  }
}
