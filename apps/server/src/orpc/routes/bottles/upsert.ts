import { call, ORPCError } from "@orpc/server";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleInputSchema, BottleSchema } from "@peated/server/schemas";
import type { BottlePreviewResult } from "@peated/server/types";
import { ConflictError } from "../errors";

import create from "./create";
import update from "./update";
import { bottleNormalize } from "./validation";

export default procedure
  .use(requireMod)
  .route({ method: "PUT", path: "/bottles" })
  .input(BottleInputSchema)
  .output(BottleSchema)
  .handler(async function ({ input, context }) {
    const user = context.user;

    const bottleData: BottlePreviewResult & Record<string, any> =
      await bottleNormalize({ input, context });

    if (!bottleData.name) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Invalid bottle name.",
      });
    }

    try {
      return await call(create, input, { context });
    } catch (err) {
      if (err instanceof ConflictError) {
        return await call(
          update,
          {
            ...input,
            bottle: err.existingRow.id,
          },
          { context },
        );
      }
      throw err;
    }
  });
