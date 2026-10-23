---
name: react-conventions
description: Use before building React data fetching, mutations, or forms. Detects the codebase's existing approach and matches it; prescribes a best-practice default (TanStack Query v5 for fetching, React Hook Form + Zod for forms) only when no pattern exists. Adds Next.js client/server boundary guidance only when Next.js App Router is detected. Triggered by "add a fetch", "build a form", "call this API", "mutation", or "/react-conventions <what to build>".
---

# React Conventions

## Overview

Build React data and form code the right way — without fighting the codebase. One rule: match the approach that already exists; only when there is none, scaffold the best-practice default correctly.

This skill owns **data and forms behavior** (fetching, mutations, validation). It is complementary to `pattern-enforcer`, which owns **visual components** (dropdowns, modals, styling). When both could apply, pattern-enforcer handles the component shell; react-conventions handles the data and form logic inside it.

## Invocation

```
/react-conventions <what you want to build>
```

Also activates automatically when about to build a data fetch, a mutation, or a form.

## Phase 0: Detect Framework & Stack

Read `package.json` once. Determine what is present:

| Concern | Look for | Prescribed default (vacuum only) |
|---------|----------|----------------------------------|
| Data fetching | `@tanstack/react-query`, `react-query` (v3 legacy), `swr` | TanStack Query v5 |
| Forms | `react-hook-form`, `formik` | React Hook Form |
| Schema validation | `zod`, `yup` | Zod |
| Framework | `next` + an `app/` directory | (enables Next.js boundary checks) |

```bash
cat package.json | grep -E "react-query|@tanstack|swr|react-hook-form|formik|zod|yup|\"next\""
ls -d app 2>/dev/null || ls -d src/app 2>/dev/null
```

The Next.js client/server boundary checks in Phase 2 activate **only** if Next.js App Router is detected. In a Vite/CRA/Remix SPA they are skipped silently.

## Phase 1: Decide Match vs Prescribe (per concern)

Run this decision independently for each concern in the request. A project may have an established fetching pattern but no form pattern yet.

- **Existing approach found** (e.g. SWR used in 5+ places): match it. Surface it.
  > "Codebase uses SWR — following that, not introducing React Query."
- **Existing TanStack Query found**: match the installed major. If the project is on `react-query` v3, keep its v3 APIs or ask before migrating; never mix v3 positional APIs with v5 object APIs in one codebase.
- **A prescribed lib is installed but unused** (e.g. RHF in `package.json`, no forms yet): use what's installed before adding anything new.
- **No approach found** (greenfield / first fetch / first form): scaffold the prescribed default, applying the correctness checklist in Phase 2. A new data-fetching install is `@tanstack/react-query` v5.

To detect an existing approach, count real usages:

```bash
# fetching
grep -rl "useQuery\|useMutation\|useSWR\|useEffect.*fetch" --include="*.ts*" src | head
# forms
grep -rl "useForm\|<Formik\|register(\|handleSubmit" --include="*.ts*" src | head
```

## Phase 2: Apply the Correctness Checklist

### Data fetching (TanStack Query v5)
- Import from `@tanstack/react-query`; use object-form `useQuery({ queryKey, queryFn, ... })` and `useMutation({ mutationFn, ... })`.
- Stable, structured query keys — arrays like `['user', id]` or `['contacts', 'list', filters]`, never string concatenation.
- Handle `isPending` (no data yet), `isFetching` (including background revalidation), `isError`, and `error` at the call site (the actual UI states are owned by `ui-completeness`).
- Pass React Query's `signal` into the fetch/Axios call so superseded requests cancel.
- Seed server-rendered payloads with `initialData` + `initialDataUpdatedAt`, passed only when the query key matches the payload's filter or entity.
- Use `gcTime`, not `cacheTime`; use `isPending`, not `isLoading` as the general loading flag.
- Mutations use `useMutation` + `invalidateQueries({ queryKey })` (or `setQueryData` for optimistic), never a manual refetch.
- Optimistic updates include the rollback path — `onError` restores the previous cache.
- Prefer server-authoritative mutations when the server computes fields such as IDs, activity entries, or aggregates.
- Do **not** write the `useEffect` + `fetch` + `useState` triad when TanStack Query is the chosen tool.

### Forms (React Hook Form + Zod)
- The Zod schema is the single source of truth; derive types with `z.infer`, do not duplicate them
- `zodResolver` wired in; no hand-rolled validation
- Each field has accessible error wiring — `aria-invalid` and the error message linked to the input
- The submit handler is typed from the schema; disable/show-loading during submission

### Client/server boundaries (Next.js App Router only)
- Push `"use client"` to the **leaf** that needs interactivity, not the whole page
- Keep data fetching in server components where possible; React Query lives under a client boundary
- Flag `"use client"` at the top of a file that has no hooks or handlers — it is unnecessary

**Match-existing case:** skip the library prescription, but still apply the *universal* correctness checks above (stable query keys, accessible form errors, optimistic rollback). These are correctness, not library preference.

## Phase 3: Report

State the decision and the evidence so the choice is auditable:

> "Built the user fetch with **TanStack Query v5** (no existing fetching pattern found — set the default). Query key `['user', userId]`, mutation invalidates `{ queryKey: ['user'] }` on success with optimistic update + rollback. Forms: matched existing **Formik** in `SignupForm.tsx` — did not introduce RHF."

## Rules

- Never introduce a second fetching or form library when one is already established
- Never mix TanStack Query v3 (`react-query`, positional arguments, `cacheTime`) with v5 (`@tanstack/react-query`, object arguments, `gcTime`) in one codebase
- Never use `isLoading` as the general React Query loading flag in v5; use `isPending` for no data and `isFetching` for background fetches
- Never duplicate a Zod schema's types by hand
- Never put `"use client"` above a component that has no interactivity
- Never silently swap the codebase's choice for a "better" one — match it, or ask if truly ambiguous
- Always state which path was taken (matched existing vs. set new default) and the file evidence
