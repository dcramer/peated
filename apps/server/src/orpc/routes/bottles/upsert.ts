import { call, ORPCError } from "@orpc/server";
import { BottleCreateInputSchema } from "@peated/server/lib/bottleSchemas";
import { buildBottleUpdatePatch } from "@peated/server/lib/flatBottleInput";
import { logInfo } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleSchema } from "@peated/server/schemas";

import create from "./create";
import update from "./update";

/**
 * Translation-only, measured legacy compatibility. All writes delegate to the
 * Bottle routes. Task 7.1 removes this adapter after supported callers
 * use the canonical create and update operations.
 */
export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/bottles",
    summary: "Upsert bottle",
    description:
      "Create a new bottle or update existing one if it already exists. Requires moderator privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "upsertBottle",
    }),
  })
  .input(BottleCreateInputSchema)
  .output(BottleSchema)
  .handler(async function ({ input, context }) {
    try {
      const created = await call(create, input, { context });
      logInfo("Legacy Bottle upsert compatibility write", {
        extra: {
          event: "bottle_upsert.compatibility",
          access: "write",
          caller: "bottles.upsert",
          operation: "delegate_create",
          bottleId: created.id,
        },
      });
      return created;
    } catch (err) {
      if (err instanceof ORPCError && err.status === 409) {
        const updated = await call(
          update,
          {
            bottle: err.data.bottle,
            ...buildBottleUpdatePatch(input),
          },
          { context },
        );
        logInfo("Legacy Bottle upsert compatibility write", {
          extra: {
            event: "bottle_upsert.compatibility",
            access: "write",
            caller: "bottles.upsert",
            operation: "delegate_update",
            bottleId: updated.id,
          },
        });
        return updated;
      }
      throw err;
    }
  });
