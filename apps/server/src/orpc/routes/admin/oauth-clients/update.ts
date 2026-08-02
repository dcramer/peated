import { db } from "@peated/server/db";
import { oauthClients } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  OAuthClientInputSchema,
  OAuthClientSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { OAuthClientSerializer } from "@peated/server/serializers/oauthClient";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "PATCH",
    path: "/admin/oauth-clients/{clientId}",
    summary: "Update OAuth client",
    operationId: "updateOAuthClient",
  })
  .input(
    OAuthClientInputSchema.partial().extend({
      clientId: z.string().min(1),
      active: z.boolean().optional(),
    }),
  )
  .output(OAuthClientSchema)
  .handler(async ({ input, context, errors }) => {
    const { clientId, ...updates } = input;
    const [client] = await db
      .update(oauthClients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(oauthClients.clientId, clientId))
      .returning();

    if (!client) {
      throw errors.NOT_FOUND({ message: "OAuth client not found." });
    }

    return await serialize(OAuthClientSerializer, client, context.user);
  });
