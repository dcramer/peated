import { call, ORPCError } from "@orpc/server";
import { IndependentConcreteBottleCreateRouteInputSchema } from "@peated/server/lib/concreteBottleSchemas";
import { buildConcreteBottleUpdatePatch } from "@peated/server/lib/flatConcreteBottleInput";
import { logInfo } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleSchema } from "@peated/server/schemas";

import create from "./create";
import details from "./details";
import update from "./update";

/**
 * Translation-only, measured legacy compatibility. All writes delegate to the
 * concrete Bottle routes. Task 5.9 removes supported callers; task 9.7 removes
 * this measured adapter after observed traffic reaches zero.
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
  .input(IndependentConcreteBottleCreateRouteInputSchema)
  .output(BottleSchema)
  .handler(async function ({ input, context }) {
    try {
      const created = await call(create, input, { context });
      const bottle = await call(
        details,
        { bottle: created.bottle.id },
        { context },
      );
      logInfo("Legacy Bottle upsert response compatibility read", {
        extra: {
          event: "bottle_upsert.compatibility",
          access: "read",
          caller: "bottles.upsert",
          operation: "translate_concrete_create_response",
          bottleId: created.bottle.id,
        },
      });
      return bottle;
    } catch (err) {
      if (err instanceof ORPCError && err.status === 409) {
        const updated = await call(
          update,
          {
            bottle: err.data.bottle,
            ...buildConcreteBottleUpdatePatch(input),
          },
          { context },
        );
        const bottle = await call(
          details,
          { bottle: updated.bottle.id },
          { context },
        );
        logInfo("Legacy Bottle upsert response compatibility read", {
          extra: {
            event: "bottle_upsert.compatibility",
            access: "read",
            caller: "bottles.upsert",
            operation: "translate_concrete_update_response",
            bottleId: updated.bottle.id,
          },
        });
        return bottle;
      }
      throw err;
    }
  });
