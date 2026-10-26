export interface VisitSettlement {
  onSuccess: () => void
  onFinish: () => void
  onCancel: () => void
  onError: () => void
}

/**
 * Converts an Inertia visit into a promise for React Query.
 *
 * Only a successful visit resolves. Validation errors, cancellation, and visits
 * that finish without success reject so form success handlers do not run.
 */
export function visitToPromise(start: (settlement: VisitSettlement) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false

    const settle = (error?: Error) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolve()
    }

    start({
      onSuccess: () => settle(),
      onError: () => settle(new Error('Visit failed validation')),
      onCancel: () => settle(new Error('Visit cancelled')),
      onFinish: () => settle(new Error('Visit finished without success')),
    })
  })
}
