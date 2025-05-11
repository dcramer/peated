import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import { isHttpError, serializeError } from "http-errors-enhanced";
import config from "./config";
import { logError } from "./lib/log";
import { injectAuth } from "./middleware/auth";
import adminQueueInfoRoutes from "./routes/adminQueueInfo";
import authRoutes from "./routes/auth";
import authRegisterRoutes from "./routes/authRegister";
import metaRoutes from "./routes/meta";

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

    .onError((err, c) => {
      if (isHttpError(err)) {
        return c.json(serializeError(err), err.statusCode as any);
      }
      logError(err);
      throw err;
    })

    .use(injectAuth);

  app.route("/v1", metaRoutes);
  app.route("/v1/auth", authRoutes);
  app.route("/v1/auth/register", authRegisterRoutes);
  app.route("/v1/admin/queue-info", adminQueueInfoRoutes);

  return app;
}

export const app = await buildApp();
