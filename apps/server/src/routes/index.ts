import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import config from "../config";
import previewCommentEmail from "./debug/previewCommentEmail";
import triggerSentry from "./debug/triggerSentry";
import root from "./root";
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
  fastify.route(updateTastingImage);
  fastify.route(updateUserAvatar);
  fastify.route(uploads);

  if (config.ENV === "development") {
    registerDebugRoutes(fastify);
  }

  next();
};

function registerDebugRoutes(fastify: FastifyInstance) {
  fastify.route(triggerSentry);
  fastify.route(previewCommentEmail);
}
