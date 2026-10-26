import { UserRound } from 'lucide-react'

/** Public asset: served by Vite in dev and from dist/static in production. */
const APP_ICON = `${import.meta.env.BASE_URL}logo.png`

/** Top bar: brand and the account affordances. */
export default function AppHeader() {
  return (
    <header className="topbar">
      <img className="mark" src={APP_ICON} alt="" width={22} height={22} />
      <span className="wordmark">Jellybean</span>
      <span className="topbar-spacer" />
      <div className="topbar-account">
        <span className="avatar avatar-account" aria-hidden="true">
          <UserRound size={14} />
        </span>
      </div>
    </header>
  )
}
