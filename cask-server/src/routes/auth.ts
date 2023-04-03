import type { RouteHandlerMethod } from "fastify";
import { prisma } from "../lib/db";
import { createAccessToken } from "../lib/auth";
import { decode } from "jsonwebtoken";
import config from "../config";
import { verify } from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";

type GoogleCredential = {
  iss: string;
  nbf: number;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  azp: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  iat: number;
  exp: number;
  jti: string;
};

const jwksClient = new JwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v2/certs",
  timeout: 3000,
});

export const authGoogle: RouteHandlerMethod = async function (req, res) {
  const { token } = req.body;

  const response = decode(token, { complete: true });
  if (!response) {
    res.status(400).send({ error: "Invalid token (invalid)" });
    return;
  }

  const { header } = response;
  if (!header.kid) {
    res.status(400).send({ error: "Invalid token (kid)" });
    return;
  }

  const signingKey = await jwksClient.getSigningKey(header.kid);

  const payload = verify(token, signingKey.getPublicKey(), {
    algorithms: ["RS256"],
  }) as GoogleCredential | undefined;
  if (!payload) {
    res.status(400).send({ error: "Invalid token (verify)" });
    return;
  }

  if (
    payload.iss !== "https://accounts.google.com" ||
    payload.aud !== config.GOOGLE_CLIENT_ID
  ) {
    res.status(400).send({ error: "Invalid token (iss)" });
    return;
  }

  if (payload.exp < new Date().getTime() / 1000) {
    res.status(400).send({ error: "Invalid token (expired)" });
    return;
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
    user,
    accessToken: await createAccessToken(user),
  });
};
