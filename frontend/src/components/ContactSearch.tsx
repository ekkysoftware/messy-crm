import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ContactSearchProps {
  q: string
  onQChange: (q: string) => void
  onSubmit: () => void
}

/** Search draft for the contact list, focused with Cmd/Ctrl+K. */
export default function ContactSearch({ q, onQChange, onSubmit }: ContactSearchProps) {
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
    <form
      className="contact-search"
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
      <kbd className="contact-search-shortcut" aria-hidden="true">
        ⌘ K
      </kbd>
    </form>
  )
}
