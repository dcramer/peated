import { db } from "@peated/server/db";
import { bottleReferences } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { BottleReferenceDetailsSchema } from "./schemas";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottle-references/{reference}",
    summary: "Get a Bottle reference",
    description:
      "Get the current assignment and moderation state for one Bottle reference. Requires a moderator.",
    operationId: "getBottleReference",
  })
  .input(
    z.object({
      reference: z.coerce
        .number()
        .int()
        .positive()
        .describe("Stable ID of the Bottle reference"),
    }),
  )
  .output(BottleReferenceDetailsSchema)
  .handler(async ({ input, errors }) => {
    const reference = await db.query.bottleReferences.findFirst({
      where: eq(bottleReferences.id, input.reference),
    });
    if (!reference) {
      throw errors.NOT_FOUND({ message: "Bottle reference not found." });
    }

    return {
      id: reference.id,
      name: reference.name,
      createdAt: reference.createdAt.toISOString(),
      bottleId: reference.bottleId,
      ignored: reference.ignored === true,
      assignmentSource: reference.assignmentSource,
      assignedByActorId: reference.assignedByActorId,
    };
  });
