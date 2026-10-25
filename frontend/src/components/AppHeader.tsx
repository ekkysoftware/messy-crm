import { Search, UserRound } from 'lucide-react'
import { useEffect, useRef } from 'react'

/** Public asset: served by Vite in dev and from dist/static in production. */
const APP_ICON = `${import.meta.env.BASE_URL}logo.png`

interface AppHeaderProps {
  q: string
  onQChange: (q: string) => void
  onSubmit: () => void
}

/** Top bar: brand, the contact search and the account affordances. */
export default function AppHeader({ q, onQChange, onSubmit }: AppHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <header className="topbar">
      <img className="mark" src={APP_ICON} alt="" width={22} height={22} />
      <span className="wordmark">Jellybean</span>
      <form
        className="topbar-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <Search size={14} aria-hidden="true" />
        <input
          ref={inputRef}
          name="q"
          aria-label="Search contacts"
          placeholder="Search contacts, companies or email"
          value={q}
          onChange={(event) => onQChange(event.target.value)}
        />
      </form>
      <span className="topbar-spacer" />
      <div className="topbar-account">
        <span className="topbar-shortcut">⌘ K</span>
        <span className="avatar avatar-account" aria-hidden="true">
          <UserRound size={14} />
        </span>
      </div>
    </header>
  )
}
