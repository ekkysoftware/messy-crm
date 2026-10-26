import { describe, expect, it } from 'vitest'

import type { VisitSettlement } from '@/mutations/visitToPromise'
import { visitToPromise } from '@/mutations/visitToPromise'

function startVisit() {
  let settlement: VisitSettlement | undefined
  const promise = visitToPromise((callbacks) => {
    settlement = callbacks
  })

  if (!settlement) throw new Error('visit did not start')

  return { promise, settlement }
}

describe('visitToPromise', () => {
  it('resolves after success followed by finish', async () => {
    const { promise, settlement } = startVisit()

    settlement.onSuccess()
    settlement.onFinish()

    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects validation errors even when finish follows', async () => {
    const { promise, settlement } = startVisit()

    settlement.onError()
    settlement.onFinish()

    await expect(promise).rejects.toThrow('Visit failed validation')
  })

  it('rejects cancellation even when finish follows', async () => {
    const { promise, settlement } = startVisit()

    settlement.onCancel()
    settlement.onFinish()

    await expect(promise).rejects.toThrow('Visit cancelled')
  })

  it('rejects a visit that finishes without success', async () => {
    const { promise, settlement } = startVisit()

    settlement.onFinish()

    await expect(promise).rejects.toThrow('Visit finished without success')
  })
})
