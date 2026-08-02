import {
  BottleCheckAlreadyClosedError,
  BottleCheckNotClosableError,
  BottleCheckNotFoundError,
  CloseBottleCheckInputSchema,
  closeBottleCheck,
} from "@peated/server/lib/bottleChecks";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleCheckResponseSchema } from "@peated/server/schemas/bottleChecks";
import { serializeBottleCheck } from "@peated/server/serializers/bottleCheck";

const InputSchema = CloseBottleCheckInputSchema.omit({ checkId: true }).extend({
  check: CloseBottleCheckInputSchema.shape.checkId,
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-checks/{check}/close",
    summary: "Close a Bottle check",
    spec: (spec) => ({ ...spec, operationId: "closeBottleCheck" }),
  })
  .input(InputSchema)
  .output(BottleCheckResponseSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      return serializeBottleCheck(
        await closeBottleCheck(
          {
            checkId: input.check,
            reason: input.reason,
            note: input.note,
          },
          context.user,
        ),
      );
    } catch (error) {
      if (error instanceof BottleCheckNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message });
      }
      if (
        error instanceof BottleCheckAlreadyClosedError ||
        error instanceof BottleCheckNotClosableError
      ) {
        throw errors.CONFLICT({ message: error.message });
      }
      throw error;
    }
  });
