import { getDirtyParentAgeRepairCandidates } from "@peated/server/lib/dirtyParentAgeRepairCandidates";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const DirtyParentAgeRepairCandidateSchema = z.object({
  bottle: z.object({
    id: z.number(),
    fullName: z.string(),
    name: z.string(),
    statedAge: z.number(),
    numReleases: z.number(),
    totalTastings: z.number().nullable(),
  }),
  conflictingReleases: z.array(
    z.object({
      id: z.number(),
      fullName: z.string(),
      statedAge: z.number(),
      totalTastings: z.number().nullable(),
    }),
  ),
  repairMode: z.enum(["existing_release", "create_release"]),
  targetRelease: z.object({
    id: z.number().nullable(),
    fullName: z.string(),
    statedAge: z.number(),
    totalTastings: z.number().nullable(),
  }),
});

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottles/age-repair-candidates",
    summary: "List dirty parent age repair candidates",
    description:
      "Retrieve moderator-facing audit candidates for parent bottles whose structured bottle age should be split into a child bottle release.",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleAgeRepairCandidates",
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
      results: z.array(DirtyParentAgeRepairCandidateSchema),
      rel: z.object({
        nextCursor: z.number().nullable(),
        prevCursor: z.number().nullable(),
      }),
    }),
  )
  .handler(async function ({ input }) {
    return await getDirtyParentAgeRepairCandidates(input);
  });
