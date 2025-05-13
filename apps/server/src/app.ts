import { RPCHandler } from "@orpc/server/fetch";
import { setUser } from "@sentry/core";
import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { setTimeout } from "node:timers/promises";
import config from "./config";
import { getUserFromHeader } from "./lib/auth";
import { router } from "./orpc/router";

const handler = new RPCHandler(router);

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

  .use("/rpc/*", async (c, next) => {
    const user = await getUserFromHeader(c.req.header("authorization"));

    user
      ? setUser({
          id: `${user.id}`,
          username: user.username,
          email: user.email,
        })
      : setUser(null);

    const { matched, response } = await handler.handle(c.req.raw, {
      prefix: "/rpc",
      context: { user }, // Provide initial context if needed
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    await next();
  });

export type AppType = typeof app;
