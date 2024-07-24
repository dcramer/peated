import { db } from "@peated/server/db";
import { buildCommentHtml } from "@peated/server/lib/email";
import type { RouteOptions } from "fastify";
import type { IncomingMessage, Server, ServerResponse } from "http";

export default {
  method: "GET",
  url: "/debug/previewCommentEmail",
  handler: async (req, res) => {
    const comment = (await db.query.comments.findFirst({
      with: {
        tasting: {
          with: {
            bottle: true,
            createdBy: true,
          },
        },
        createdBy: true,
      },
    })) || {
      id: 1,
      comment:
        "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).",
      tasting: {
        id: 2,
        bottle: {
          fullName: "Macallan 12-year-old",
        },
      },
      createdBy: {
        username: "jane.doe",
        pictureUrl: null,
      },
    };
    const html = buildCommentHtml(comment);
    res.type("text/html").send(html);
  },
} as RouteOptions<Server, IncomingMessage, ServerResponse>;
