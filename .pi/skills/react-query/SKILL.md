---
name: react-query
description: Guidelines for using TanStack Query v5 (@tanstack/react-query) for data fetching, caching, and server state synchronization in React applications
metadata:
  maintainer: Mindrally
  source: https://github.com/Mindrally/skills
---

# TanStack Query v5 Best Practices

You are an expert in TanStack Query v5, TypeScript, and React development. TanStack Query (formerly React Query) owns server state: fetching, caching, background updates, retries, and cache invalidation. This skill targets `@tanstack/react-query` v5; do not use v3 `react-query` APIs.

## v5 at a Glance

| Concern | v5 API |
|---------|--------|
| Package | `@tanstack/react-query` |
| Hook arguments | Object form: `useQuery({ queryKey, queryFn, ... })` |
| Cache retention | `gcTime` (replaces `cacheTime`) |
| No-data state | `isPending` (`isLoading` is `isPending && isFetching`) |
| Any-fetch state | `isFetching` (includes background revalidation) |
| Keep previous page | `placeholderData: keepPreviousData` |
| Infinite queries | Required `initialPageParam` + `getNextPageParam` |
| Query client calls | `invalidateQueries({ queryKey })`, `cancelQueries({ queryKey })`, `removeQueries({ queryKey })` |
| Global callbacks | `QueryCache` / `MutationCache` (`defaultOptions` no longer accepts `onError`/`onSuccess`) |
| Query function context | `queryFn: ({ signal, queryKey }) => ...` |

## Core Principles

- Use TanStack Query for all data fetching and caching.
- Leverage its built-in state instead of `useState` for server data.
- Use React Context and `useReducer` (or Zustand) for client-side global state.
- Avoid excessive API calls through proper `staleTime`, `gcTime`, and query keys.
- Handle `isPending`, `isFetching`, `isError`, and `error` explicitly.
- Keep the URL, form drafts, dialogs, and other view state outside the query cache.

## Project Structure

```
src/
  components/
    [Feature]/
      index.tsx
      queries.ts           # Feature-specific query hooks
      mutations.ts         # Feature-specific mutation hooks
  hooks/
    useAuth.ts
  services/
    api/
      client.ts            # fetch/Axios configuration
      users.ts             # User API functions
      posts.ts             # Post API functions
  providers/
    queryClient.ts         # module-scope QueryClient
    ReactQueryProvider.tsx
  types/
    index.ts
```

## Setup

### Query client

Create the client once at module scope, not inside a component, so remounts and Fast Refresh do not recreate the cache.

```typescript
// providers/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes
      gcTime: 30 * 60 * 1000,    // 30 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        const status = (error as { status?: number }).status;
        const clientError =
          typeof status === 'number' && status >= 400 && status < 500;
        return !clientError && failureCount < 2;
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});
```

### Provider

```tsx
// providers/ReactQueryProvider.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { queryClient } from './queryClient';

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {Devtools ? (
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  );
}

// Load devtools only in development so they are absent from the production bundle.
const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((mod) => ({
        default: mod.ReactQueryDevtools,
      })),
    )
  : null;
```

If the project does not use Vite, gate devtools with the equivalent build-time development flag. `@tanstack/react-query-devtools` belongs in `devDependencies`.

## Query Patterns

### Basic query hook

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchUser } from '@/services/api/users';

export function useUser(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: ({ signal }) => fetchUser(userId, signal),
    enabled: Boolean(userId),
    staleTime: 10 * 60 * 1000,
  });
}
```

Types are inferred from `queryFn`; do not add redundant `useQuery<User, Error>` generics.

### Query function with abort support

Pass React Query's `signal` to `fetch`/Axios so a superseded query is actually cancelled.

```typescript
// services/api/users.ts
export async function fetchUser(userId: string, signal?: AbortSignal): Promise<User> {
  const response = await fetch(`/api/users/${userId}`, { signal });

  if (!response.ok) {
    throw new Error('Unable to load user profile. Please try again.');
  }

  return response.json();
}
```

### Component states

```tsx
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isPending, isFetching, isError, error } = useUser(userId);

  if (isPending) return <LoadingSpinner />;
  if (isError) return <ErrorMessage message={error.message} />;

  return (
    <>
      {isFetching ? <RefreshIndicator /> : null}
      <ProfileCard user={user} />
    </>
  );
}
```

`isPending` means there is no data yet. `isFetching` is also true during background revalidation, so never blank an existing view just because `isFetching` is true.

### Shared query options

Use `queryOptions` to share keys and fetchers across hooks and prefetches.

```typescript
import { queryOptions } from '@tanstack/react-query';
import { fetchUser } from '@/services/api/users';

export const userQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['user', userId],
    queryFn: ({ signal }) => fetchUser(userId, signal),
    staleTime: 10 * 60 * 1000,
  });

export function useUser(userId: string) {
  return useQuery({
    ...userQueryOptions(userId),
    enabled: Boolean(userId),
  });
}
```

### Dependent queries

```typescript
function useUserWithPosts(userId: string) {
  const userQuery = useUser(userId);

  const postsQuery = useQuery({
    queryKey: ['posts', userId],
    queryFn: ({ signal }) => fetchUserPosts(userId, signal),
    enabled: Boolean(userQuery.data),
  });

  return { userQuery, postsQuery };
}
```

### Paginated queries

```typescript
import { keepPreviousData, useQuery } from '@tanstack/react-query';

