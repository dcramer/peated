# Worker Jobs

BullMQ runs Peated work that can finish after the user-facing request. Read
[Background Work](../../../../docs/policies/background-work.md),
[Data And Permission Boundaries](../../../../docs/policies/data-and-permissions.md),
and [Sensitive Data](../../../../docs/policies/sensitive-data.md) first.

## Add A Job

1. Add the job name to `JobName` in `types.ts`.
2. Create the handler under `jobs/`.
3. Check its arguments with a strict Zod schema at the start of the handler.
4. Register the handler in `jobs/index.ts`, and decide whether it is unique
   (see [Unique Jobs](#unique-jobs)).
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

## Queues

Jobs run on three queues. `default` handles fast derived-data work such as
search indexing, stats, and notifications. `scrapers` runs collection runs
with its own lock timeout. `models` runs every job that waits on a hosted
model, such as listing and review classification, review clips, catalog
verification, and generated descriptions, four at a time. Register a job that
calls a model with `{ queueName: "models" }` so a burst of classifier work
cannot starve indexing. A default-queue job that needs model work queues it
instead of running it inline, and every outbound request on the default queue
carries a timeout.

`IdentifyTastingDraft` runs on `models` too. It reads a tasting draft's photo
and saves the identified Bottle on the draft. Over the member's hourly photo
identification limit, it queues itself again with a delay. Any other error marks the draft
`failed` without a retry. See
[Tasting Drafts](../../../../docs/features/tasting-drafts.md#identifying-the-bottle).

`GenerateEntityPronunciationAudio` calls Google Cloud Text-to-Speech, not a
model, so it runs on `default` with a 15-second request timeout. A failed run
keeps the old audio. To fill missing or outdated audio, send `{"afterId":0}` to
`/admin/catalog/rebuild-pronunciation-audio` with `pnpm cli api post`, and
repeat with each returned `nextAfterId` until it is null. Each call checks up to 500 Entities and queues the job only
for those whose audio is missing or does not match their IPA. See
[Naming And Entity Boundaries](../../../../docs/architecture/whisky-identity-model.md#naming-and-entity-boundaries)
for the audio rules.

When the AI service is out of budget, rate limited, down, or unreachable
(`isModelServiceUnavailable`), the models queue pauses for 15 minutes and puts
the job back without using an attempt. A model job must let that error throw
before it saves a partial result.

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
Failed jobs stay in Redis, and in Admin's Background work, for three days. The
worker removes older failed jobs every hour (`removeOldFailedJobs` in
`queue.ts`).
Handlers should let unexpected errors throw so BullMQ can record and retry them.

## Unique Jobs

The job's registration, not the caller, decides whether it is unique:

```ts
registry.add("UpdateExample", updateExample, { unique: true });
```

Make a job unique when it is keyed by its arguments and only the latest
request matters, such as re-indexing one Bottle or recomputing one Entity's
stats. Leave it plain when every push is separate work, such as one
notification or one report, or when the caller sets its own `jobId`.

A unique push uses a job ID built from the job name and all of its arguments,
waits 5 seconds by default, and is dropped while the same job is still waiting
or running. A unique job ID that still exists blocks a new add, so `pushJob`
removes a completed or failed job with the same ID before queueing again.
Callers may still pass `delay` or removal options; a unique job always keeps
its generated ID.

Waiting jobs live only in Redis. A Redis reset drops them without a failure
record, so bulk work needs a repair path that finds what is still undone from
the database, such as `missingOnly` on `/admin/catalog/rebuild-search`.
