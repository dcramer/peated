# Worker Jobs

This directory contains the async worker job system using BullMQ.

## Architecture

- **Registry** (`registry.ts`): Central job registry with Sentry instrumentation
- **Types** (`types.ts`): Type definitions for job names and functions
- **Client** (`client.ts`): Functions to queue and run jobs
- **Jobs** (`jobs/`): Individual job implementations

## Creating a New Job

### 1. Create the Job File

Create a new file in `jobs/` directory:

```typescript
// jobs/myNewJob.ts
import { type JobFunction } from "../types";

const myNewJob: JobFunction = async (params, context) => {
  // Your job logic here
  console.log("Running job with params:", params);
};

export default myNewJob;
```

### 2. Register the Job

Add your job to `jobs/index.ts`:

```typescript
import myNewJob from "./myNewJob";

// ... other imports

registry.add("MyNewJob", myNewJob);
```

### 3. Add to Type Union

**IMPORTANT**: Add the job name to the `JobName` type in `types.ts`:

```typescript
export type JobName =
  | "CapturePriceImage"
  | "MyNewJob" // <-- Add here
  | "GenerateBottleDetails";
// ... rest
```

Without this step, TypeScript will not allow you to queue the job.

## Running Jobs

### Queue a Job

```typescript
import { addJob } from "@peated/server/worker/client";

await addJob("MyNewJob", { param1: "value" });
```

### Run Immediately (Testing)

```typescript
import { runJob } from "@peated/server/worker/client";

await runJob("MyNewJob", { param1: "value" });
```

### Schedule a Job

```typescript
import { scheduledJob } from "@peated/server/worker/client";

// Daily at 3am
scheduledJob("0 3 * * *", "cleanup-job", async () => {
  const { runJob } = await import("./client");
  await runJob("MyNewJob");
});
```

## Job Function Signature

```typescript
type JobFunction = (
  args?: any, // Job parameters
  context?: JobContext, // Trace context for Sentry
) => Promise<unknown>;
```

## Features

- **Automatic Sentry instrumentation**: All jobs are wrapped with error tracking
- **Trace propagation**: Supports distributed tracing via context
- **Logging**: Automatic success/failure logging with duration
- **Type safety**: TypeScript ensures job names are valid
