import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import { pushUniqueJob } from "@peated/server/worker/client";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { modProcedure } from "..";
import { type Context } from "../context";

const InputSchema = z.object({
  name: z.string(),
  ignored: z.boolean().optional(),
});

export async function bottleAliasUpdate({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const { name, ...data } = input;

  const [alias] = await db
    .select()
    .from(bottleAliases)
    .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()));

  if (!alias) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  if (Object.values(data).length === 0) {
    return {
      name: alias.name,
      createdAt: alias.createdAt.toISOString(),
    };
  }

  const [newAlias] = await db
    .update(bottleAliases)
    .set(data)
    .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()))
    .returning();

  if (!newAlias) {
    throw new TRPCError({
      message: "Failed to update alias.",
      code: "INTERNAL_SERVER_ERROR",
    });
  }

  if (newAlias.bottleId && data.name) {
    await pushUniqueJob("IndexBottleSearchVectors", {
      bottleId: newAlias.bottleId,
    });
  }

  return {
    name: newAlias.name,
    createdAt: newAlias.createdAt.toISOString(),
  };
}

export default modProcedure.input(InputSchema).mutation(bottleAliasUpdate);
