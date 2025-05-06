import { requestContext } from "@fastify/request-context";
import config from "@peated/api/config";
import { db } from "@peated/api/db";
import { identities, users } from "@peated/api/db/schema";
import { createAccessToken, createUser } from "@peated/api/lib/auth";
import { logError } from "@peated/api/lib/log";
import { UserSchema } from "@peated/api/schemas";
import { serialize } from "@peated/api/serializers";
import { UserSerializer } from "@peated/api/serializers/user";
import { compareSync } from "bcrypt";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyPluginAsyncZodOpenApi } from "fastify-zod-openapi";
import { OAuth2Client } from "google-auth-library";
import { UnauthorizedError, unauthorizedSchema } from "http-errors-enhanced";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

const plugin: FastifyPluginAsyncZodOpenApi = async (fastify, _opts) => {
  fastify
    .get(
      "/",
      {
        schema: {
          response: {
            200: zodToJsonSchema(z.object({ user: UserSchema })),
            401: unauthorizedSchema,
          },
        },
      },
      async function (_request, _reply) {
        const currentUser = requestContext.get("user");
        if (!currentUser) {
          throw new UnauthorizedError();
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, currentUser.id));
        if (!user) {
          logError(
            `Authenticated user (${currentUser.id}) failed to retrieve details`,
          );
          throw new UnauthorizedError();
        }

        if (!user.active) {
          throw new UnauthorizedError();
        }

        return { user: await serialize(UserSerializer, user, user) };
      },
    )
    .post(
      "/",
      {
        schema: {
          body: z.union([
            z.object({
              email: z.string().email(),
              password: z.string(),
            }),
            z.object({
              googleCode: z.string(),
            }),
          ]),
          200: zodToJsonSchema(
            z.object({ user: UserSchema, accessToken: z.string() }),
          ),
          401: unauthorizedSchema,
        },
      },
      async function (request, _reply) {
        let user;
        if ("googleCode" in request.body) {
          user = await authGoogle(request.body.googleCode);
        } else {
          user = await authBasic(request.body.email, request.body.password);
        }

        if (!user.active) {
          throw new UnauthorizedError("Invalid credentials.");
        }

        return {
          user: await serialize(UserSerializer, user, user),
          accessToken: await createAccessToken(user),
        };
      },
    );
};

export default plugin;

async function authBasic(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()));
  if (!user) {
    console.log("user not found");
    throw new UnauthorizedError("Invalid credentials.");
  }

  if (!user.passwordHash) {
    console.log("user has no password set");
    throw new UnauthorizedError("Invalid credentials.");
  }

  if (!compareSync(password, user.passwordHash)) {
    console.log("invalid password");
    throw new UnauthorizedError("Invalid credentials.");
  }

  return user;
}

async function authGoogle(code: string) {
  // https://stackoverflow.com/questions/74132586/authentication-using-node-js-oauthclient-auth-code-flow
  const client = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    "postmessage",
  );

  const { tokens } = await client.getToken(code);
  // client.setCredentials(tokens);

  if (!tokens.id_token) {
    throw new UnauthorizedError("Unable to validate credentials.");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new UnauthorizedError("Unable to validate credentials.");
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
        eq(identities.externalId, payload.sub),
      ),
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
