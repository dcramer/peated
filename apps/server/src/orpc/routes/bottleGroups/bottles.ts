import {
  BOTTLE_GROUP_BOTTLE_SORT_OPTIONS,
  BottleGroupNotFoundError,
  listBottleGroupBottles,
} from "@peated/server/lib/bottleGroupReads";
import { procedure } from "@peated/server/orpc";
import { BottleSchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-groups/{group}/bottles",
    summary: "List related bottles",
    description:
      "List the independently complete concrete Bottles in one BottleGroup",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleGroupBottles",
    }),
  })
  .input(
    z
      .object({
        group: z.coerce.number().int().positive(),
        query: z.coerce.string().default(""),
        cursor: z.coerce.number().int().gte(1).default(1),
        limit: z.coerce.number().int().gte(1).lte(100).default(25),
        sort: z.enum(BOTTLE_GROUP_BOTTLE_SORT_OPTIONS).default("-tastings"),
      })
      .strict(),
  )
  .output(listResponse(BottleSchema))
  .handler(async ({ input: { group, ...input }, context, errors }) => {
    try {
      return await listBottleGroupBottles(
        group,
        input,
        context.user ?? undefined,
      );
    } catch (error) {
      if (error instanceof BottleGroupNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      throw error;
    }
  });
