import { Storage } from "@google-cloud/storage";
import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { onError, ORPCError, ValidationError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { ZodSmartCoercionPlugin, ZodToJsonSchemaConverter } from "@orpc/zod";
import {
  captureException,
  continueTrace,
  flush,
  getHttpSpanDetailsFromUrlObject,
  parseStringToURLObject,
  setHttpStatus,
  setUser,
  startSpan,
} from "@sentry/core";
import { open } from "fs/promises";
import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { contentType } from "mime-types";
import { setTimeout } from "node:timers/promises";
import { format } from "path";
import type { ZodIssue } from "zod";
import { ZodError } from "zod";
import config from "./config";
import { getUserFromHeader } from "./lib/auth";
import { logError } from "./lib/log";
import router from "./orpc/router";

const openapiHandler = new OpenAPIHandler(router, {
  plugins: [new ZodSmartCoercionPlugin()],
});
const openAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const rpcHandler = new RPCHandler(router, {
  plugins: [new BatchHandlerPlugin()],

  clientInterceptors: [
    onError((error) => {
      if (
        error instanceof ORPCError &&
        error.code === "BAD_REQUEST" &&
        error.cause instanceof ValidationError
      ) {
        // If you only use Zod you can safely cast to ZodIssue[]
        const zodError = new ZodError(error.cause.issues as ZodIssue[]);

        throw new ORPCError("INPUT_VALIDATION_FAILED", {
          status: 422,
          data: zodError.flatten(),
          cause: error.cause,
        });
      }

      if (
        error instanceof ORPCError &&
        error.code === "INTERNAL_SERVER_ERROR" &&
        error.cause instanceof ValidationError
      ) {
        const zodError = new ZodError(error.cause.issues as ZodIssue[]);

        logError(error, {
          zod: {
            error: zodError.flatten(),
          },
        });
        throw new ORPCError("OUTPUT_VALIDATION_FAILED", {
          cause: error.cause,
        });
      }
    }),
  ],
});

// File upload handler constants
const ONE_DAY = 60 * 60 * 24;

export const app = new Hono()
  .use(async (c, next) => {
    const urlObject = parseStringToURLObject(c.req.url);
    const [name, attributes] = getHttpSpanDetailsFromUrlObject(
      urlObject,
      "server",
      "auto.http.hono",
      c.req,
    );

    try {
      await continueTrace(
        {
          sentryTrace: c.req.header("sentry-trace") || "",
          baggage: c.req.header("baggage"),
        },
        async () => {
          await startSpan(
            {
              name,
              attributes,
            },
            async (span) => {
              try {
                await next();
                setHttpStatus(span, c.res.status);
              } catch (err) {
                setHttpStatus(span, 500);
                captureException(err, {
                  mechanism: { handled: false, type: "hono" },
                });
                throw err;
              }
            },
          );
        },
      );
    } finally {
      await flush(2000);
    }
  })
  // TODO: Sentry needs Hono support
  .onError((err, c) => {
    logError(err);
    return c.json({ error: "Internal Server Error" }, 500);
  })
  .use(logger())
  .use(
    "*",
    cors({
      credentials: true,
      origin: config.CORS_HOST,
      maxAge: 600,
    }),
  )
  .use(
    "*",
    cache({
      cacheName: "default",
      cacheControl: "private, no-cache, no-store, max-age=0, must-revalidate",
    }),
  )

  .use(
    "*",
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
  // File upload handler
  .get("/uploads/:filename", async (c) => {
    const filename = c.req.param("filename");

    let stream;
    if (process.env.USE_GCS_STORAGE) {
      const bucketName = process.env.GCS_BUCKET_NAME as string;
      const bucketPath = process.env.GCS_BUCKET_PATH
        ? `${process.env.GCS_BUCKET_PATH}/`
        : "";

      const cloudStorage = new Storage({
        credentials: config.GCP_CREDENTIALS,
      });
      const file = cloudStorage
        .bucket(bucketName)
        .file(`${bucketPath}${filename}`);

      stream = file.createReadStream();
    } else {
      const filepath = format({
        dir: config.UPLOAD_PATH,
        base: filename,
      });

      try {
        const fd = await open(filepath, "r");
        stream = fd.createReadStream();
      } catch (err) {
        return c.notFound();
      }
    }

    // Set appropriate headers
    c.header("Cache-Control", `public, max-age=${ONE_DAY}`);
    c.header(
      "Content-Type",
      contentType(filename) || "application/octet-stream",
    );

    // Return the stream
    // TODO: fix this
    return c.body(stream as any);
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
      await openAPIGenerator.generate(router, {
        info: {
          title: "Peated API",
          version: "1.0.0",
          description: "The Peated API",
        },
        servers: [{ url: "/v1" } /** Should use absolute URLs in production */],
      }),
    );
  })
  .use("/v1/*", async (c, next) => {
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
