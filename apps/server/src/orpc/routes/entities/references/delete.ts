import { db } from "@peated/server/db";
import { entityReferences } from "@peated/server/db/schema";
import { requiredEntityReferenceNames } from "@peated/server/lib/db";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "DELETE",
    path: "/entity-references/{name}",
    summary: "Remove an Entity reference",
    description:
      "Stop matching a name to an Entity. Current Entity names cannot be removed. Requires a moderator.",
    operationId: "deleteEntityReference",
  })
  .input(
    z.object({
      name: z.string(),
    }),
  )
  .output(z.object({}))
  .handler(async ({ input, errors }) => {
    const reference = await db.query.entityReferences.findFirst({
      where: eq(sql`LOWER(${entityReferences.name})`, input.name.toLowerCase()),
      with: {
        entity: true,
      },
    });

    if (!reference) {
      throw errors.NOT_FOUND({
        message: "Reference not found.",
      });
    }

    if (
      reference.entity &&
      requiredEntityReferenceNames(reference.entity).some(
        (name) => name.toLowerCase() === reference.name.toLowerCase(),
      )
    )
      throw errors.BAD_REQUEST({
        message: "Current Entity names cannot be removed.",
      });

    // Keep the name reserved so another Entity cannot claim it by accident.
    await db
      .update(entityReferences)
      .set({
        entityId: null,
      })
      .where(
        eq(sql`LOWER(${entityReferences.name})`, reference.name.toLowerCase()),
      );

    if (reference.entity) {
      await pushUniqueJob("IndexEntitySearchVectors", {
        entityId: reference.entity.id,
      });
    }

    return {};
  });
