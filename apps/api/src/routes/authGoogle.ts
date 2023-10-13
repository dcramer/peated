import { and, eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { OAuth2Client } from "google-auth-library";
import type { IncomingMessage, Server, ServerResponse } from "http";
import zodToJsonSchema from "zod-to-json-schema";

import { AuthSchema } from "@peated/shared/schemas";

import { db } from "@peated/shared/db";
import { identities, users } from "@peated/shared/db/schema";
import config from "../config";
import { createAccessToken, createUser } from "../lib/auth";
import { serialize } from "../lib/serializers";
import { UserSerializer } from "../lib/serializers/user";

export default {
  method: "POST",
  url: "/auth/google",
  schema: {
    body: {
      type: "object",
      required: ["code"],
      properties: {
        code: { type: "string" },
      },
    },
    response: {
      200: zodToJsonSchema(AuthSchema),
    },
  },
  handler: async function (req, res) {
    const { code } = req.body;

    // https://stackoverflow.com/questions/74132586/authentication-using-node-js-oauthclient-auth-code-flow
    const client = new OAuth2Client(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      "postmessage",
    );

    const { tokens } = await client.getToken(code);
    // client.setCredentials(tokens);

    if (!tokens.id_token) {
      return res.status(401).send({ error: "Unable to validate credentials" });
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).send({ error: "Unable to validate credentials" });
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

    // try to associate w/ existing user
    if (!user) {
      const [foundUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, payload.email));
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
        console.log("Creating new user");
        const userData = {
          displayName: payload.given_name,
          username: payload.email.split("@", 1)[0],
          email: payload.email,
        };

        user = await db.transaction(async (tx) => {
          const user = await createUser(db, userData);

          await tx.insert(identities).values({
            provider: "google",
            externalId: payload.sub,
            userId: user.id,
          });

          return user;
        });
      }
    }

    if (!user.active) {
      return res.status(401).send({ error: "Inactive account" });
    }

    return res.send({
      user: await serialize(UserSerializer, user, user),
      accessToken: await createAccessToken(user),
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: {
      code: string;
    };
  }
>;
