import {
  CatalogTargetNotFoundError,
  CatalogTargetResolutionError,
  CatalogTargetRetiredError,
  resolveBottlePageTarget,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { BottlePageTargetSchema } from "@peated/server/schemas/catalogIdentity";
import { z } from "zod";

const InputSchema = z
  .object({
    bottle: z.coerce.number().int().positive(),
  })
  .strict();

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/page-target",
    summary: "Get Bottle page target",
    description:
      "Resolve a Bottle page identity to its canonical exact Bottle or generic BottleGroup",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottlePageTarget",
    }),
  })
  .input(InputSchema)
  .output(BottlePageTargetSchema)
  .handler(async ({ input, errors }) => {
    try {
      return await resolveBottlePageTarget(input.bottle, {
        caller: "bottles.pageTarget",
        operation: "resolveBottlePageTarget",
      });
    } catch (error) {
      if (
        error instanceof CatalogTargetNotFoundError ||
        (error instanceof CatalogTargetRetiredError && !error.replacement)
      ) {
        throw errors.NOT_FOUND({ message: "Bottle not found.", cause: error });
      }
      if (error instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
