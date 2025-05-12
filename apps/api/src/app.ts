import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import { isHttpError, messagesByCodes } from "http-errors-enhanced";
import config from "./config";
import { logError } from "./lib/log";
import { injectAuth } from "./middleware/auth";
import adminQueueInfoRoutes from "./routes/adminQueueInfo";
import authRoutes from "./routes/auth";
import authRegisterRoutes from "./routes/authRegister";
import countriesRoutes from "./routes/countries";
import metaRoutes from "./routes/meta";
import regionsRoutes from "./routes/regions";

const processRoot = process.cwd();

type ErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  stack?: string[];
};

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

  .onError((err, c) => {
    if (isHttpError(err)) {
      return c.json<ErrorResponse>(
        {
          message: err.message,
          error: messagesByCodes[err.statusCode],
          statusCode: err.statusCode,
          code: err.code,
          stack:
            process.env.NODE_ENV === "development" && err.stack
              ? err.stack
                  .split("\n")
                  .slice(1)
                  .map((s) =>
                    s.trim().replace(/^at /, "").replace(processRoot, "$ROOT"),
                  )
              : undefined,
        },
        err.statusCode as any,
      );
    }
    logError(err);
    return c.json<ErrorResponse>(
      {
        message: "Internal server error.",
        error: messagesByCodes[500],
        statusCode: 500,
      },
      500,
    );
  })

  .use(injectAuth)

  .route("/v1", metaRoutes)
  .route("/v1/auth", authRoutes)
  .route("/v1/auth/register", authRegisterRoutes)
  .route("/v1/countries", countriesRoutes)
  .route("/v1/regions", regionsRoutes)
  .route("/v1/admin/queue-info", adminQueueInfoRoutes);

export type AppType = typeof app;
