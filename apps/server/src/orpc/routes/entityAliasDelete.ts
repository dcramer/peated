import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { entityAliases } from "@peated/server/db/schema";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";
import { requireMod } from "../middleware";

export default procedure
  .use(requireMod)
  .route({ method: "DELETE", path: "/entity-aliases/:name" })
  .input(
    z.object({
      name: z.string(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, context }) {
    const alias = await db.query.entityAliases.findFirst({
      where: eq(sql`LOWER(${entityAliases.name})`, input.name.toLowerCase()),
      with: {
        entity: true,
      },
    });

    if (!alias) {
      throw new ORPCError("NOT_FOUND", {
        message: "Entity Alias not found.",
      });
    }

    if (
      alias.entity &&
      alias.name.toLowerCase() === alias.entity.name.toLowerCase()
    )
      throw new ORPCError("BAD_REQUEST", {
        message: "Cannot delete canonical name",
      });

    // we dont actually delete aliases, just unassociate them
    await db
      .update(entityAliases)
      .set({
        entityId: null,
      })
      .where(eq(sql`LOWER(${entityAliases.name})`, alias.name.toLowerCase()));

    if (alias.entity) {
      await pushUniqueJob("IndexEntitySearchVectors", {
        entityId: alias.entity.id,
      });
    }

    return {};
  });
