import { CursorSchema, TastingDraftSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/tasting-drafts",
    summary: "List tasting drafts",
    description:
      "List your own tasting drafts, most recently saved first. Drafts are private to the member who saved them.",
    operationId: "listTastingDrafts",
  })
  .input(
    z.object({
      cursor: z.coerce
        .number()
        // int() also caps it at a safe integer, so the offset fits a bigint.
        .int()
        .gte(1)
        .default(1)
        .describe("Page number to return"),
      limit: z.coerce
        .number()
        .int()
        .gte(1)
        .lte(100)
        .default(25)
        .describe("Drafts per page"),
    }),
  )
  .output(
    z.object({
      results: z.array(TastingDraftSchema),
      rel: CursorSchema,
    }),
  );
