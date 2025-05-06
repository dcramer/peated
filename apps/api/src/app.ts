import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import config from "./config";
import type { User } from "./db/schema";
import { injectAuth } from "./middleware/auth";
import authRoutes from "./routes/auth";

declare module "hono" {
  interface Variables {
    user: User | null;
  }
}

export default async function buildApp(options = {}) {
  const app = new Hono()
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

    .use(injectAuth);

  app.route("/v1/auth", authRoutes);

  return app;
}

export const app = await buildApp();
