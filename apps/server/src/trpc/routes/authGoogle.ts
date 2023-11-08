import { and, eq } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";

import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { identities, users } from "@peated/server/db/schema";
import { createAccessToken, createUser } from "@peated/server/lib/auth";
import { serialize } from "@peated/server/serializers";
import { UserSerializer } from "@peated/server/serializers/user";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "..";

export default publicProcedure
  .input(
    z.object({
      code: z.string(),
    }),
  )
  .mutation(async function ({ input: { code } }) {
    // https://stackoverflow.com/questions/74132586/authentication-using-node-js-oauthclient-auth-code-flow
    const client = new OAuth2Client(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      "postmessage",
    );

    const { tokens } = await client.getToken(code);
    // client.setCredentials(tokens);

    if (!tokens.id_token) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Unable to validate credentials.",
      });
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
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
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Unable to validate credentials.",
      });
    }

    return {
      user: await serialize(UserSerializer, user, user),
      accessToken: await createAccessToken(user),
    };
  });
