import { loadBottleGroup } from "@peated/server/lib/bottleGroupReads";
import {
  CatalogTargetNotFoundError,
  CatalogTargetResolutionError,
  CatalogTargetRetiredError,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { GenericCatalogTargetV1Schema } from "@peated/server/schemas";
import { z } from "zod";
import { serializeBottleGroupRetiredTargetData } from "./retired-target";

export default procedure
  .route({
    method: "GET",
    path: "/bottle-groups/{group}",
    summary: "Get bottle group details",
    description:
      "Retrieve one stable BottleGroup identity and its aggregate statistics",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleGroup",
    }),
  })
  .input(z.object({ group: z.coerce.number().int().positive() }).strict())
  .output(GenericCatalogTargetV1Schema)
  .handler(async ({ input, errors }) => {
    try {
      return await loadBottleGroup(input.group, {
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
