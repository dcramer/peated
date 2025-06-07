# TanStack Start → TanStack Router + SSR Migration Plan

## Overview

We're migrating from TanStack Start (which includes React Server Components) to a simpler TanStack Router + SSR setup. This removes the complexity of server components while maintaining server-side rendering for initial page loads and SEO.

## Current State

- ✅ TanStack Start with full server-side rendering
- ✅ TanStack Router for routing
- ✅ oRPC client with server-side data loading in route loaders
- ✅ Vite with TanStack Start plugin
- ✅ React Query for client-side data management

## Target State

- 🎯 TanStack Router with standard React SSR
- 🎯 No React Server Components
- 🎯 Client-side data fetching with React Query
- 🎯 SSR only for initial page hydration
- 🎯 Simplified build process

## Migration Phases

### Phase 1: Update Dependencies & Configuration ✅

#### 1.1 Update package.json

```diff
{
  "dependencies": {
-   "@tanstack/react-start": "1.121.0-alpha.21",
-   "@tanstack/start": "1.120.13",
    "@tanstack/react-router": "1.121.0-alpha.14",
+   "@hono/node-server": "^1.x.x",
+   "hono": "^4.x.x",
    // ... other deps
  },
  "scripts": {
-   "dev": "vite dev",
-   "build": "vite build",
-   "start": "node .output/server/index.mjs"
+   "dev": "vite",
+   "build": "vite build --ssr",
+   "start": "node dist/server/index.js"
  }
}
```

#### 1.2 Update vite.config.ts

```diff
import tailwindcss from "@tailwindcss/vite";
- import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
+   rollupOptions: {
+     input: {
+       client: "./src/entry-client.tsx",
+       server: "./src/entry-server.tsx"
+     }
+   },
-   rollupOptions: {
-     external: ["node:stream", "node:stream/web", "node:async_hooks"],
-   },
  },
- ssr: {
-   noExternal: ["@tanstack/react-start"],
- },
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
-   tanstackStart({
-     tsr: {
-       verboseFileRoutes: true,
-       routesDirectory: "src/routes",
-     },
-   }),
+   // Standard TanStack Router plugin configuration
  ],
});
```

### Phase 2: Replace Entry Points ✅

#### 2.1 Create new entry-client.tsx

```tsx
// src/entry-client.tsx
import { createORPCReactQueryUtils } from "@orpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { createBrowserClient } from "./lib/orpc/client";
import { routeTree } from "./routeTree.gen";

// Create router with browser-specific setup
function createBrowserRouter() {
  const orpcClient = createBrowserClient();
  const orpc = createORPCReactQueryUtils(orpcClient);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
      },
    },
  });

  return createRouter({
    routeTree,
    context: {
      queryClient,
      orpc,
      orpcClient,
    },
    // Hydrate from server state
    hydrate: (state) => {
      queryClient.setQueryData(["__router_state__"], state);
    },
  });
}

const router = createBrowserRouter();

hydrateRoot(
  document.getElementById("root")!,
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
```

#### 2.2 Create new entry-server.tsx

```tsx
// src/entry-server.tsx
import { createORPCReactQueryUtils } from "@orpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, renderToString } from "@tanstack/react-router";
import { renderToString as reactRenderToString } from "react-dom/server";
import { getServerClient } from "./lib/orpc/client.server";
import { routeTree } from "./routeTree.gen";

export async function render(url: string, context: any = {}) {
  const orpcClient = getServerClient(context);
  const orpc = createORPCReactQueryUtils(orpcClient);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: {
      queryClient,
      orpc,
      orpcClient,
    },
  });

  // Load the route and execute loaders
  await router.load(url);

  // Render the app
  const html = reactRenderToString(<RouterProvider router={router} />);

  // Serialize the query client state for hydration
  const dehydratedState = queryClient.getQueryCache().getAll();

  return {
    html,
    state: dehydratedState,
  };
}
```

#### 2.3 Create Hono server

