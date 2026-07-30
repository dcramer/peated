import config from "@peated/server/config";
import {
  BottleOperationRejectionReasonSchema,
  SelectedBottleOperationIdsSchema,
  rejectBottleOperations,
} from "@peated/server/lib/bottleOperationModeration";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";
import { BottleOperationActionResponseSchema } from "./schemas";

const InputSchema = z
  .object({
    check: z.number().int().positive(),
    operationIds: SelectedBottleOperationIdsSchema,
    reason: BottleOperationRejectionReasonSchema,
    note: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.reason === "other" && input.note === undefined) {
      context.addIssue({
        code: "custom",
        message: "A note is required when the rejection reason is other.",
        path: ["note"],
      });
    }
  });

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottle-checks/{check}/operations/reject",
    summary: "Reject selected Bottle operations",
    spec: (spec) => ({
      ...spec,
      operationId: "rejectBottleOperations",
    }),
  })
  .input(InputSchema)
  .output(BottleOperationActionResponseSchema)
  .handler(async ({ input, context, errors }) => {
    if (!config.BOTTLE_CHECK_MODERATOR_VISIBILITY) {
      throw errors.NOT_FOUND();
    }
    return {
      results: await rejectBottleOperations(
        {
          checkId: input.check,
          operationIds: input.operationIds,
          reason: input.reason,
          note: input.note,
        },
        context.user,
      ),
    };
  });
