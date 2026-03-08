# Backend Testing

Backend tests in this repo are integration-first. Test behavior over real wiring and real persistence whenever the code has a meaningful integration surface.

## Core Policy

- Prefer integration tests over isolated unit tests.
- Verify observable behavior, not implementation details.
- Do not add fluff unit tests that mock internal collaborators, route layers, database access, serializers, or random call chains that do not need separate verification.
- Only mock true external boundaries or unavoidable side effects, such as email delivery, worker dispatch, passkey verification, third-party HTTP, or AI providers.
- Small deterministic helpers may be tested directly when there is no useful integration surface and the test does not require unnecessary mocking. These cases should be uncommon.

## What Integration Means Here

- Vitest is the test runner. Config lives in [apps/server/vitest.config.mts](../../apps/server/vitest.config.mts).
- Shared test setup lives in [apps/server/src/test/setup-test-env.ts](../../apps/server/src/test/setup-test-env.ts).
- Tests use the real `test_peated` PostgreSQL database and truncate tables between tests.
- Execution is serialized with `fileParallelism: false` and `singleFork: true`.
- Route tests call the in-process [routerClient](../../apps/server/src/orpc/router.ts) instead of booting an HTTP server.
- Shared fixtures and defaults come from the Vitest test context.

## Test Context

Fixtures are exposed on the test context via [fixtures.ts](../../apps/server/src/lib/test/fixtures.ts):

```ts
test("creates a bottle", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();
  expect(bottle.id).toBeDefined();
});
```

Default user context is exposed via `defaults`:

```ts
test("creates a bottle through a route", async ({ defaults }) => {
  const user = defaults.user;
  expect(user.id).toBeDefined();
});
```

## Route Tests

Use `routerClient` for backend route tests. Keep them in-process and exercise the actual route, middleware, validation, serialization, and persistence path.

```ts
import { routerClient } from "@peated/server/orpc/router";

test("creates a bottle", async ({ defaults }) => {
  const result = await routerClient.bottles.create(
    { name: "Test Bottle", brand: 1 },
    { context: { user: defaults.user } },
  );

  expect(result.id).toBeDefined();
});
```

When persistence or side effects matter, assert against the database directly instead of inferring behavior from mocks.

## Errors and Snapshots

Use [waitError](../../apps/server/src/lib/test/waitError.ts) to assert thrown errors:

```ts
import waitError from "@peated/server/lib/test/waitError";

const err = await waitError(
  routerClient.bottles.create(
    { name: "Invalid Bottle", brand: 999999 },
    { context: { user: defaults.user } },
  ),
);

expect(err).toMatchInlineSnapshot();
```

- Prefer inline snapshots for structured errors.
- Avoid snapshots for dynamic API payloads such as records with timestamps.

## Direct Helper Tests

Direct tests for helpers are acceptable when all of the following are true:

- the code is deterministic and self-contained;
- there is no meaningful integration surface worth exercising instead;
- the test can stay simple without mocking internal code just to force isolation.

If a helper test starts building fake collaborators or asserting internal call sequences, it should probably become an integration test.

## Mocking Rules

Mocking is allowed only at boundaries that are expensive, unsafe, or inappropriate to invoke in tests:

- outbound email;
- worker queue dispatch;
- passkey or auth provider verification;
- third-party HTTP services;
- AI providers or other hosted external systems.

Do not mock internal business logic purely to make a backend test look unit-sized.

## File Placement and Naming

- Co-locate tests with the code they cover as `*.test.ts`.
- Route test `describe` blocks should use the HTTP method and path, for example `POST /bottles`.

## Running Tests

```shell
pnpm --filter=./apps/server test --run
pnpm --filter=./apps/server test --run routes/entities/list.test.ts
```