```tsx
// src/server.ts
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { render } from "./entry-server";

const app = new Hono();

// Serve static files
app.use("/assets/*", serveStatic({ root: "./dist/client" }));
app.use("/favicon.ico", serveStatic({ root: "./dist/client" }));

// SSR handler
app.get("*", async (c) => {
  try {
    const { html, state } = await render(c.req.url, {
      // Pass any server context needed
      request: c.req,
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Peated</title>
        </head>
        <body>
          <div id="root">${html}</div>
          <script>
            window.__INITIAL_STATE__ = ${JSON.stringify(state)};
          </script>
          <script type="module" src="/assets/entry-client.js"></script>
        </body>
      </html>
    `;

    return c.html(fullHtml);
  } catch (error) {
    console.error("SSR Error:", error);
    return c.text("Internal Server Error", 500);
  }
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
```

### Phase 3: Modify Data Loading ⏳

#### 3.1 Update router.tsx

```diff
// src/router.tsx
import { createORPCReactQueryUtils } from "@orpc/react-query";
- import { createRouter as createTanStackRouter } from "@tanstack/react-router";
+ import { createRouter } from "@tanstack/react-router";
import { ErrorPage404 } from "./components/errorPage";
- import { getServerClient } from "./lib/orpc/client.server";
+ import { createBrowserClient } from "./lib/orpc/client";
import { getQueryClient } from "./lib/orpc/query";
import { routeTree } from "./routeTree.gen";

export function createRouter() {
-  const orpcClient = getServerClient();
+  const orpcClient = createBrowserClient();
  const orpc = createORPCReactQueryUtils(orpcClient);

-  const router = createTanStackRouter({
+  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    context: {
      queryClient: getQueryClient(),
      orpc,
      orpcClient,
    },
    defaultNotFoundComponent: () => <ErrorPage404 />,
  });

  return router;
}
```

#### 3.2 Update route loaders pattern

**Before (TanStack Start):**

```tsx
export const Route = createFileRoute("/bottles/$bottleId/")({
  loader: async ({ params, context }) => {
    // Server-side data loading with context.orpcClient
    await context.queryClient.ensureQueryData(
      context.orpc.bottles.byId.queryOptions({
        input: { bottle: parseInt(params.bottleId) },
      })
    );

    const bottle = await context.orpcClient.bottles.byId({
      bottle: parseInt(params.bottleId),
    });

    return { bottle };
  },
  component: BottleDetailsComponent,
});
```

**After (TanStack Router + SSR):**

```tsx
export const Route = createFileRoute("/bottles/$bottleId/")({
  loader: async ({ params, context }) => {
    // Client-side data loading - loaders run on both server and client
    const bottleQuery = context.orpc.bottles.byId.queryOptions({
      input: { bottle: parseInt(params.bottleId) },
    });

    // Prefetch for SSR, use from cache on client
    const bottle = await context.queryClient.ensureQueryData(bottleQuery);

    return { bottle };
  },
  component: BottleDetailsComponent,
});

