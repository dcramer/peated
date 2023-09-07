import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

export default {
  method: "GET",
  url: "/debug/triggerSentry",
  handler: async (req, res) => {
    throw new Error("This is a test.");
  },
} as RouteOptions<Server, IncomingMessage, ServerResponse>;
