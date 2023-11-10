import { db } from "@peated/server/db";
import { buildCommentHtml } from "@peated/server/lib/email";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

export default {
  method: "GET",
  url: "/debug/previewCommentEmail",
  handler: async (req, res) => {
    const comment = await db.query.comments.findFirst({
      with: {
        tasting: {
          with: {
            bottle: true,
            createdBy: true,
          },
        },
        createdBy: true,
      },
    });
    if (!comment)
      return res.status(400).send("No comment found to generate preview with.");
    const html = buildCommentHtml(comment);
    res.type("text/html").send(html);
  },
} as RouteOptions<Server, IncomingMessage, ServerResponse>;
