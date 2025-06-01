import { ORPCError } from "@orpc/server";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { identities, users } from "@peated/server/db/schema";
import { createAccessToken, createUser } from "@peated/server/lib/auth";
import { procedure } from "@peated/server/orpc";
import { AuthSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { compareSync } from "bcrypt";
import { and, eq, sql } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";

export default procedure
  .route({
    method: "POST",
    path: "/auth/login",
    summary: "User login",
    description: "Authenticate user with email/password or Google OAuth code",
  })
  .input(
    z.union([
      z.object({
        email: z.string(),
        password: z.string(),
      }),
      z.object({
        code: z.string(),
      }),
    ])
  )
  .output(AuthSchema)
  .handler(async ({ input, errors }) => {
    const user =
      "code" in input
        ? await authGoogle(input.code)
        : await authBasic(input.email, input.password);

    if (!user.active) {
      throw errors.UNAUTHORIZED({
        message: "Invalid credentials.",
      });
    }
    return {
      user: await serialize(UserSerializer, user, user),
      accessToken: await createAccessToken(user),
    };
  });

async function authBasic(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()));
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid credentials.",
    });
  }

  if (!user.passwordHash) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid credentials.",
    });
  }

  if (!compareSync(password, user.passwordHash)) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid credentials.",
    });
  }

  return user;
}

async function authGoogle(code: string) {
  // https://stackoverflow.com/questions/74132586/authentication-using-node-js-oauthclient-auth-code-flow
  const client = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    "postmessage"
  );

  const { tokens } = await client.getToken(code);
  // client.setCredentials(tokens);

  if (!tokens.id_token) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Unable to validate credentials.",
    });
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Unable to validate credentials.",
    });
  }

  const [result] = await db
    .select({
      user: users,
    })
    .from(users)
    .innerJoin(identities, eq(users.id, identities.userId))
    .where(
      and(
        eq(identities.provider, "google"),
        eq(identities.externalId, payload.sub)
      )
    );
  let user = result?.user;
  if (user) return user;

  // try to associate w/ existing user
  const [foundUser] = await db
    .select()
    .from(users)
    .where(eq(sql`LOWER(${users.email})`, payload.email.toLowerCase()));
  if (foundUser) {
    // TODO: handle race condition
    await db.insert(identities).values({
      provider: "google",
      externalId: payload.sub,
      userId: foundUser.id,
    });
    user = foundUser;

    // create new account
  } else {
    const userData = {
      // displayName: payload.given_name,
      // TODO: handle conflicts on username
      username: payload.email.split("@", 1)[0].toLowerCase(),
      email: payload.email,
      verified: true, // emails are verified when coming from Google
    };

    user = await db.transaction(async (tx) => {
      const user = await createUser(tx, userData);

      await tx.insert(identities).values({
        provider: "google",
        externalId: payload.sub,
        userId: user.id,
      });

      return user;
    });
  }

  return user;
}