function usePaginatedUsers(page: number, limit = 10) {
  return useQuery({
    queryKey: ['users', 'list', { page, limit }],
    queryFn: ({ signal }) => fetchUsers({ page, limit, signal }),
    placeholderData: keepPreviousData, // v5 replacement for keepPreviousData: true
  });
}
```

`placeholderData` is display-only. Use `isPlaceholderData` if the UI must show that the current rows belong to the previous page.

### Infinite scroll

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

function useInfiniteUsers() {
  return useInfiniteQuery({
    queryKey: ['users', 'infinite'],
    queryFn: ({ pageParam, signal }) => fetchUsers({ page: pageParam, signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
  });
}
```

`initialPageParam` is required in v5. For bi-directional lists, also provide `getPreviousPageParam`.

## Mutation Patterns

### Basic mutation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
```

### Optimistic update with rollback

```typescript
function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUser,
    onMutate: async (updatedUser: User) => {
      const key = ['user', updatedUser.id] as const;

      await queryClient.cancelQueries({ queryKey: key });

      const previousUser = queryClient.getQueryData<User>(key);
      queryClient.setQueryData<User>(key, updatedUser);

      return { previousUser };
    },
    onError: (_error, updatedUser, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(['user', updatedUser.id], context.previousUser);
      }
    },
    onSettled: (_data, _error, updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['user', updatedUser.id] });
    },
  });
}
```

Every optimistic update must have a rollback path in `onError`. When the server computes fields (IDs, timestamps, activity entries), prefer a server-authoritative mutation plus `setQueryData`/invalidation instead of guessing them.

### Mutation pending state

```tsx
function SaveButton() {
  const mutation = useCreateUser();

  return (
    <button onClick={() => mutation.mutate(values)} disabled={mutation.isPending}>
      {mutation.isPending ? 'Saving…' : 'Save'}
    </button>
  );
}
```

Use `mutateAsync` only when the caller needs to `await` the result and handle the thrown error.

## Cache Updates After Mutations

- `invalidateQueries({ queryKey })` marks matching queries stale and refetches active ones.
- `setQueryData(queryKey, updater)` writes a known server response into the cache.
- `setQueriesData({ queryKey }, updater)` updates every matching cached entry.
- `removeQueries({ queryKey })` drops entries for deleted entities.
- Invalidate the narrowest prefix that is actually affected; avoid invalidating the entire cache by default.

## Performance Optimization

### Query key factory

```typescript
export const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Filters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },
};
```

Use arrays, not concatenated strings. Normalize filter objects before putting them in a key.

### Selective subscriptions

```typescript
function useUserName(userId: string) {
  return useQuery({
    ...userQueryOptions(userId),
    select: (user) => user.name,
    enabled: Boolean(userId),
  });
}
```

### Prefetching

```typescript
function UserListItem({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      ...userQueryOptions(userId),
      staleTime: 60_000,
    });
  };

  return (
    <li onMouseEnter={handleMouseEnter}>
      <Link to={`/users/${userId}`}>View Profile</Link>
    </li>
  );
}
```

## Payload Hydration

When the server embeds initial data, seed the cache without an immediate refetch:

```typescript
useQuery({
  queryKey: ['contacts', 'list', filters],
  queryFn: ({ signal }) => fetchContacts(filters, signal),
  initialData: bootPayload,
  initialDataUpdatedAt: bootedAt,
});
```

- Pass `initialData` only when the query key matches the payload's filter/entity.
- `initialDataUpdatedAt` makes the hydrated entry obey `staleTime`.
- `initialData` is ignored once the query has data, so do not use it as a live subscription.

## Error Handling Patterns

### Global handlers with caches

`QueryClient` `defaultOptions` no longer accepts `onError`/`onSuccess` in v5. Attach global handlers through `QueryCache` and `MutationCache`.

```typescript
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => console.error('Query error:', error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => toast.error(error.message),
  }),
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000 },
    mutations: { retry: false },
  },
});
```

If a mutation already shows an inline error, do not also show a global toast for the same failure.

### Error boundaries

```tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div>
              <p>Something went wrong: {error.message}</p>
              <button onClick={resetErrorBoundary}>Try again</button>
            </div>
          )}
        >
          <UserProfile />
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

## Key Conventions

1. Use TanStack Query Devtools in development to inspect cache entries, freshness, and invalidation.
2. Group query and mutation hooks by feature.
3. Handle `isPending`, `isFetching`, `isError`, and `error` explicitly.
4. Fetch only required data; use API parameters to reduce transfer.
5. Avoid deeply nested queries; flatten when possible.
6. Use local/Context state for client state and TanStack Query for server state.
7. Pass `signal` into every fetch-based `queryFn`.
8. Prefer server-authoritative mutations unless the optimistic result is fully predictable and has a rollback.

## Anti-Patterns to Avoid

- Do not import from `react-query` (v3) or mix v3 and v5 APIs in one project.
- Do not use positional `useQuery(key, fn, options)` arguments in v5.
- Do not use `cacheTime`; use `gcTime`.
- Do not treat `isLoading` as the general loading flag; use `isPending` for no data and `isFetching` for background fetches.
- Do not use `keepPreviousData: true`; use `placeholderData: keepPreviousData`.
- Do not omit `initialPageParam` from `useInfiniteQuery`.
- Do not put global `onError`/`onSuccess` in `defaultOptions`; use `QueryCache`/`MutationCache` or per-hook callbacks.
- Do not use `useEffect` for data fetching.
- Do not store server data in `useState`.
- Do not create queries without a cache invalidation strategy.
- Do not skip `enabled` for conditional queries.
- Do not ignore TypeScript types for query responses.
