import { db } from "@peated/server/db";
import { oauthClients } from "@peated/server/db/schema";
import { generateOAuthClientId } from "@peated/server/lib/oauth";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  OAuthClientInputSchema,
  OAuthClientSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { OAuthClientSerializer } from "@peated/server/serializers/oauthClient";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/oauth-clients",
    summary: "Register OAuth client",
    operationId: "createOAuthClient",
  })
  .input(OAuthClientInputSchema)
  .output(OAuthClientSchema)
  .handler(async ({ input, context, errors }) => {
    const [client] = await db
      .insert(oauthClients)
      .values({
        clientId: generateOAuthClientId(),
        name: input.name,
        redirectUris: input.redirectUris,
      })
      .returning();

    if (!client) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to register OAuth client.",
      });
    }

    return await serialize(OAuthClientSerializer, client, context.user);
  });
