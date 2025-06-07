import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { captureException, flush, setUser } from "@sentry/core";
import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import config from "./config";
import { render } from "./entry-server";

const app = new Hono()
  // Sentry error capture wrapper
  .use("*", async (c, next) => {
    try {
      await next();
    } catch (err) {
      captureException(err, {
        mechanism: { handled: false, type: "hono" },
      });
      throw err;
    } finally {
      await flush(2000);
    }
  })
  // Request logging
  .use("*", logger())
  // CORS configuration
  .use(
    "*",
    cors({
      credentials: true,
      origin: config.URL_PREFIX.split(","),
      maxAge: 600,
    })
  )
  // Cache control for HTML responses
  .use(
    "*",
    cache({
      cacheName: "ssr",
      cacheControl: "private, no-cache, no-store, max-age=0, must-revalidate",
    })
  )
  // Security headers
  .use(
    "*",
    secureHeaders({
      crossOriginResourcePolicy: "same-site",
    })
  )
  // Development mode enhancements
  .use("*", async (c, next) => {
    if (config.ENV === "development") {
      // Add small delay to simulate network conditions
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await next();
  })
  // Health check endpoint
  .get("/_health", (c) => {
    return c.json({ ok: true, service: "ssr" });
  })
  // Serve static files from the client build
  .use("/assets/*", serveStatic({ root: "./dist/client" }))
  .use("/favicon.ico", serveStatic({ root: "./dist/client" }))
  // SSR handler for all routes
  .get("*", async (c) => {
    try {
      // TODO: Extract user info from request/session for Sentry context
      // setUser({ id: user?.id, username: user?.username, email: user?.email });

      const { html, state, statusCode } = await render(c.req.url, {
        request: c.req,
      });

      const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Peated</title>
          </head>
          <body>
            <div id="root">${html}</div>
            <script>
              window.__INITIAL_STATE__ = ${JSON.stringify(state)};
            </script>
            <script type="module" src="/assets/entry-client.js"></script>
          </body>
        </html>
      `;

      return new Response(fullHtml, {
        status: statusCode,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    } catch (error) {
      console.error("SSR Render Error:", error);
      captureException(error, {
        tags: { component: "ssr-render" },
        extra: { url: c.req.url },
      });

      // Return a basic HTML error page instead of just text
      const errorHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Error - Peated</title>
          </head>
          <body>
            <div id="root">
              <div style="padding: 20px; text-align: center;">
                <h1>Something went wrong</h1>
                <p>We're having trouble loading this page. Please try again later.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      return new Response(errorHtml, {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }
  });

const port = process.env.PORT ? Number.parseInt(process.env.PORT) : 3000;

console.log(`🚀 SSR Server starting on http://localhost:${port}`);
console.log(`📦 Environment: ${config.ENV}`);
console.log(`🎯 API Server: ${config.API_SERVER}`);

serve({
  fetch: app.fetch,
  port,
});

export type SSRAppType = typeof app;
