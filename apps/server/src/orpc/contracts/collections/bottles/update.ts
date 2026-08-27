import { RESERVED_COLLECTION_SLUGS } from "@peated/server/constants";
import {
  CollectionBottleSchema,
  CollectionBottleStatusSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../../base";

export default contract
  .route({
    method: "PATCH",
    path: "/users/{user}/collections/{collection}/bottles/{collectionBottle}",
    summary: "Update collection bottle entry",
    description:
      "Update collection bottle entry fields. Requires authentication and ownership",
    operationId: "updateCollectionBottle",
  })
  .input(
    z.object({
      collection: z.union([
        z.enum(RESERVED_COLLECTION_SLUGS),
        z.coerce.number(),
      ]),
      collectionBottle: z.coerce.number(),
      status: CollectionBottleStatusSchema.nullable(),
      user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
    }),
  )
  .output(CollectionBottleSchema);
