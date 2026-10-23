import { createInertiaApp, type ResolvedComponent } from '@inertiajs/react'

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
  // Django CSRF: cookie `csrftoken`, header `X-CSRFToken`.
  http: {
    xsrfCookieName: 'csrftoken',
    xsrfHeaderName: 'X-CSRFToken',
  },
})
