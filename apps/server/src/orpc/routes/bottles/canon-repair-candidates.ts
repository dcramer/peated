import { getCanonRepairCandidates } from "@peated/server/lib/canonRepairCandidates";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const CanonRepairCandidateSchema = z.object({
  bottle: z.object({
    id: z.number(),
    fullName: z.string(),
    numReleases: z.number(),
    totalTastings: z.number().nullable(),
  }),
  targetBottle: z.object({
    id: z.number(),
    fullName: z.string(),
    numReleases: z.number(),
    totalTastings: z.number().nullable(),
  }),
  variantBottles: z.array(
    z.object({
      id: z.number(),
      fullName: z.string(),
      numReleases: z.number(),
      totalTastings: z.number().nullable(),
    }),
  ),
});

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottles/canon-repair-candidates",
    summary: "List canonical bottle merge repair candidates",
    description:
      "Retrieve moderator-facing audit candidates for likely wrong canonical bottle names that should be merged into an existing same-brand target bottle.",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleCanonRepairCandidates",
    }),
  })
  .input(
    z.object({
      query: z.coerce.string().default(""),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    z.object({
      results: z.array(CanonRepairCandidateSchema),
      rel: z.object({
        nextCursor: z.number().nullable(),
        prevCursor: z.number().nullable(),
      }),
    }),
  )
  .handler(async function ({ input }) {
    return await getCanonRepairCandidates(input);
  });
