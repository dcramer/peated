import { getBrandRepairCandidates } from "@peated/server/lib/brandRepairCandidates";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const BrandRepairCandidateSchema = z.object({
  bottle: z.object({
    id: z.number(),
    fullName: z.string(),
    name: z.string(),
    numReleases: z.number(),
    totalTastings: z.number().nullable(),
  }),
  currentBrand: z.object({
    id: z.number(),
    name: z.string(),
    shortName: z.string().nullable(),
    totalBottles: z.number(),
    totalTastings: z.number(),
  }),
  targetBrand: z.object({
    id: z.number(),
    name: z.string(),
    shortName: z.string().nullable(),
    totalBottles: z.number(),
    totalTastings: z.number(),
  }),
  suggestedDistillery: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .nullable(),
  supportingReferences: z.array(
    z.object({
      source: z.enum(["full_name", "alias"]),
      text: z.string(),
      targetMatchedName: z.string(),
      targetMatchedWordCount: z.number(),
      currentBrandMatchedName: z.string().nullable(),
      currentBrandMatchedWordCount: z.number(),
    }),
  ),
});

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottles/brand-repair-candidates",
    summary: "List bottle brand/entity repair candidates",
    description:
      "Retrieve moderator-facing audit candidates for bottles whose stored brand entity appears wrong but whose names or aliases point at a different existing brand entity.",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleBrandRepairCandidates",
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
      results: z.array(BrandRepairCandidateSchema),
      rel: z.object({
        nextCursor: z.number().nullable(),
        prevCursor: z.number().nullable(),
      }),
    }),
  )
  .handler(async function ({ input }) {
    return await getBrandRepairCandidates(input);
  });
