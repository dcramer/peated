import {
  BOTTLE_GROUP_SORT_OPTIONS,
  listBottleGroups,
} from "@peated/server/lib/bottleGroupReads";
import {
  CatalogTargetNotFoundError,
  CatalogTargetResolutionError,
  CatalogTargetRetiredError,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import {
  GenericCatalogTargetV1Schema,
  listResponse,
} from "@peated/server/schemas";
import { z } from "zod";
import { serializeBottleGroupRetiredTargetData } from "./retired-target";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-groups",
    summary: "List bottle groups",
    description:
      "Search stable BottleGroup identities and their aggregate statistics",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleGroups",
    }),
  })
  .input(
    z
      .object({
        query: z.coerce.string().default(""),
        cursor: z.coerce.number().int().gte(1).default(1),
        limit: z.coerce.number().int().gte(1).lte(100).default(25),
        sort: z.enum(BOTTLE_GROUP_SORT_OPTIONS).default("-tastings"),
      })
      .strict(),
  )
  .output(listResponse(GenericCatalogTargetV1Schema))
  .handler(async ({ input, errors }) => {
    try {
      return await listBottleGroups(input, {
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
