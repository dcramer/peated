# Worker Jobs

BullMQ runs Peated work that can finish after the user-facing request. Read
[Background Work](../../../../docs/policies/background-work.md),
[Data And Permission Boundaries](../../../../docs/policies/data-and-permissions.md),
and [Sensitive Data](../../../../docs/policies/sensitive-data.md) first.

## Add A Job

1. Add the job name to `JobName` in `types.ts`.
2. Create the handler under `jobs/`.
3. Check its arguments with a strict Zod schema at the start of the handler.
4. Register the handler in `jobs/index.ts`.
5. Add focused tests for argument checks, saved changes, and retry safety.

```ts
import { z } from "zod";
import { type JobFunction } from "../types";

const InputSchema = z
  .object({ bottleId: z.number().int().positive() })
  .strict();

const updateExample: JobFunction = async (rawInput) => {
  const { bottleId } = InputSchema.parse(rawInput);
  // Load current state and apply the job's change.
};

export default updateExample;
```

Keep arguments small. Prefer IDs and expected versions over full records. Do
not log the full argument object. Log only safe IDs, counts, and status values.

## Queue Or Run A Job

```ts
import { pushJob, runJob } from "@peated/server/worker/client";

await pushJob("UpdateExample", { bottleId: 123 });
await runJob("UpdateExample", { bottleId: 123 }); // tests and deliberate inline use
```

Add recurring schedules to `client.ts`, where the worker owns scheduler start
and stop:

```ts
scheduledJob("0 3 * * *", "update-example", async () => {
  await runJob("UpdateExample", { bottleId: 123 });
});
```

The registry adds Sentry spans, actor context, and success or failure logs.
Handlers should let unexpected errors throw so BullMQ can record and retry them.
