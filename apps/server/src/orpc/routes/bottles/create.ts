import { BottleCreateRequestSchema } from "@peated/server/lib/bottleSchemas";
import {
  BottleAlreadyExistsError,
  BottleCreateBadRequestError,
  createBottle,
} from "@peated/server/lib/createBottle";
import { procedure } from "@peated/server/orpc";
import {
  requireTosAccepted,
  requireVerified,
} from "@peated/server/orpc/middleware/auth";
import { BottleSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";

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
  .input(BottleCreateRequestSchema)
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    const { reviewed, ...bottleInput } = input;
    if (reviewed && !context.user.admin && !context.user.mod) {
      throw errors.FORBIDDEN({
        message: "Only moderators can mark a bottle as reviewed.",
      });
    }

    try {
      const result = await createBottle({
        context,
        input: bottleInput,
        creationSource: reviewed ? "repair_workflow" : "manual_entry",
        generateDetails: !reviewed,
      });
      return await serialize(
        BottleSerializer,
        result.bottle,
        context.user,
        [],
        { includeGroupSummary: true },
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
