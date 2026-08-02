import { db } from "@peated/server/db";
import { oauthClients } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { OAuthClientSchema, listResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { OAuthClientSerializer } from "@peated/server/serializers/oauthClient";
import { asc } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/oauth-clients",
    summary: "List OAuth clients",
    operationId: "listOAuthClients",
  })
  .input(z.object({}))
  .output(listResponse(OAuthClientSchema))
  .handler(async ({ context }) => {
    const results = await db
      .select()
      .from(oauthClients)
      .orderBy(asc(oauthClients.name));

    return {
      results: await serialize(OAuthClientSerializer, results, context.user),
      rel: { nextCursor: null, prevCursor: null },
    };
  });
