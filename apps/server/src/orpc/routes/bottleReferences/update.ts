import { getUserActor } from "@peated/server/lib/actors";
import {
  BottleReferenceBottleInactiveError,
  BottleReferenceBottleNotFoundError,
  BottleReferenceBottleRetiredError,
  BottleReferenceNotFoundError,
  CanonicalBottleReferenceCorrectionError,
  correctBottleReference,
  FailedToSaveBottleReferenceError,
  StaleBottleReferenceCorrectionError,
} from "@peated/server/lib/bottleReferences";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";
import { BottleReferenceDetailsSchema } from "./schemas";

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottle-references/{reference}",
    summary: "Correct a Bottle reference",
    description:
      "Reassign, unassign, or ignore one exact Bottle reference and update matching imported prices and reviews. Requires a moderator.",
    operationId: "updateBottleReference",
  })
  .input(
    z
      .object({
        reference: z.coerce
          .number()
          .int()
          .positive()
          .describe("Stable ID of the Bottle reference to correct"),
        expectedBottle: z
          .number()
          .int()
          .positive()
          .nullable()
          .describe(
            "Bottle ID currently assigned to the reference, or `null` when unresolved",
          ),
        expectedIgnored: z
          .boolean()
          .describe("Whether the reference is currently ignored"),
        bottle: z
          .number()
          .int()
          .positive()
          .nullable()
          .describe(
            "Verified replacement Bottle ID, or `null` to leave the reference unresolved",
          ),
        ignored: z
          .boolean()
          .describe(
            "Exclude an unassigned reference from automatic matching and maintenance",
          ),
      })
      .strict()
      .superRefine((input, ctx) => {
        if (input.bottle !== null && input.ignored) {
          ctx.addIssue({
            code: "custom",
            path: ["ignored"],
            message: "An assigned Bottle reference cannot be ignored.",
          });
        }
      }),
  )
  .output(BottleReferenceDetailsSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const actor = await getUserActor(context.user);
      const reference = await correctBottleReference(
        {
          referenceId: input.reference,
          expectedBottleId: input.expectedBottle,
          expectedIgnored: input.expectedIgnored,
          bottleId: input.bottle,
          ignored: input.ignored,
          assignedByActorId: actor.id,
        },
        { bottleReference: { id: input.reference } },
      );
      return {
        ...reference,
        createdAt: reference.createdAt.toISOString(),
      };
    } catch (err) {
      if (
        err instanceof BottleReferenceNotFoundError ||
        err instanceof BottleReferenceBottleNotFoundError
      ) {
        throw errors.NOT_FOUND({ message: err.message });
      }
      if (err instanceof CanonicalBottleReferenceCorrectionError) {
        throw errors.BAD_REQUEST({ message: err.message });
      }
      if (
        err instanceof StaleBottleReferenceCorrectionError ||
        err instanceof BottleReferenceBottleInactiveError ||
        err instanceof BottleReferenceBottleRetiredError
      ) {
        throw errors.CONFLICT({ message: err.message });
      }
      if (err instanceof FailedToSaveBottleReferenceError) {
        throw errors.INTERNAL_SERVER_ERROR({ message: err.message });
      }
      throw err;
    }
  });
