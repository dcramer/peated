import {
  BottleGroupNotFoundError,
  loadBottleGroup,
} from "@peated/server/lib/bottleGroupReads";
import { procedure } from "@peated/server/orpc";
import { BottleGroupV1Schema } from "@peated/server/schemas";
import { z } from "zod";

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
  .output(BottleGroupV1Schema)
  .handler(async ({ input, errors }) => {
    try {
      return await loadBottleGroup(input.group);
    } catch (error) {
      if (error instanceof BottleGroupNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      throw error;
    }
  });
