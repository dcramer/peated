import type { FastifyInstance } from "fastify";
import { buildCommentHtml } from "../lib/email";

export default async function routes(fastify: FastifyInstance) {
  fastify.get("/debug/email/comment", async (request, reply) => {
    const html = buildCommentHtml({
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
    });

    reply.header("Content-Type", "text/html");
    reply.send(html);
  });
}
