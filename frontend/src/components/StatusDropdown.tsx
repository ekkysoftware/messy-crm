import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import type { ContactStatus } from '@/types'

export interface StatusOption<T extends string> {
  value: T
  label: string
  /** Dot colour for a status; `null` keeps an empty slot for "All statuses". */
  tone?: ContactStatus | null
}

interface StatusDropdownProps<T extends string> {
  value: T
  options: StatusOption<T>[]
  onSelect: (value: T) => void
  triggerClassName: string
  ariaLabel: string
  label?: string
  disabled?: boolean
  align?: 'start' | 'end'
}

/**
 * The status menu: a trigger plus the floating panel from the design. Picking
 * an option closes the menu; picking the current value closes it without a write.
 */
export default function StatusDropdown<T extends string>({
  value,
  options,
  onSelect,
  triggerClassName,
  ariaLabel,
  label = 'STATUS',
  disabled = false,
  align = 'start',
}: StatusDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const currentLabel = options.find((option) => option.value === value)?.label ?? value

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    }
  }, [open])

  function select(next: T) {
    setOpen(false)
    triggerRef.current?.focus()
    if (next !== value) {
      onSelect(next)
    }
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return
    }

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
    )
    if (items.length === 0) {
      return
    }

    event.preventDefault()
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const last = items.length - 1
    const next =
      event.key === 'ArrowDown'
        ? index === -1 || index === last
          ? 0
          : index + 1
        : index === -1 || index === 0
          ? last
          : index - 1
    items[next]?.focus()
  }

  return (
    <div className="status-dropdown" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${currentLabel}`}
        disabled={disabled}
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        {currentLabel}
        <ChevronDown size={11} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={align === 'end' ? 'status-menu is-end' : 'status-menu'}
          role="menu"
          aria-label={ariaLabel}
          ref={menuRef}
          onKeyDown={moveFocus}
        >
          <p className="status-menu-label">{label}</p>
          <div className="status-menu-options">
            {options.map((option) => {
              const isCurrent = option.value === value

              return (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  className={isCurrent ? 'status-menu-option is-current' : 'status-menu-option'}
                  onClick={() => select(option.value)}
                >
                  <span
                    className={
                      option.tone
                        ? `status-dot status-dot-${option.tone}`
                        : 'status-dot is-empty'
                    }
                    aria-hidden="true"
                  />
                  {option.label}
                  <span className="status-menu-spacer" />
                  {isCurrent && <Check size={13} className="status-menu-check" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
