# oRPC Clients

The web app uses the typed routes exported by `@peated/server/orpc/router`.
Use [oRPC Route Conventions](./orpc-routes.md) when changing a route.

## Server Code

- Use `getServerClient()` for a request that may use the current session.
- Use `getAnonymousServerClient()` for public data that must not vary by user.
- Use `getPublicPageServerClient()` when a public page can also show member
  state.
- Use the uncached `create*` version only when the call needs separate context.

```ts
import { getServerClient } from "@peated/web/lib/orpc/client.server";

const { client } = await getServerClient();
const tasting = await client.tastings.details({ tasting: 123 });
```

`createServerClient()` reads the current session by default. Pass
`accessToken: null` only when the caller must be anonymous.

## Client Components

Use `useORPC()` with TanStack Query helpers:

```ts
const orpc = useORPC();

const query = useQuery(
  orpc.notifications.count.queryOptions({
    input: { filter: "unread" },
    enabled: Boolean(user),
  }),
);

const mutation = useMutation(orpc.collections.bottles.create.mutationOptions());
```

Use `infiniteOptions()` for paged queries. Use `key()` when changing cached
data. Use `call()` only when a component needs a direct request outside a query
or mutation hook.

## Errors

Let unexpected errors throw. Use `safe()` only when the caller handles a
declared route error as normal product behavior.

```ts
import { safe } from "@orpc/client";

const result = await safe(client.auth.register(input));

if (result.error) {
  if (result.isDefined && result.error.name === "CONFLICT") {
    return { error: result.error.message };
  }
  throw result.error;
}

return result.data;
```

`isDefined` is true when the server returned an error declared by that route.
It is false on success and for an unexpected error.

Use `Inputs` and `Outputs` from `@peated/server/orpc/router` when code needs an
explicit route type.

Library references:

- <https://orpc.unnoq.com/docs/client>
- <https://orpc.unnoq.com/docs/tanstack-query/basic>
- <https://orpc.unnoq.com/docs/integrations/next>
