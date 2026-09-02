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
      "Rank bottles by the share of tastings with notes that mention a category or note. Break ties by matching tasting count, then bottle ID.",
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
          matchingTastings: z.number().int().positive(),
          taggedTastings: z.number().int().positive(),
        }),
      ),
    }),
  );
