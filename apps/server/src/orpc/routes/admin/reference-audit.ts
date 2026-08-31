import { getBottleReferenceAudit } from "@peated/server/lib/bottleReferenceAudit";
import { BOTTLE_REFERENCE_AUDIT_SIGNALS } from "@peated/server/lib/bottleReferenceAuditSignals";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { z } from "zod";

const SignalSchema = z.enum(BOTTLE_REFERENCE_AUDIT_SIGNALS);

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/bottle-reference-audit",
    summary: "Audit Bottle references",
    description:
      "List deterministic evidence for active noncanonical Bottle references.",
    operationId: "getBottleReferenceAudit",
  })
  .input(
    z
      .object({
        after: z.coerce.number().int().nonnegative().default(0),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        reviewState: z.enum(["all", "unreviewed", "reviewed"]).default("all"),
        signal: SignalSchema.optional(),
      })
      .default({ after: 0, limit: 50, reviewState: "all" }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          assignmentSource: z.string(),
          reviewedAt: z.string().nullable(),
          stateToken: z.string(),
          displayAlias: z
            .object({ id: z.number(), name: z.string() })
            .nullable(),
          bottle: z.object({
            id: z.number(),
            fullName: z.string(),
            groupId: z.number(),
            statedAge: z.number().nullable(),
            abv: z.number().nullable(),
            vintageYear: z.number().nullable(),
            releaseYear: z.number().nullable(),
            edition: z.string().nullable(),
            caskNumber: z.string().nullable(),
          }),
          group: z.object({
            id: z.number(),
            fullName: z.string(),
            siblings: z.array(
              z.object({ id: z.number(), fullName: z.string() }),
            ),
          }),
          signals: z.array(
            z.object({
              kind: SignalSchema,
              message: z.string(),
              candidateBottleIds: z.array(z.number()),
            }),
          ),
          impact: z.object({
            prices: z.object({ count: z.number(), ids: z.array(z.number()) }),
            reviews: z.object({ count: z.number(), ids: z.array(z.number()) }),
          }),
        }),
      ),
      nextCursor: z.number().nullable(),
    }),
  )
  .handler(async ({ input }) => await getBottleReferenceAudit(input));
