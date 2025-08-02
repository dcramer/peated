import { db } from "@peated/server/db";
import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "DELETE",
    path: "/bottle-aliases/{alias}",
    summary: "Delete bottle alias",
    description:
      "Remove bottle alias association and clear related references. Cannot delete canonical names. Requires moderator privileges",
    operationId: "deleteBottleAlias",
  })
  .use(requireMod)
  .input(z.object({ alias: z.string() }))
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(sql`LOWER(${bottleAliases.name})`, input.alias.toLowerCase()),
      with: {
        bottle: true,
      },
    });

    if (!alias) {
      throw errors.NOT_FOUND({
        message: "Bottle Alias not found.",
      });
    }

    if (alias.bottle) {
      const { bottle } = alias;
      if (alias.name.toLowerCase() === bottle.fullName.toLowerCase())
        throw errors.BAD_REQUEST({
          message: "Cannot delete canonical name",
        });
    }

    await db.transaction(async (tx) => {
      // clear any pinned matches as they are/were likely wrong
      await Promise.all([
        tx
          .update(storePrices)
          .set({
            bottleId: null,
          })
          .where(eq(sql`LOWER(${storePrices.name})`, alias.name.toLowerCase())),
        tx
          .update(reviews)
          .set({
            bottleId: null,
          })
          .where(eq(sql`LOWER(${reviews.name})`, alias.name.toLowerCase())),

        // we dont actually delete aliases, just unassociate them
        tx
          .update(bottleAliases)
          .set({ bottleId: null })
          .where(
            eq(sql`LOWER(${bottleAliases.name})`, alias.name.toLowerCase()),
          ),
      ]);
    });

    if (alias.bottle) {
      await pushJob("IndexBottleSearchVectors", { bottleId: alias.bottle.id });
    }

    return {};
  });
