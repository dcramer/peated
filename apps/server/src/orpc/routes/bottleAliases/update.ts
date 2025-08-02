import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  alias: z.string(),
  ignored: z.boolean().optional(),
});

const OutputSchema = z.object({
  name: z.string(),
  createdAt: z.string(),
});

export default procedure
  .route({
    method: "PATCH",
    path: "/bottle-aliases/{alias}",
    summary: "Update bottle alias",
    description:
      "Update bottle alias properties such as ignored status. Requires moderator privileges",
    operationId: "updateBottleAlias",
  })
  .use(requireMod)
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({ input, context, errors }) {
    const { alias: aliasName, ...data } = input;

    const [alias] = await db
      .select()
      .from(bottleAliases)
      .where(eq(sql`LOWER(${bottleAliases.name})`, aliasName.toLowerCase()));

    if (!alias) {
      throw errors.NOT_FOUND({
        message: "Alias not found.",
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
      .where(eq(sql`LOWER(${bottleAliases.name})`, alias.name.toLowerCase()))
      .returning();

    if (!newAlias) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update alias.",
      });
    }

    return {
      name: newAlias.name,
      createdAt: newAlias.createdAt.toISOString(),
    };
  });
