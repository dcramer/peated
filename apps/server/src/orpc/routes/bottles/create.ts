import { IndependentConcreteBottleCreateRouteInputSchema } from "@peated/server/lib/concreteBottleSchemas";
import {
  BottleAlreadyExistsError,
  BottleCreateBadRequestError,
} from "@peated/server/lib/createBottle";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import { buildIndependentConcreteBottleCreateInput } from "@peated/server/lib/flatConcreteBottleInput";
import { procedure } from "@peated/server/orpc";
import {
  requireTosAccepted,
  requireVerified,
} from "@peated/server/orpc/middleware/auth";
import { ExactCatalogTargetV1Schema } from "@peated/server/schemas";
import loadExactTarget from "./load-exact-target";

export default procedure
  .use(requireVerified)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/bottles",
    summary: "Create bottle",
    description:
      "Create a new bottle entry with brand, distillery, and whisky details",
    spec: (spec) => ({
      ...spec,
      operationId: "createBottle",
    }),
  })
  .input(IndependentConcreteBottleCreateRouteInputSchema)
  .output(ExactCatalogTargetV1Schema)
  .handler(async function ({ input, context, errors }) {
    try {
      const result = await createConcreteBottle({
        context,
        input: buildIndependentConcreteBottleCreateInput(input),
      });
      return await loadExactTarget(
        {
          bottleId: result.bottle.id,
          groupId: result.group.id,
          targetId: result.exactTarget.id,
        },
        context,
      );
    } catch (err) {
      if (err instanceof BottleAlreadyExistsError) {
        throw errors.CONFLICT({
          message: err.message,
          data: {
            bottle: err.bottleId,
          },
        });
      }

      if (err instanceof BottleCreateBadRequestError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      throw err;
    }
  });