function BottleDetailsComponent() {
  const { bottle } = Route.useLoaderData();
  const { bottleId } = Route.useParams();
  const orpc = useORPC();

  // Additional client-side data can be loaded here
  const { data: tastings } = useQuery(
    orpc.bottles.tastings.queryOptions({
      input: { bottle: parseInt(bottleId) },
    })
  );

  return (
    <div>
      <h1>{bottle.fullName}</h1>
      {/* Component content */}
    </div>
  );
}
```

#### 3.3 Update \_\_root.tsx

```diff
// src/routes/__root.tsx
- import { useAppSession } from "@peated/web/lib/session.server";
+ import { useAuth } from "@peated/web/hooks/useAuth";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  orpc: RouterUtils<ServerClient>;
  orpcClient: ServerClient;
}>()({
  loader: async ({ context }) => {
-   const session = await useAppSession();
-   const user = session.data.user;
+   // On server: get session from request context
+   // On client: get from React Query cache or local storage
+   const session = typeof window === 'undefined'
+     ? await getServerSession(context)
+     : await getClientSession();

    return {
      session: {
        user: session?.user || null,
        accessToken: session?.accessToken || null,
        ts: session?.ts || null,
      },
    };
  },
  component: RootComponent,
});
```

### Phase 4: Clean Up ⏳

#### 4.1 Files to remove

- [ ] `src/ssr.ts` (TanStack Start SSR)
- [ ] `src/client.tsx` (TanStack Start client)
- [ ] `src/tanstack-start.d.ts`
- [ ] Any remaining Next.js files (`next.config.mjs`, `next-env.d.ts`)

#### 4.2 Files to update

- [ ] Update all route files to remove Start-specific patterns
- [ ] Update `src/lib/orpc/client.ts` for browser-only usage
- [ ] Update `src/components/providers.tsx` for client-side setup
- [ ] Update any server-only imports

## Code Migration Patterns

### Route Component Pattern

```diff
// Before: Mixed server/client pattern
export const Route = createFileRoute("/path")({
  loader: async ({ context }) => {
-   const data = await context.orpcClient.route.call();
+   const data = await context.queryClient.ensureQueryData(
+     context.orpc.route.queryOptions()
+   );
    return { data };
  },
  component: () => {
    const { data } = Route.useLoaderData();
+   const orpc = useORPC();
+
+   // Additional client-side queries
+   const { data: clientData } = useQuery(
+     orpc.route.queryOptions()
+   );

    return <div>{/* component */}</div>;
  },
});
```

### Server Function Pattern

```diff
// Before: TanStack Start server functions
- import { createServerFn } from "@tanstack/react-start";
+ // Remove server functions, use regular API calls

- export const serverAction = createServerFn().handler(async (input) => {
-   // server logic
- });

// After: Use regular oRPC mutations
function Component() {
  const orpc = useORPC();
  const mutation = useMutation(
    orpc.route.action.mutationOptions()
  );

  const handleAction = (input) => {
    mutation.mutate(input);
  };
}
```

## Progress Checklist

### Phase 1: Dependencies & Configuration

- [x] Remove TanStack Start dependencies
- [x] Add Hono for SSR server
- [x] Update vite.config.ts
- [x] Update package.json scripts
- [x] Add TanStack Router plugin dependency
- [ ] Update tsconfig.json if needed

### Phase 2: Entry Points

- [x] Create `src/entry-client.tsx`
- [x] Create `src/entry-server.tsx`
- [x] Create `src/server.ts` (Hono server with Sentry, logging, security)
- [x] Update build configuration

### Phase 3: Data Loading ✅

- [x] Update `src/router.tsx`
- [x] Update `src/routes/__root.tsx`
- [x] Update route loaders pattern (verified working)
- [x] Update oRPC client setup
- [x] Test data loading and hydration

### Phase 4: Clean Up ✅

- [x] Remove TanStack Start files (`src/client.tsx`, `src/ssr.ts`, `src/router.tsx`)
- [x] Remove unused dependencies
- [x] Update import statements
- [x] Clean up configuration files
- [x] Test all routes work correctly

### Phase 5: Testing & Verification ✅

- [x] Test SSR rendering (200 OK responses)
- [x] Test client-side hydration (Vite dev server working)
- [x] Test route navigation (multiple routes tested)
- [x] Test data fetching (routes with loaders working)
- [x] Test error handling (Sentry integration active)
- [x] Performance verification (clean startup, no errors)

## Key Differences Summary

| Aspect                | TanStack Start              | TanStack Router + SSR    |
| --------------------- | --------------------------- | ------------------------ |
| **Server Components** | ✅ React Server Components  | ❌ Client-side only      |
| **Data Loading**      | Server context in loaders   | React Query with SSR     |
| **Build Process**     | Start's build system        | Standard Vite SSR        |
| **Complexity**        | High (full-stack framework) | Medium (frontend + SSR)  |
| **Bundle Size**       | Larger (server runtime)     | Smaller (client-focused) |
| **Flexibility**       | Start's conventions         | Full control over SSR    |

## Notes

- This migration removes React Server Components entirely
- All data fetching moves to client-side with React Query
- SSR is only used for initial page load and SEO
- The app becomes a traditional SPA with SSR
- Route loaders still work but execute on both server and client
- Authentication and session management needs to be updated for client-side handling
