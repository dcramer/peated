import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import { requireMod } from "@peated/server/orpc/middleware";
import { pushUniqueJob } from "@peated/server/worker/client";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { procedure } from "..";

const InputSchema = z.object({
  name: z.string(),
  ignored: z.boolean().optional(),
});

const OutputSchema = z.object({
  name: z.string(),
  createdAt: z.string(),
});

export default procedure
  .route({ method: "PUT", path: "/bottle-aliases/:name" })
  .use(requireMod)
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({ input }) {
    const { name, ...data } = input;

    const [alias] = await db
      .select()
      .from(bottleAliases)
      .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()));

    if (!alias) {
      throw new ORPCError("NOT_FOUND");
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
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to update alias.",
      });
    }

    return {
      name: newAlias.name,
      createdAt: newAlias.createdAt.toISOString(),
    };
  });
