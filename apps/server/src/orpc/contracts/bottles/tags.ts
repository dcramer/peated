import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/bottles/{bottle}/tags",
    summary: "Get bottle tags",
    description: "Get common tasting tags for a bottle",
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
      totalCount: z.number(),
    }),
  );
