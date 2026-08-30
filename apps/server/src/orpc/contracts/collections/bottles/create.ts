import { RESERVED_COLLECTION_SLUGS } from "@peated/server/constants";
import {
  CollectionBottleInputSchema,
  CollectionBottleSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../../base";

const CollectionBottleCreateInputSchema =
  CollectionBottleInputSchema.safeExtend({
    collection: z.union([z.enum(RESERVED_COLLECTION_SLUGS), z.coerce.number()]),
    pendingImageId: z.string().trim().min(1).optional(),
    user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
  }).strict();

export default contract
  .route({
    method: "POST",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "Add a bottle to a collection",
    description:
      "Add one bottle to a user's collection. Requires authentication and ownership.",
    operationId: "addBottleToCollection",
  })
  .input(CollectionBottleCreateInputSchema)
  .output(CollectionBottleSchema);
