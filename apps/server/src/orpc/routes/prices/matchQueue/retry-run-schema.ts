import { z } from "zod";

export const PriceMatchRetryRunSchema = z.object({
  cancelRequestedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  erroredCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  id: z.number().int(),
  kind: z
    .enum(["create_new", "match_existing", "correction", "errored"])
    .nullable(),
  matchedCount: z.number().int().min(0),
  mode: z.enum(["no_web", "full"]),
  pendingCount: z.number().int().min(0),
  processedCount: z.number().int().min(0),
  progress: z.number().int().min(0).max(100),
  query: z.string(),
  resolvedCount: z.number().int().min(0),
  reviewableCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0),
  startedAt: z.string().datetime().nullable(),
  status: z.enum(["pending", "running", "completed", "failed", "canceled"]),
  updatedAt: z.string().datetime(),
});
