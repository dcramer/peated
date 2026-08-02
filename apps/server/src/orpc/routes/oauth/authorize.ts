import { issueOAuthAuthorizationCode } from "@peated/server/lib/oauthAuthorization";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import {
  OAuthAuthorizationCodeSchema,
  OAuthAuthorizationRequestSchema,
} from "@peated/server/schemas";

export default procedure
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/oauth/authorization-code",
    summary: "Approve OAuth authorization request",
    operationId: "createOAuthAuthorizationCode",
  })
  .input(OAuthAuthorizationRequestSchema)
  .output(OAuthAuthorizationCodeSchema)
  .handler(async ({ input, context, errors }) => {
    const result = await issueOAuthAuthorizationCode({
      request: input,
      user: context.user,
    });
    if (!result) {
      throw errors.BAD_REQUEST({ message: "Invalid authorization request." });
    }

    return result;
  });
