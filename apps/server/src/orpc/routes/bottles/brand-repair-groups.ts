import { getBrandRepairGroups } from "@peated/server/lib/brandRepairCandidates";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

const SupportingReferenceSchema = z.object({
  source: z.enum(["full_name", "alias"]),
  text: z.string(),
  targetMatchedName: z.string(),
  targetMatchedWordCount: z.number(),
  currentBrandMatchedName: z.string().nullable(),
  currentBrandMatchedWordCount: z.number(),
});

const BrandSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().nullable(),
  totalBottles: z.number(),
  totalTastings: z.number(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottles/brand-repair-groups",
    summary: "List grouped bottle brand/entity repair candidates",
    description:
      "Retrieve moderator-facing source-brand to target-brand repair clusters, grouped by the verified stronger producer identity found in bottle names or aliases.",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleBrandRepairGroups",
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
      results: z.array(
        z.object({
          candidateCount: z.number(),
          currentBrand: BrandSchema,
          targetBrand: BrandSchema,
          suggestedDistillery: z
            .object({
              id: z.number(),
              name: z.string(),
            })
            .nullable(),
          totalTastings: z.number(),
          sampleBottles: z.array(
            z.object({
              bottle: z.object({
                id: z.number(),
                fullName: z.string(),
                name: z.string(),
                numReleases: z.number(),
                totalTastings: z.number().nullable(),
              }),
              supportingReferences: z.array(SupportingReferenceSchema),
            }),
          ),
        }),
      ),
      rel: z.object({
        nextCursor: z.number().nullable(),
        prevCursor: z.number().nullable(),
      }),
    }),
  )
  .handler(async function ({ input }) {
    return await getBrandRepairGroups(input);
  });
