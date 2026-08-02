import {
  ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  createAccessToken,
} from "@peated/server/lib/auth";
import { exchangeOAuthAuthorizationCode } from "@peated/server/lib/oauthAuthorization";
import { OAuthTokenRequestSchema } from "@peated/server/schemas";
import type { Context } from "hono";

function oauthResponse(
  context: Context,
  body: Record<string, string | number>,
  status: 200 | 400,
) {
  context.header("Cache-Control", "no-store");
  context.header("Pragma", "no-cache");
  return context.json(body, status);
}

export async function oauthTokenHandler(context: Context) {
  const contentType = context.req.header("content-type")?.split(";", 1)[0];
  if (contentType !== "application/x-www-form-urlencoded") {
    return oauthResponse(context, { error: "invalid_request" }, 400);
  }

  const body = await context.req.parseBody();
  const grantType = OAuthTokenRequestSchema.shape.grant_type.safeParse(
    body.grant_type,
  );
  if (grantType.success && grantType.data !== "authorization_code") {
    return oauthResponse(context, { error: "unsupported_grant_type" }, 400);
  }

  const parsed = OAuthTokenRequestSchema.safeParse(body);
  if (!parsed.success || parsed.data.grant_type !== "authorization_code") {
    return oauthResponse(context, { error: "invalid_request" }, 400);
  }

  const user = await exchangeOAuthAuthorizationCode({
    code: parsed.data.code,
    clientId: parsed.data.client_id,
    redirectUri: parsed.data.redirect_uri,
    codeVerifier: parsed.data.code_verifier,
  });
  if (!user) {
    return oauthResponse(context, { error: "invalid_grant" }, 400);
  }

  return oauthResponse(
    context,
    {
      access_token: await createAccessToken(user),
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    },
    200,
  );
}
