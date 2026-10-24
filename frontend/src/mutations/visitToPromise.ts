export interface VisitSettlement {
  onFinish: () => void
  onCancel: () => void
  /**
   * Deliberately inert. This backend reports validation by redirecting with
   * errors, so Inertia's error event must not settle or reject a write: doing
   * so would leave the submit control disabled after a rejected form.
   */
  onError: () => void
}

/**
 * Converts an Inertia visit into a promise for React Query.
 *
 * A visit settles when it finishes or is cancelled. It never rejects: the
 * redirect that carries validation errors is still a completed visit.
 */
export function visitToPromise(start: (settlement: VisitSettlement) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false

    const settle = () => {
      if (settled) return
      settled = true
      resolve()
    }

    start({ onFinish: settle, onCancel: settle, onError: () => {} })
  })
}
