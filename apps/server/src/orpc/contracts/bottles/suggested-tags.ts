import { TagSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/bottles/{bottle}/suggested-tags",
    summary: "Get suggested tags for bottle",
    description:
      "Retrieve suggested tags for a bottle based on usage patterns for the bottle, brand, and category",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleSuggestedTags",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          tag: TagSchema,
          count: z.number(),
        }),
      ),
    }),
  );
