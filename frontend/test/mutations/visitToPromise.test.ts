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

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('visitToPromise', () => {
  it('resolves when the visit finishes', async () => {
    const { promise, settlement } = startVisit()
    let settled = false
    void promise.then(() => {
      settled = true
    })

    settlement.onFinish()
    await flushMicrotasks()

    expect(settled).toBe(true)
  })

  it('resolves when the visit is cancelled', async () => {
    const { promise, settlement } = startVisit()
    let settled = false
    void promise.then(() => {
      settled = true
    })

    settlement.onCancel()
    await flushMicrotasks()

    expect(settled).toBe(true)
  })

  it('stays pending on an error event and settles on finish', async () => {
    const { promise, settlement } = startVisit()
    let settled = false
    void promise.then(() => {
      settled = true
    })

    settlement.onError()
    await flushMicrotasks()
    expect(settled).toBe(false)

    settlement.onFinish()
    await flushMicrotasks()
    expect(settled).toBe(true)
  })

  it('settles once even when several callbacks fire', async () => {
    const { promise, settlement } = startVisit()
    let settlements = 0
    void promise.then(() => {
      settlements += 1
    })

    settlement.onFinish()
    settlement.onCancel()
    await flushMicrotasks()

    expect(settlements).toBe(1)
  })
})
