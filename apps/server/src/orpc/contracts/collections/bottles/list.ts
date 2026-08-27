import { RESERVED_COLLECTION_SLUGS } from "@peated/server/constants";
import {
  CollectionBottleSchema,
  CollectionBottleStatusSchema,
  listResponse,
} from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/users/{user}/collections/{collection}/bottles",
    summary: "List collection bottles",
    description: "Get bottles in a user's collection",
    operationId: "listCollectionBottles",
  })
  .input(
    z
      .object({
        collection: z.union([
          z.enum(RESERVED_COLLECTION_SLUGS),
          z.coerce.number(),
        ]),
        user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
        query: z.coerce
          .string()
          .default("")
          .describe("Search text only. Search operators are not supported."),
        brand: z.coerce.number().nullish(),
        distiller: z.coerce.number().nullish(),
        bottle: z.number().int().positive().optional(),
        status: z
          .union([CollectionBottleStatusSchema, z.literal("unset")])
          .optional(),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(25),
      })
      .strict(),
  )
  // TODO(response-envelope): Return { data, meta } when all list routes use the
  // same wrapper.
  .output(listResponse(CollectionBottleSchema));
