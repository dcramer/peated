import { findOAuthClientForAuthorization } from "@peated/server/lib/oauthAuthorization";
import { procedure } from "@peated/server/orpc";
import {
  OAuthAuthorizationClientSchema,
  OAuthAuthorizationRequestSchema,
} from "@peated/server/schemas";

export default procedure
  .route({
    method: "GET",
    path: "/oauth/authorization-details",
    summary: "Validate OAuth authorization request",
    operationId: "getOAuthAuthorizationDetails",
  })
  .input(OAuthAuthorizationRequestSchema)
  .output(OAuthAuthorizationClientSchema)
  .handler(async ({ input, errors }) => {
    const client = await findOAuthClientForAuthorization(input);
    if (!client) {
      throw errors.BAD_REQUEST({ message: "Invalid authorization request." });
    }

    return { clientId: client.clientId, name: client.name };
  });
