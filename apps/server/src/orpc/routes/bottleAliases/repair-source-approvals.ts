import { repairInvalidSourceBottleAliases } from "@peated/server/lib/repairInvalidSourceBottleAliases";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const InputSchema = z
  .object({
    aliasNames: z.array(z.string().trim().min(1)).max(100).default([]),
    execute: z.boolean().default(false),
    limit: z.number().int().gte(1).lte(100).default(100),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.execute && input.aliasNames.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Execution requires one or more explicit BottleAlias names.",
        path: ["aliasNames"],
      });
    }
  });

const RepairStatusSchema = z.enum([
  "applied",
  "failed",
  "planned",
  "review_required",
]);

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-aliases/repair-source-approvals",
    summary: "Preview or repair invalid source-approval BottleAlias rows",
    description:
      "Preview is the default. Execution requires explicit BottleAlias names and moderator privileges.",
    spec: (spec) => ({
      ...spec,
      operationId: "repairSourceBottleAliases",
    }),
  })
  .input(InputSchema)
  .output(
    z.object({
      items: z.array(
        z.object({
          aliasName: z.string(),
          bottleId: z.number().nullable(),
          evidenceProposalIds: z.array(z.number()),
          message: z.string(),
          status: RepairStatusSchema,
        }),
      ),
      summary: z.object({
        applied: z.number(),
        failed: z.number(),
        planned: z.number(),
        reviewRequired: z.number(),
        total: z.number(),
      }),
    }),
  )
  .handler(async ({ input, context }) => {
    const result = await repairInvalidSourceBottleAliases({
      aliasNames: input.aliasNames,
      dryRun: !input.execute,
      limit: input.limit,
      user: context.user,
    });

    return {
      items: result.items,
      summary: {
        applied: result.summary.applied,
        failed: result.summary.failed,
        planned: result.summary.planned,
        reviewRequired: result.summary.review_required,
        total: result.summary.total,
      },
    };
  });
