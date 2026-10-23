import { useEffect, useState } from 'react'
import { usePage } from '@inertiajs/react'

import type { FlashLevel, FlashMessage } from '@/types'

const TOAST_DURATION_MS = 5000

const KNOWN_LEVELS: readonly string[] = ['success', 'info', 'warning', 'error']
const ALERT_LEVELS: readonly FlashLevel[] = ['warning', 'error']

/** Unknown levels must not break rendering; Django may add levels later. */
function normalizeLevel(level: string): FlashLevel {
  return KNOWN_LEVELS.includes(level) ? (level as FlashLevel) : 'info'
}

/**
 * One-shot confirmations carried as top-level page flash data.
 *
 * Flash is not a prop, and the client only normalizes flash for the initial
 * page, so `usePage().flash` can be undefined after a visit without messages.
 *
 * Each toast dismisses itself; dismissal is presentational only and never
 * mutates the page payload. Reseeding on page identity means a new visit shows
 * its own messages again, even when the text repeats an earlier confirmation.
 */
export default function Toast() {
  const page = usePage()
  const [visible, setVisible] = useState<FlashMessage[]>(page.flash?.messages ?? [])

  useEffect(() => {
    const messages = page.flash?.messages ?? []
    setVisible(messages)

    const timers = messages.map((message) =>
      window.setTimeout(() => {
        setVisible((current) => current.filter((item) => item !== message))
      }, TOAST_DURATION_MS),
    )

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [page])

  if (visible.length === 0) return null

  return (
    <div className="toast-region">
      {visible.map((message, index) => {
        const level = normalizeLevel(message.level)

        return (
          <div
            className={`toast toast-${level}`}
            key={`${level}-${index}-${message.message}`}
            role={ALERT_LEVELS.includes(level) ? 'alert' : 'status'}
          >
            {message.message}
          </div>
        )
      })}
    </div>
  )
}
