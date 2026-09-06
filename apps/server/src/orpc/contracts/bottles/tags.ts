import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/bottles/{bottle}/tags",
    summary: "Get bottle tags",
    description: "Get common tasting tags from public reviews and tastings",
    spec: (spec) => ({ ...spec, operationId: "getBottleTags" }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          tag: z.string(),
          count: z.number(),
        }),
      ),
      /** @deprecated Use publicReviewAndTastingCount. TODO(api-v1): Remove when /v1 is retired. */
      totalCount: z.number(),
      publicReviewAndTastingCount: z.number().int().nonnegative(),
    }),
  );
