import type { RouteHandlerMethod } from "fastify";
import { prisma } from "../lib/db";
import { createAccessToken } from "../lib/auth";

export const googleCallback: RouteHandlerMethod = async function (req, res) {
  const { token } =
    await this.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);

  let user = await prisma.identity.findUnique({
    where: { provider: "google", externalId: token },
  });

  return res.send({
    data: { user, accessToken: await createAccessToken(data) },
  });
};
