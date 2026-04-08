import { getLegacyReleaseRepairCandidates } from "@peated/server/lib/legacyReleaseRepairCandidates";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const LegacyReleaseRepairCandidateSchema = z.object({
  legacyBottle: z.object({
    id: z.number(),
    fullName: z.string(),
    edition: z.string().nullable(),
    releaseYear: z.number().nullable(),
    numReleases: z.number(),
    totalTastings: z.number().nullable(),
  }),
  proposedParent: z.object({
    id: z.number().nullable(),
    fullName: z.string(),
    totalTastings: z.number().nullable(),
  }),
  releaseIdentity: z.object({
    edition: z.string().nullable(),
    releaseYear: z.number().nullable(),
    markerSources: z.array(z.string()),
  }),
  siblingLegacyBottles: z.array(
    z.object({
      id: z.number(),
      fullName: z.string(),
    }),
  ),
  hasExactParent: z.boolean(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottles/release-repair-candidates",
    summary: "List legacy release repair candidates",
    description:
      "Retrieve moderator-facing audit candidates for bottles that likely need to be split into a reusable parent bottle plus child bottle releases.",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleReleaseRepairCandidates",
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
      results: z.array(LegacyReleaseRepairCandidateSchema),
      rel: z.object({
        nextCursor: z.number().nullable(),
        prevCursor: z.number().nullable(),
      }),
    }),
  )
  .handler(async function ({ input }) {
    return await getLegacyReleaseRepairCandidates(input);
  });
