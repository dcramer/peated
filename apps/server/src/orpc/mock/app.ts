import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { mockAccessToken, mockUser } from "./fixtures";
import { mockRouter } from "./router";

const rpcHandler = new RPCHandler(mockRouter, {
  plugins: [new BatchHandlerPlugin()],
});

export const mockApp = new Hono()
  .use(
    "*",
    cors({
      origin: "http://localhost:3200",
      allowHeaders: [
        "Authorization",
        "Content-Type",
        "baggage",
        "sentry-trace",
      ],
    }),
  )
  .get("/_health", (c) => c.json({ ok: true }))
  .use("*", async (c, next) => {
    if (c.req.path !== "/rpc" && !c.req.path.startsWith("/rpc/")) {
      await next();
      return;
    }

    const { matched, response } = await rpcHandler.handle(c.req.raw, {
      prefix: "/rpc",
      context: {
        user:
          c.req.header("authorization") === `Bearer ${mockAccessToken}`
            ? mockUser
            : null,
      },
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    return c.json(
      {
        code: "NOT_FOUND",
        message: "The mock API does not support this route.",
      },
      404,
    );
  });
