import {
  BOTTLE_GROUP_BOTTLE_SORT_OPTIONS,
  listBottleGroupBottles,
} from "@peated/server/lib/bottleGroupReads";
import {
  CatalogTargetNotFoundError,
  CatalogTargetResolutionError,
  CatalogTargetRetiredError,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import {
  ExactCatalogTargetV1Schema,
  listResponse,
} from "@peated/server/schemas";
import { z } from "zod";
import { serializeBottleGroupRetiredTargetData } from "./retired-target";

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
  .output(listResponse(ExactCatalogTargetV1Schema))
  .handler(async ({ input: { group, ...input }, errors }) => {
    try {
      return await listBottleGroupBottles(group, input, {
        actor: null,
        permissions: { canReadCatalogIdentity: true },
      });
    } catch (error) {
      if (error instanceof CatalogTargetNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (error instanceof CatalogTargetRetiredError) {
        throw errors.CONFLICT({
          message: error.message,
          cause: error,
          data: serializeBottleGroupRetiredTargetData(error.replacement),
        });
      }
      if (error instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
