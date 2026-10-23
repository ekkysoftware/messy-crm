# Example: Building a Data Fetch in a Greenfield React App

## User says
```
Fetch the user profile for the settings page and show it
```

## React Conventions activates

**Phase 0 — Detect stack:**
```
package.json: react, react-dom, vite, typescript
No @tanstack/react-query, no swr, no react-hook-form, no next
```

**Phase 1 — Decide:**
```
grep -rl "useQuery\|useSWR\|useEffect.*fetch" src → 0 matches
```
> "No existing fetching pattern found. Setting React Query as the default — this will set the convention for future fetches."

## Implementation (prescribed default, full checklist)

```tsx
import { useQuery } from "@tanstack/react-query"

function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ["user", userId],            // stable, structured key
    queryFn: () => fetchUser(userId),
  })
}

function SettingsProfile({ userId }: { userId: string }) {
  const { data, isLoading, isError, error } = useUserProfile(userId)
  // isLoading / isError surfaced here — actual UI states owned by ui-completeness
  ...
}
```

**Phase 3 — Report:**
> "Built the user fetch with **React Query** (no existing pattern — set the default). Query key `['user', userId]`. Loading/error surfaced at the call site for `ui-completeness` to render."

---

# Example: Codebase Already Uses SWR

## User says
```
Add a fetch for the list of projects
```

## React Conventions activates

**Phase 0 — Detect stack:** `swr` present, no react-query.

**Phase 1 — Decide:**
```
grep -rl "useSWR" src → 7 matches
```
> "Codebase uses **SWR** in 7 places — following that, not introducing React Query."

## Implementation matches the existing SWR pattern

```tsx
import useSWR from "swr"

function useProjects() {
  return useSWR("/api/projects", fetcher)   // same fetcher + key style as existing code
}
```

> "Matched existing **SWR** usage (consistent with `useUser.ts` and 6 others). Did not introduce a second fetching library."

---

# Example: Next.js App Router — boundary check fires

## User says
```
Build a form to edit the user's bio
```

## React Conventions activates

**Phase 0 — Detect stack:** `next` + `app/` dir present, `react-hook-form` + `zod` installed.

**Phase 1 — Decide:** RHF + Zod installed → use them.

## Implementation (RHF + Zod, leaf client boundary)

```tsx
"use client"   // pushed to this interactive leaf only, not the page

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const BioSchema = z.object({ bio: z.string().max(280) })
type BioForm = z.infer<typeof BioSchema>      // types derived, not duplicated

function EditBioForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<BioForm>({ resolver: zodResolver(BioSchema) })
  ...
  <textarea {...register("bio")} aria-invalid={!!errors.bio} aria-describedby="bio-error" />
}
```

> "Used **React Hook Form + Zod** (both installed). Schema is the single source of truth; field has accessible error wiring. `\"use client\"` placed on this leaf only — the page stays a server component."
