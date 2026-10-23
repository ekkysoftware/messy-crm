import type {
  ContactDetail,
  ContactRow,
  DashboardProps,
  DashboardSummary,
  StatusChoice,
} from '../src/types'

export const filters = { q: '', status: '' }

export const statusChoices: StatusChoice[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'customer', label: 'Customer' },
  { value: 'inactive', label: 'Inactive' },
]

export const contactRow: ContactRow = {
  id: 1,
  name: 'Ekky Example',
  email: 'ekky@example.com',
  company: 'Altogether',
  phone: '+62 555 0100',
  status: 'lead',
  statusLabel: 'Lead',
  owner: 'Mina',
  value: 1000,
  selected: true,
  url: '/?contact=1',
}

export const contactDetail: ContactDetail = {
  id: 1,
  name: 'Ekky Example',
  email: 'ekky@example.com',
  company: 'Altogether',
  phone: '+62 555 0100',
  status: 'lead',
  owner: 'Mina',
  value: 1000,
  activities: [
    {
      kind: 'status',
      body: 'Status changed from lead to qualified',
      createdBy: 'Interview User',
      createdAt: '22 Oct 2026 10:00',
    },
    {
      kind: 'system',
      body: 'Contact created',
      createdBy: 'Interview User',
      createdAt: '21 Oct 2026 09:15',
    },
  ],
}

export const summary: DashboardSummary = {
  total: 1,
  pipeline: 1000,
  statusCounts: { lead: 1, qualified: 0, customer: 0, inactive: 0 },
}

export const dashboardProps: DashboardProps = {
  contacts: [contactRow],
  selected: contactDetail,
  filters,
  summary,
  statusChoices,
}
