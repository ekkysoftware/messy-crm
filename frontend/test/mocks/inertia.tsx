import type { AnchorHTMLAttributes, FormHTMLAttributes, ReactNode } from 'react'
import { vi } from 'vitest'

import type { FlashMessage } from '../../src/types'

export const router = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  visit: vi.fn(),
}

export const usePage = vi.fn(
  (): {
    props: { errors: Record<string, string> }
    flash?: { messages?: FlashMessage[] }
  } => ({ props: { errors: {} }, flash: { messages: [] } }),
)
export const createInertiaApp = vi.fn()

export function Link({
  href,
  children,
  ...rest
}: { href: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}

// Stand-in for Inertia's <Form> that only renders its children, so tests that
// mock the adapter wholesale can still mount components that use it.
export function Form({
  children,
  transform: _transform,
  options: _options,
  resetOnSuccess: _resetOnSuccess,
  ...rest
}: {
  children: ReactNode | ((props: Record<string, unknown>) => ReactNode)
  transform?: unknown
  options?: unknown
  resetOnSuccess?: unknown
} & FormHTMLAttributes<HTMLFormElement>) {
  const state = { errors: {}, processing: false }
  return <form {...rest}>{typeof children === 'function' ? children(state) : children}</form>
}
