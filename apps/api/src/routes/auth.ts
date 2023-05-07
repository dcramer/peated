import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";

import { prisma } from "../lib/db";
import { createAccessToken, serializeUser } from "../lib/auth";
import config from "../config";
import { compareSync } from "bcrypt";
import { validateRequest } from "../middleware/auth";
import { OAuth2Client } from "google-auth-library";

export const authDetails: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse
> = {
  method: "GET",
  url: "/auth",
  preHandler: [validateRequest],
  handler: async function (req, res) {
    // this would be a good palce to add refreshTokens (swap to POST for that)
    const user = await prisma.user.findFirst({
      where: {
        id: req.user.id,
      },
    });
    if (!user) {
      return res.status(401).send({ error: "Unauthorized" });
    }

    return res.send({ user: serializeUser(user, user) });
  },
};

export const authBasic: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: {
      email: string;
      password: string;
    };
  }
> = {
  method: "POST",
  url: "/auth/basic",
  schema: {
    body: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string" },
        password: { type: "string" },
      },
    },
  },
  handler: async function (req, res) {
    const { email, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!user) {
      return res.status(401).send({ error: "Invalid credentials" });
    }

    if (!user.passwordHash) {
      return res.status(401).send({ error: "Invalid credentials" });
    }

    if (!compareSync(password, user.passwordHash)) {
      return res.status(401).send({ error: "Invalid credentials" });
    }

    return res.send({
      user: serializeUser(user, user),
      accessToken: await createAccessToken(user),
    });
  },
};

export const authGoogle: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: {
      code: string;
    };
  }
> = {
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
  },
  handler: async function (req, res) {
    const { code } = req.body;

    // https://stackoverflow.com/questions/74132586/authentication-using-node-js-oauthclient-auth-code-flow
    const client = new OAuth2Client(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      "postmessage"
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

    let user = await prisma.user.findFirst({
      where: {
        identities: {
          some: { provider: "google", externalId: payload.sub },
        },
      },
    });
    if (!user) {
      console.log("Creating new user");
      user = await prisma.user.create({
        data: {
          displayName: payload.given_name,
          email: payload.email,
          identities: {
            create: [
              {
                provider: "google",
                externalId: payload.sub,
              },
            ],
          },
        },
      });
    }

    return res.send({
      user: serializeUser(user, user),
      accessToken: await createAccessToken(user),
    });
  },
};
