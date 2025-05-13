import { db } from "@peated/server/db";
import { entityAliases } from "@peated/server/db/schema";
import { pushUniqueJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";

export default modProcedure.input(z.string()).mutation(async function ({
  input,
  ctx,
}) {
  const alias = await db.query.entityAliases.findFirst({
    where: eq(sql`LOWER(${entityAliases.name})`, input.toLowerCase()),
    with: {
      entity: true,
    },
  });

  if (!alias) {
    throw new TRPCError({
      message: "Entity Alias not found.",
      code: "NOT_FOUND",
    });
  }

  if (
    alias.entity &&
    alias.name.toLowerCase() === alias.entity.name.toLowerCase()
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
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
