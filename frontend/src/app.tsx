import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/lib/queryClient'
import '@/styles/app.css'

type PageModule = { default: ResolvedComponent }

createInertiaApp({
  resolve: async (name) => {
    const pages = import.meta.glob<PageModule>('./pages/**/*.tsx')
    const loadPage = pages[`./pages/${name}.tsx`]

    if (!loadPage) {
      throw new Error(`Unknown Inertia page: ${name}`)
    }

    return (await loadPage()).default
  },
  withApp: (app) => <QueryClientProvider client={queryClient}>{app}</QueryClientProvider>,
  // Django CSRF: cookie `csrftoken`, header `X-CSRFToken`.
  http: {
    xsrfCookieName: 'csrftoken',
    xsrfHeaderName: 'X-CSRFToken',
  },
})
