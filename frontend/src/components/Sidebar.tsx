import {
  Briefcase,
  Building2,
  ChartColumn,
  Clock3,
  ListChecks,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  label: string
  icon: LucideIcon
}

const RECORDS: NavItem[] = [
  { label: 'Contacts', icon: Users },
  { label: 'Companies', icon: Building2 },
  { label: 'Deals', icon: Briefcase },
  { label: 'Tasks', icon: ListChecks },
]

const VIEWS: NavItem[] = [
  { label: 'My pipeline', icon: ChartColumn },
  { label: 'Recently added', icon: Clock3 },
]

/**
 * Section navigation. Only the contacts screen exists, so every other entry is
 * rendered as a disabled placeholder instead of a link that goes nowhere.
 */
export default function Sidebar() {
  return (
    <aside className="sidebar">
      <p className="nav-section">RECORDS</p>
      {RECORDS.map((item) => (
        <NavEntry key={item.label} {...item} active={item.label === 'Contacts'} />
      ))}

      <p className="nav-section">VIEWS</p>
      {VIEWS.map((item) => (
        <NavEntry key={item.label} {...item} />
      ))}

      <span className="sidebar-spacer" />
      <NavEntry label="Settings" icon={Settings} />
    </aside>
  )
}

function NavEntry({ label, icon: Icon, active = false }: NavItem & { active?: boolean }) {
  if (active) {
    return (
      <span className="nav-item nav-item-active" aria-current="page">
        <Icon size={15} aria-hidden="true" />
        {label}
      </span>
    )
  }

  return (
    <button type="button" className="nav-item" disabled>
      <Icon size={15} aria-hidden="true" />
      {label}
    </button>
  )
}
