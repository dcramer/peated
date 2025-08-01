import { call, ORPCError } from "@orpc/server";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleInputSchema, BottleSchema } from "@peated/server/schemas";
import type { BottlePreviewResult } from "@peated/server/types";

import create from "./create";
import update from "./update";
import { bottleNormalize } from "./validation";

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/bottles",
    operationId: "upsertBottle",
    summary: "Upsert bottle",
    description:
      "Create a new bottle or update existing one if it already exists. Requires moderator privileges",
  })
  .input(BottleInputSchema)
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    const bottleData: BottlePreviewResult & Record<string, any> =
      await bottleNormalize({ input, context });

    if (!bottleData.name) {
      throw errors.BAD_REQUEST({
        message: "Invalid bottle name.",
      });
    }

    try {
      return await call(create, input, { context });
    } catch (err) {
      if (err instanceof ORPCError && err.status === 409) {
        return await call(
          update,
          {
            ...input,
            bottle: err.data.bottle,
          },
          { context },
        );
      }
      throw err;
    }
  });
