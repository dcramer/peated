# oRPC Route Conventions

This document defines conventions for implementing API endpoints with `@orpc/server`. It focuses on consistent route structure, naming, validation, and response design inside `apps/server`.

## 1. Directory Layout and Imports

| Path                              | Purpose                                      |
| --------------------------------- | -------------------------------------------- |
| `apps/server/src/orpc/routes`     | Single source of truth for route definitions |
| `apps/server/src/orpc/middleware` | Shared middleware such as `requireAuth`      |
| `apps/server/src/schemas`         | Zod schemas                                  |
| `apps/server/src/serializers`     | Serialization helpers                        |

### Import Policy

- Use absolute imports for everything outside the current folder.
- Use relative imports only for siblings and children.
- Do not climb the tree with `../../..`.

```ts
import { requireAuth } from "@peated/server/orpc/middleware";
import { BottleSerializer } from "@peated/server/serializers";
```

## 2. Router Composition and File Naming

### File Rules

| File                                         | HTTP semantics                                       |
| -------------------------------------------- | ---------------------------------------------------- |
| `list.ts`                                    | Collection route such as `GET /things`               |
| `details.ts`                                 | Single-resource route such as `GET /things/{thing}`  |
| `create.ts`                                  | Create route such as `POST /things`                  |
| `upsert.ts`                                  | Upsert or update route such as `PUT /things/{thing}` |
| `delete.ts`                                  | Delete route such as `DELETE /things/{thing}`        |
| Descriptive names like `login.ts` or `me.ts` | Functional endpoints                                 |

- Do not use dynamic segments in folder names. Path params belong inside the file.
- Each folder should export an `index.ts` that assembles its children into a router object.
- Route params should be explicitly named for the domain object. Use `{tasting}` or `{user}`, not bare `{id}`.
- Routes are flattened by object type.
- Unique sub-collections can use a prefixed name such as `bottleSeries` instead of nested folders under another object.

### Base Router and Tagging

All child routers extend the shared `base` exported from `@peated/server/orpc`. Always specify a tag for OpenAPI grouping.

```ts
import { base } from "@peated/server/orpc";
import details from "./details";

export default base.tag("tastings").router({
  details,
});
```

Top-level `routes/index.ts` composes routers eagerly. Do not use lazy imports.

## 3. Procedure Definition Pattern

Chain route definitions in this order:

1. `.use()` for middleware
2. `.route()` for method, path, and metadata
3. `.input()` for the Zod object schema
4. `.output()` for the Zod object schema
5. `.handler()` for business logic

```ts
export default procedure
  .use(requireAuth)
  .route({ method: "GET", path: "/ping", summary: "Health check" })
  .input(z.object({}))
  .output(z.object({ ping: z.literal("pong") }))
  .handler(() => ({ ping: "pong" }));
```

## 4. OpenAPI `operationId` Convention

Routes should explicitly specify `operationId` values with the `spec` callback.

### Naming Convention

Use camelCase `operationId` values with the pattern `{verb}{Resource}`.

| Verb     | Usage                                              |
| -------- | -------------------------------------------------- |
| `list`   | `GET` operations that return multiple resources    |
| `get`    | `GET` operations that return a single resource     |
| `create` | `POST` operations that create a resource           |
| `update` | `PUT` or `PATCH` operations that modify a resource |
| `delete` | `DELETE` operations that remove a resource         |
| `search` | Search endpoints                                   |
| `add`    | Adding to a collection                             |
| `remove` | Removing from a collection                         |

### Examples

