import { TAG_CATEGORIES } from "@peated/server/constants";
import { BottleSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/tags/bottles",
    summary: "Find bottles by tasting note",
    description:
      "Rank bottles by how often a category or note appears in their public reviews and tastings. Break ties by the number of matches, then bottle ID.",
    spec: (spec) => ({ ...spec, operationId: "listTastingNoteBottles" }),
  })
  .input(
    z.object({
      category: z.enum(TAG_CATEGORIES),
      note: z.string().trim().min(1).max(64).optional(),
      limit: z.coerce.number().int().min(1).max(12).default(5),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          bottle: BottleSchema,
          matchingReviewAndTastingCount: z.number().int().positive(),
          notedReviewAndTastingCount: z.number().int().positive(),
          /** @deprecated Use matchingReviewAndTastingCount. TODO(api-v1): Remove when /v1 is retired. */
          matchingTastings: z.number().int().positive(),
          /** @deprecated Use notedReviewAndTastingCount. TODO(api-v1): Remove when /v1 is retired. */
          taggedTastings: z.number().int().positive(),
        }),
      ),
    }),
  );
