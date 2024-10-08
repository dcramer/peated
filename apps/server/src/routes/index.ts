import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import triggerSentry from "./debug/triggerSentry";
import root from "./root";
import updateBadgeImage from "./updateBadgeImage";
import updateBottleImage from "./updateBottleImage";
import updateTastingImage from "./updateTastingImage";
import updateUserAvatar from "./updateUserAvatar";
import uploads from "./uploads";

const ROBOTS = `User-agent: *
Disallow: /`;

export const router: FastifyPluginCallback = (
  fastify: FastifyInstance,
  _opts,
  next,
) => {
  fastify.decorateRequest("user", null);

  fastify.addHook("onRequest", (req, res, next) => {
    req.user = null;
    next();
  });

  fastify.route({
    method: "GET",
    url: "/_health",
    handler: (_, res) => {
      res.status(200).send();
    },
  });

  fastify.route({
    method: "GET",
    url: "/robots.txt",
    handler: (_, res) => {
      res.status(200).type("text/plain").send(ROBOTS);
    },
  });

  fastify.route(root);
  fastify.route(updateBadgeImage);
  fastify.route(updateBottleImage);
  fastify.route(updateTastingImage);
  fastify.route(updateUserAvatar);
  fastify.route(uploads);

  if (process.env.NODE_ENV !== "production") {
    registerDebugRoutes(fastify);
  }

  next();
};

function registerDebugRoutes(fastify: FastifyInstance) {
  fastify.route(triggerSentry);
}
