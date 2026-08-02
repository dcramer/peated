import { db } from "@peated/server/db";
import { oauthClients } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { OAuthClientSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { OAuthClientSerializer } from "@peated/server/serializers/oauthClient";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/oauth-clients/{clientId}",
    summary: "Get OAuth client",
    operationId: "getOAuthClient",
  })
  .input(z.object({ clientId: z.string().min(1) }))
  .output(OAuthClientSchema)
  .handler(async ({ input, context, errors }) => {
    const [client] = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, input.clientId));

    if (!client) {
      throw errors.NOT_FOUND({ message: "OAuth client not found." });
    }

    return await serialize(OAuthClientSerializer, client, context.user);
  });
