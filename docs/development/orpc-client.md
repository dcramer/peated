# oRPC Client Usage for Next.js and TanStack Query

This guide outlines how to use oRPC within the Next.js app using TanStack Query. It captures both the library-level patterns and the conventions already used in this repo.

## Overview

We use the `@peated/server/orpc` contract to communicate with the backend API through typed clients.

- Client docs: <https://orpc.unnoq.com/docs/client/error-handling>
- Next.js integration: <https://orpc.unnoq.com/docs/integrations/next>
- TanStack Query integration: <https://orpc.unnoq.com/docs/tanstack-query/react>

## Project Conventions

- Use `createServerClient()` in server actions with the current `accessToken`.
- Use the `useORPC()` hook in client components to access typed query and mutation helpers.
- Use `safe()` when calling an oRPC function to extract `{ data, error, isDefined }`.
- Use `queryOptions()` from `orpc.<namespace>.<method>` directly in `useQuery`.
- Only spread `queryOptions()` when you need to add extra fields like `enabled`.
- Handle expected `error.name` values such as `CONFLICT` and `UNAUTHORIZED` explicitly.
- Do not rethrow expected user-facing errors. Rethrow unexpected failures.

## Calling oRPC Routes

oRPC routes are called the same way they are with the server-side `routerClient`. Route structure and naming conventions are documented in [oRPC Route Conventions](./orpc-routes.md).

There are three common ways to obtain an oRPC client:

1. `useORPC()` inside React components
2. `createServerClient()` from `@peated/web/lib/orpc/client.server` on the server
3. `createBrowserClient()` from `@peated/web/lib/orpc/client` when you need to manage the `accessToken` yourself

### Server Components and Server Actions

Use this in places like `route.ts` or `generateMetadata`. Do not use it in components marked `"use client"`.

```ts
import { getServerClient } from "@peated/web/lib/orpc/client.server";

export async function GET() {
  const { client } = await getServerClient();
  const { totalBottles } = await client.stats();
  // ...
}
```

If you need control over the access token, use `createServerClient()` directly. This should be uncommon.

```ts
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { safe } from "@orpc/client";

async function registerUser({ email, password, username, session }) {
  const { client } = await createServerClient({
    accessToken: session.accessToken,
  });

  const { error, data, isDefined } = await safe(
    client.auth.register({ email, password, username }),
  );

  if (isDefined && error?.name === "CONFLICT") {
    return "An account already exists matching that username or email address.";
  } else if (error) {
    throw error;
  }

  return data;
}
```

### `useQuery` and `useSuspenseQuery`

Use `queryOptions()` on the route handler:

```ts
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";

function NotificationIndicator() {
  const { user } = useAuth();
  const orpc = useORPC();

  const { data: unreadNotificationCount } = useQuery(
    orpc.notifications.count.queryOptions({
      input: { filter: "unread" },
      enabled: !!user,
    }),
  );

  return <span>{unreadNotificationCount}</span>;
}
```

### `useInfiniteQuery` and `useSuspenseInfiniteQuery`

Use `infiniteOptions()` on the route handler:

```ts
const orpc = useORPC();
const {
  data: { pages },
  error,
  fetchNextPage,
  hasNextPage,
  isFetching,
  isFetchingNextPage,
} = useSuspenseInfiniteQuery(
  orpc.tastings.list.infiniteOptions({
    input: (pageParam: number | undefined) => ({
      filter,
      limit: 10,
      cursor: pageParam,
    }),
    initialPageParam: undefined,
    staleTime: Infinity,
    initialData: () => {
      return {
        pages: [tastingList],
        pageParams: [undefined],
      };
    },
    getNextPageParam: (lastPage) => lastPage.rel?.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.rel?.prevCursor,
  }),
);
```

### `useMutation`

```ts
const favoriteBottleMutation = useMutation(
  orpc.collections.bottles.create.mutationOptions(),
);
```

Call the mutation with the route input directly:

```ts
favoriteBottleMutation.mutateAsync({
  bottle: bottle.id,
  user: "me",
  collection: "default",
});
```

### Query and Mutation Keys

Use `key()` on the oRPC client instead of manual key helpers:

```ts
orpc.users.details.key({ input: { user: toUserId } });
```

You can specify the key type explicitly:

```ts
orpc.users.details.key({
  input: { user: toUserId },
  type: "query",
});
```

### Native Client in Components

If you need the native oRPC client in a React component, use `useORPC()` and call `call()` directly:

```ts
const orpc = useORPC();
const results = await orpc.tastings.list.call();

const filteredResults = await orpc.tastings.list.call({
  input: { country: "us" },
});
```

## Error Handling

Use `safe()` for all oRPC calls. It returns `{ data, error, isDefined }`.

- `isDefined` is `true` if the request succeeded.
- `error.name` distinguishes known error cases such as `CONFLICT` and `NOT_FOUND`.
- Throw `error` only when it is unhandled or indicates a true failure.

```ts
import { safe } from "@orpc/client";

const { error, data, isDefined } = await safe(
  client.auth.register({ email, password, username }),
);

if (isDefined && error?.name === "CONFLICT") {
  return { error: error.message };
} else if (error) {
  throw error;
}
```

## Inferring Inputs and Outputs

Use `Inputs` and `Outputs` from the router when you need explicit route types:

```ts
import { Inputs, Outputs } from "@peated/server/orpc/router";

let tastingList: Outputs["tastings"]["list"];

const queryParams: Inputs["tastings"]["list"] = useApiQueryParams({
  numericFields: [
    "cursor",
    "limit",
    "age",
    "entity",
    "distiller",
    "bottler",
    "entity",
  ],
  overrides: {
    user: "me",
  },
});
```

## See Also

- <https://orpc.unnoq.com/docs/client>
- <https://orpc.unnoq.com/docs/tanstack-query/basic>
- <https://orpc.unnoq.com/docs/integrations/next>
