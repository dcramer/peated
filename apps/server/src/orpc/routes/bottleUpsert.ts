import { call, ORPCError } from "@orpc/server";
import { BottleInputSchema, BottleSchema } from "@peated/server/schemas";
import type { BottlePreviewResult } from "@peated/server/types";
import { procedure } from "..";
import { ConflictError } from "../errors";
import { requireMod } from "../middleware";
import bottleCreate from "./bottleCreate";
import { bottleNormalize } from "./bottlePreview";
import bottleUpdate from "./bottleUpdate";

export default procedure
  .use(requireMod)
  .route({ method: "POST", path: "/bottles/upsert" })
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
      return await call(bottleCreate, input, { context });
    } catch (err) {
      if (err instanceof ConflictError) {
        return await call(
          bottleUpdate,
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