| Route Path                                          | `operationId`                |
| --------------------------------------------------- | ---------------------------- |
| `GET /bottles`                                      | `listBottles`                |
| `GET /bottles/{bottle}`                             | `getBottle`                  |
| `POST /bottles`                                     | `createBottle`               |
| `PUT /bottles/{bottle}`                             | `updateBottle`               |
| `DELETE /bottles/{bottle}`                          | `deleteBottle`               |
| `GET /bottles/{bottle}/prices`                      | `listBottlePrices`           |
| `POST /collections/{collection}/bottles`            | `addBottleToCollection`      |
| `DELETE /collections/{collection}/bottles/{bottle}` | `removeBottleFromCollection` |
| `POST /auth/login`                                  | `login`                      |
| `POST /auth/logout`                                 | `logout`                     |
| `GET /search`                                       | `search`                     |

### Implementation Pattern

```ts
export default procedure.route({
  method: "GET",
  path: "/bottles",
  summary: "List bottles",
  spec: (spec) => ({
    ...spec,
    operationId: "listBottles",
  }),
});
```

### Rules

1. Each `operationId` must be unique across the API.
2. Keep `operationId` values short and readable.
3. Use camelCase without spaces or special characters.
4. Pick names that clearly describe the operation.
5. Reuse the same verbs consistently across resources.

## 5. HTTP Method Semantics

| Method   | Meaning        | Typical file            |
| -------- | -------------- | ----------------------- |
| `GET`    | Read           | `list.ts`, `details.ts` |
| `POST`   | Create         | `create.ts`             |
| `PUT`    | Upsert         | `upsert.ts`             |
| `PATCH`  | Partial update | `upsert.ts`             |
| `DELETE` | Remove         | `delete.ts`             |

- Use `PUT` on `/collectionName/{primaryKey}` when upserting by primary key.
- Use `PUT` on `/collectionName` for batch or composite-key upserts.
- Collection-level mutations are batch operations and should accept array input.

## 6. Path and Query Parameters

### Naming

- Use descriptive nouns such as `bottle` and `tasting`.
- Do not reuse a path param name for a body or query field.

### Coercion and Validation

- Provide sensible defaults.
- Path and query values arrive as strings, so use `z.coerce.*` when appropriate.

```ts
const Input = z.object({
  tastingId: z.coerce.number(),
  cursor: z.coerce.number().gte(1).default(1),
});
```

For polymorphic filters such as slug-or-id, use a union and branch at runtime.

```ts
const Input = z.object({
  country: z.union([z.coerce.number(), z.string()]),
});
```

## 7. Error Handling

`procedure` injects an `errors` helper with canonical REST errors like `NOT_FOUND`, `CONFLICT`, and `UNAUTHORIZED`. Prefer these over manual `ORPCError` construction.

```ts
export default procedure
  .route({ method: "GET", path: "/tastings/{tasting}" })
  .input(z.object({ tasting: z.coerce.number() }))
  .output(TastingSchema)
  .handler(async ({ input, context, errors }) => {
    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, input.tasting));

    if (!tasting) {
      throw errors.NOT_FOUND({ message: "Tasting not found." });
    }

    return serialize(TastingSerializer, tasting, context.user);
  });
```

If you truly need custom behavior, fall back to `new ORPCError(code, { message })`.

## 8. Authentication Middleware

```ts
export default procedure
  .use(requireAuth)
  .route({ method: "GET", path: "/auth/me" })
  .output(z.object({ user: UserSchema }))
  .handler(({ context }) => ({
    user: serialize(UserSerializer, context.user, context.user),
  }));
```

## 9. Testing Route Behavior

Route tests follow the backend policy in [Backend Testing](./backend-testing.md).

Route-specific expectations:

- Test files should be named `<routeFile>.test.ts`.
- `describe` labels should use the HTTP method and path, for example `POST /auth/login`.
- Cover success paths, validation errors, and auth failures.
- Use `routerClient` for route tests and `waitError` with inline snapshots for structured failures.

## 10. Response Design

### Cursor Pagination

```ts
.output(
  z.object({
    results: z.array(BottleSchema),
    rel: CursorSchema,
  }),
)
```

- Fetch `limit + 1` rows to detect `nextCursor`.
- Remove the extra row before serialization.
