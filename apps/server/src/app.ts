import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodSmartCoercionPlugin, ZodToJsonSchemaConverter } from "@orpc/zod";
import { setUser } from "@sentry/core";
import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { setTimeout } from "node:timers/promises";
import config from "./config";
import { getUserFromHeader } from "./lib/auth";
import { router } from "./orpc/router";

const openapiHandler = new OpenAPIHandler(router, {
  plugins: [new ZodSmartCoercionPlugin()],
});
const openAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const rpcHandler = new RPCHandler(router);

export const app = new Hono()
  .use(
    cors({
      credentials: true,
      origin: config.CORS_HOST,
      maxAge: 600,
    }),
  )
  .use(
    cache({
      cacheName: "default",
      cacheControl: "private, no-cache, no-store, max-age=0, must-revalidate",
    }),
  )

  .use(
    secureHeaders({
      crossOriginResourcePolicy: "same-site",
      // contentSecurityPolicy: false,
    }),
  )
  .use(async (c, next) => {
    if (config.ENV === "development") {
      console.log("Adding 300ms delay to all requests");

      await setTimeout(300);
    }

    await next();
  })
  .get("/_health", (c) => {
    return c.json({ ok: true });
  })
  .get("/robots.txt", (c) => {
    return c.text("User-agent: *\nDisallow: /");
  })
  .get("/", async (c) => {
    return c.html(`
      <!doctype html>
      <html>
        <head>
          <title>My Client</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" type="image/svg+xml" href="https://orpc.unnoq.com/icon.svg" />
        </head>
        <body>
          <div id="app"></div>
  
          <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
          <script>
            Scalar.createApiReference('#app', {
              url: '/spec.json',
              authentication: {
                securitySchemes: {
                  bearerAuth: {
                    token: 'default-token',
                  },
                },
              },
            })
          </script>
        </body>
      </html>
    `);
  })
  .get("/spec.json", async (c) => {
    return c.json(
      openAPIGenerator.generate(router, {
        info: {
          title: "Peated API",
          version: "1.0.0",
          description: "The Peated API",
        },
      }),
    );
  })
  .use("/v1*", async (c, next) => {
    const user = await getUserFromHeader(c.req.header("authorization"));

    user
      ? setUser({
          id: `${user.id}`,
          username: user.username,
          email: user.email,
        })
      : setUser(null);

    const { matched, response } = await openapiHandler.handle(c.req.raw, {
      prefix: "/v1",
      context: { user }, // Provide initial context if needed
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    await next();
  })
  .use("/rpc/*", async (c, next) => {
    const user = await getUserFromHeader(c.req.header("authorization"));

    user
      ? setUser({
          id: `${user.id}`,
          username: user.username,
          email: user.email,
        })
      : setUser(null);

    const { matched, response } = await rpcHandler.handle(c.req.raw, {
      prefix: "/rpc",
      context: { user }, // Provide initial context if needed
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    await next();
  });

export type AppType = typeof app;
