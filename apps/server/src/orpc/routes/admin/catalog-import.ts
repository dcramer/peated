import { BottleCreateInputSchema } from "@peated/server/lib/bottleSchemas";
import {
  BottleAlreadyExistsError,
  BottleCreateBadRequestError,
  createBottle,
} from "@peated/server/lib/createBottle";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { BottleSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/catalog/bottles",
    summary: "Import reviewed bottle",
    description:
      "Create an administrator-reviewed Bottle without generated details or another AI review",
    spec: (spec) => ({
      ...spec,
      operationId: "importReviewedBottle",
    }),
  })
  .input(BottleCreateInputSchema)
  .output(BottleSchema)
  .handler(async function ({ input, context, errors }) {
    try {
      const result = await createBottle({
        context,
        input,
        creationSource: "repair_workflow",
        generateDetails: false,
      });
      return await serialize(
        BottleSerializer,
        result.bottle,
        context.user,
        [],
        { includeGroupSummary: true },
      );
    } catch (error) {
      if (error instanceof BottleAlreadyExistsError) {
        throw errors.CONFLICT({
          message: error.message,
          data: { bottle: error.bottleId },
        });
      }
      if (error instanceof BottleCreateBadRequestError) {
        throw errors.BAD_REQUEST({ message: error.message });
      }
      throw error;
    }
  });
