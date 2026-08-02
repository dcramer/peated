import { db, type AnyDatabase } from "@peated/server/db";
import {
  oauthAuthorizationCodes,
  oauthClients,
  users,
  type OAuthClient,
  type User,
} from "@peated/server/db/schema";
import {
  digestAuthorizationCode,
  generateAuthorizationCode,
  isRegisteredRedirectUri,
  verifyS256CodeChallenge,
} from "@peated/server/lib/oauth";
import {
  OAuthAuthorizationRequestSchema,
  type OAuthAuthorizationRequest,
} from "@peated/server/schemas/oauth";
import { and, eq, gt, isNull } from "drizzle-orm";

export const AUTHORIZATION_CODE_TTL_MS = 2 * 60 * 1000;

export async function findOAuthClientForAuthorization(
  request: OAuthAuthorizationRequest,
  conn: AnyDatabase = db,
): Promise<OAuthClient | null> {
  const parsed = OAuthAuthorizationRequestSchema.safeParse(request);
  if (!parsed.success) return null;

  const [client] = await conn
    .select()
    .from(oauthClients)
    .where(
      and(
        eq(oauthClients.clientId, parsed.data.clientId),
        eq(oauthClients.active, true),
      ),
    );

  if (
    !client ||
    !isRegisteredRedirectUri(parsed.data.redirectUri, client.redirectUris)
  ) {
    return null;
  }

  return client;
}

export async function issueOAuthAuthorizationCode({
  request,
  user,
  conn = db,
  now = new Date(),
}: {
  request: OAuthAuthorizationRequest;
  user: User;
  conn?: AnyDatabase;
  now?: Date;
}): Promise<{ code: string; redirectUri: string; state: string } | null> {
  const client = await findOAuthClientForAuthorization(request, conn);
  if (!client || !user.active) return null;

  const code = generateAuthorizationCode();
  const [created] = await conn
    .insert(oauthAuthorizationCodes)
    .values({
      codeDigest: digestAuthorizationCode(code),
      oauthClientId: client.id,
      userId: user.id,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      expiresAt: new Date(now.getTime() + AUTHORIZATION_CODE_TTL_MS),
    })
    .returning({ id: oauthAuthorizationCodes.id });

  if (!created) return null;
  return { code, redirectUri: request.redirectUri, state: request.state };
}

export interface OAuthAuthorizationCodeExchange {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}

export async function exchangeOAuthAuthorizationCode(
  input: OAuthAuthorizationCodeExchange,
  conn: AnyDatabase = db,
  now = new Date(),
): Promise<User | null> {
  return await conn.transaction(async (tx) => {
    const [record] = await tx
      .select({
        authorizationCode: oauthAuthorizationCodes,
        client: oauthClients,
        user: users,
      })
      .from(oauthAuthorizationCodes)
      .innerJoin(
        oauthClients,
        eq(oauthClients.id, oauthAuthorizationCodes.oauthClientId),
      )
      .innerJoin(users, eq(users.id, oauthAuthorizationCodes.userId))
      .where(
        eq(
          oauthAuthorizationCodes.codeDigest,
          digestAuthorizationCode(input.code),
        ),
      );

    if (
      !record ||
      !record.client.active ||
      !record.user.active ||
      record.client.clientId !== input.clientId ||
      record.authorizationCode.redirectUri !== input.redirectUri ||
      record.authorizationCode.expiresAt <= now ||
      record.authorizationCode.consumedAt ||
      !verifyS256CodeChallenge(
        input.codeVerifier,
        record.authorizationCode.codeChallenge,
      )
    ) {
      return null;
    }

    const [consumed] = await tx
      .update(oauthAuthorizationCodes)
      .set({ consumedAt: now })
      .where(
        and(
          eq(oauthAuthorizationCodes.id, record.authorizationCode.id),
          isNull(oauthAuthorizationCodes.consumedAt),
          gt(oauthAuthorizationCodes.expiresAt, now),
        ),
      )
      .returning({ id: oauthAuthorizationCodes.id });

    return consumed ? record.user : null;
  });
}
