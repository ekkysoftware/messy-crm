import { describe, expect, it } from 'vitest'

import { dashboardKey, dashboardRootKey } from '@/lib/queryKeys'

describe('dashboardKey', () => {
  it('separates views by search text and status', () => {
    const all = dashboardKey({ q: '', status: '' }, 1)
    const searched = dashboardKey({ q: 'alt', status: '' }, 1)
    const filtered = dashboardKey({ q: '', status: 'lead' }, 1)

    expect(searched).not.toEqual(all)
    expect(filtered).not.toEqual(all)
    expect(searched).not.toEqual(filtered)
  })

  it('separates a selected contact from no selection', () => {
    const selected = dashboardKey({ q: '', status: '' }, 7)
    const none = dashboardKey({ q: '', status: '' }, null)

    expect(selected).not.toEqual(none)
  })

  it('is stable for the same view and shares the dashboard root', () => {
    const first = dashboardKey({ q: 'alt', status: 'lead' }, 3)
    const again = dashboardKey({ q: 'alt', status: 'lead' }, 3)

    expect(again).toEqual(first)
    expect(first[0]).toBe(dashboardRootKey[0])
  })
})
