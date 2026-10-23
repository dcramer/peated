import { db } from "@peated/server/db";
import { bottleChecks } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

const JsonObjectSchema = z.record(z.string(), z.unknown());

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/audits/runs",
    summary: "List saved classifier runs for a source",
    description:
      "List the saved classifier input, output, and artifacts for one source record, newest first, so a wrong decision can be replayed as an eval test case. Requires moderator privileges.",
    spec: (spec) => ({ ...spec, operationId: "listAuditRuns" }),
  })
  .input(
    z
      .object({
        sourceKind: z.enum(["review", "store_price", "auction_lot"]),
        sourceId: z.coerce.number().int().positive(),
      })
      .strict(),
  )
  .output(
    z
      .object({
        results: z.array(
          z
            .object({
              id: z.number(),
              sourceKind: z.string().nullable(),
              sourceId: z.string().nullable(),
              model: z.string().nullable(),
              createdAt: z.string(),
              input: JsonObjectSchema,
              output: JsonObjectSchema.nullable(),
              artifacts: JsonObjectSchema.nullable(),
            })
            .strict(),
        ),
      })
      .strict(),
  )
  .handler(async ({ input }) => {
    const rows = await db
      .select()
      .from(bottleChecks)
      .where(
        and(
          eq(bottleChecks.intent, "resolve_reference"),
          eq(bottleChecks.sourceKind, input.sourceKind),
          eq(bottleChecks.sourceId, String(input.sourceId)),
        ),
      )
      .orderBy(desc(bottleChecks.createdAt), desc(bottleChecks.id))
      .limit(10);

    return {
      results: rows.map((row) => ({
        id: row.id,
        sourceKind: row.sourceKind,
        sourceId: row.sourceId,
        model: row.model,
        createdAt: row.createdAt.toISOString(),
        input: row.inputSnapshot,
        output: row.output,
        artifacts: row.artifacts,
      })),
    };
  });
