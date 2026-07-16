import { call, ORPCError } from "@orpc/server";
import { IndependentConcreteBottleCreateRouteInputSchema } from "@peated/server/lib/concreteBottleSchemas";
import { logInfo } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleSchema } from "@peated/server/schemas";

import create from "./create";
import details from "./details";
import update from "./update";

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
