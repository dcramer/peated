import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import {
  CatalogTargetIntegrityMismatchError,
  CatalogTargetNotFoundError,
  CatalogTargetRetiredError,
  loadCatalogTargetByBottleId,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { ExactCatalogTargetV1Schema } from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/target",
    summary: "Get Bottle target",
    description: "Resolve a concrete Bottle to its active exact catalog target",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleTarget",
    }),
  })
  .input(
    z
      .object({
        bottle: z.coerce.number().int().positive(),
      })
      .strict(),
  )
  .output(ExactCatalogTargetV1Schema)
  .handler(async function ({ input, errors }) {
    try {
      const target = await loadCatalogTargetByBottleId(input.bottle, {
        actor: null,
        permissions: { canReadCatalogIdentity: true },
      });
      if (target.kind !== "bottle") {
        throw new CatalogTargetIntegrityMismatchError(
          { bottleId: input.bottle },
          "the Bottle resolved to a generic target",
        );
      }
      return target;
    } catch (error) {
      if (error instanceof CatalogTargetNotFoundError) {
        const bottle = await db.query.bottles.findFirst({
          where: eq(bottles.id, input.bottle),
          columns: { id: true },
        });
        if (bottle) {
          const integrityError = new CatalogTargetIntegrityMismatchError(
            { bottleId: input.bottle },
            "the active Bottle does not own an exact target",
          );
          throw errors.CONFLICT({
            message: integrityError.message,
            cause: integrityError,
          });
        }
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (
        error instanceof CatalogTargetRetiredError ||
        error instanceof CatalogTargetIntegrityMismatchError
      ) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
