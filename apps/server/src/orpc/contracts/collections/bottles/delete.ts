import { RESERVED_COLLECTION_SLUGS } from "@peated/server/constants";
import { CollectionBottleInputSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../../base";

const fields = {
  collection: z.union([z.enum(RESERVED_COLLECTION_SLUGS), z.coerce.number()]),
  user: z.union([z.literal("me"), z.coerce.number(), z.string()]),
} as const;

export default contract
  .route({
    method: "DELETE",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "Remove a Bottle from a collection",
    description:
      "Remove one Bottle membership from a user's collection. Requires authentication and ownership.",
    operationId: "removeBottleFromCollection",
  })
  .input(
    CollectionBottleInputSchema.pick({ bottle: true })
      .safeExtend(fields)
      .strict(),
  )
  .output(z.object({}));
