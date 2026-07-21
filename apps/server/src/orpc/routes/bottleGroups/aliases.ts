import { listBottleGroupAliases } from "@peated/server/lib/bottleGroupReads";
import {
  CatalogTargetNotFoundError,
  CatalogTargetResolutionError,
  CatalogTargetRetiredError,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { BottleGroupAliasV1Schema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { serializeBottleGroupRetiredTargetData } from "./retired-target";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-groups/{group}/aliases",
    summary: "List bottle group aliases",
    description:
      "List active stable aliases owned by the BottleGroup's generic target",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleGroupAliases",
    }),
  })
  .input(
    z
      .object({
        group: z.coerce.number().int().positive(),
        cursor: z.coerce.number().int().gte(1).default(1),
        limit: z.coerce.number().int().gte(1).lte(100).default(25),
      })
      .strict(),
  )
  .output(listResponse(BottleGroupAliasV1Schema))
  .handler(async ({ input: { group, ...input }, errors }) => {
    try {
      return await listBottleGroupAliases(group, input, {
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
