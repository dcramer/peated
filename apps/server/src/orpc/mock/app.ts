import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFile } from "node:fs/promises";
import { mockAccessToken, mockUser } from "./fixtures";
import { mockRouter } from "./router";

const rpcHandler = new RPCHandler(mockRouter, {
  plugins: [new BatchHandlerPlugin()],
});

const mockAssets = new Map([
  [
    "cairdeas-warehouse-1.webp",
    {
      path: new URL(
        "../../../__fixtures__/tasting-images/tasting5.webp",
        import.meta.url,
      ),
      type: "image/webp",
    },
  ],
  [
    "cairdeas-white-port-madeira.webp",
    {
      path: new URL(
        "../../../__fixtures__/tasting-images/tasting6.webp",
        import.meta.url,
      ),
      type: "image/webp",
    },
  ],
  [
    "profile.jpg",
    {
      path: new URL(
        "../../lib/test/assets/sample-square-image.jpg",
        import.meta.url,
      ),
      type: "image/jpeg",
    },
  ],
]);

export const mockApp = new Hono()
  .use(
    "*",
    cors({
      origin: process.env.CORS_HOST ?? "http://localhost:3200",
      allowHeaders: [
        "Authorization",
        "Content-Type",
        "baggage",
        "sentry-trace",
      ],
    }),
  )
  .get("/_health", (c) => c.json({ ok: true }))
  .get("/_assets/:name", async (c) => {
    const asset = mockAssets.get(c.req.param("name"));
    if (!asset) return c.notFound();

    return c.body(await readFile(asset.path), 200, {
      "Content-Type": asset.type,
      "Cache-Control": "public, max-age=3600",
    });
  })
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
