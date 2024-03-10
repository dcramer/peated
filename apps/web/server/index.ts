import prom from "@isaacs/express-prometheus-middleware";
import { sentryLink } from "@peated/server/lib/trpc";
import { type AppRouter } from "@peated/server/trpc/router";
import config from "@peated/web/config";
import { ApiClient } from "@peated/web/lib/api";
import {
  getAccessToken,
  getSession,
  getUser,
  logout,
} from "@peated/web/services/session.server";
import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import { type AppLoadContext } from "@remix-run/server-runtime";
import * as Sentry from "@sentry/remix";
import { wrapExpressCreateRequestHandler } from "@sentry/remix";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import compression from "compression";
import type { Request } from "express";
import express from "express";
import morgan from "morgan";

installGlobals();

Sentry.init({
  dsn: config.SENTRY_DSN,
  release: config.VERSION,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations(),
  ],
  spotlight: config.ENV === "development",
  // tracePropagationTargets: ["localhost", "peated.com", config.API_SERVER],
});

Sentry.setTag("service", "@peated/web");

function getLoadContext(req: Request): AppLoadContext {
  const trpc = createTRPCProxyClient<AppRouter>({
    links: [
      sentryLink(Sentry.captureException),
      httpBatchLink({
        url: `${config.API_SERVER}/trpc`,
        async headers() {
          return {
            authorization: req.accessToken ? `Bearer ${req.accessToken}` : "",
          };
        },
      }),
    ],
  });

  return {
    api: req.api,
    user: req.user,
    accessToken: req.accessToken,
    trpc,
  };
}

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? undefined
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        }),
      );

const createSentryRequestHandler =
  wrapExpressCreateRequestHandler(createRequestHandler);

const remixHandler = createSentryRequestHandler({
  build: viteDevServer
    ? await viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : await import("#/build/server/index.js"),
  getLoadContext,
});

const app = express();
const metricsApp = express();

app.use(
  prom({
    metricsPath: "/metrics",
    collectDefaultMetrics: true,
    metricsApp,
  }),
);

app.use((req, res, next) => {
  // helpful headers:
  res.set("Strict-Transport-Security", `max-age=${60 * 60 * 24 * 365 * 100}`);

  // /clean-urls/ -> /clean-urls
  if (req.path.endsWith("/") && req.path.length > 1) {
    const query = req.url.slice(req.path.length);
    const safepath = req.path.slice(0, -1).replace(/\/+/g, "/");
    res.redirect(301, safepath + query);
    return;
  }
  next();
});

app.use((req, res, next) => {
  // redirect old domain to new
  if (req.hostname.startsWith("peated.app"))
    return res.redirect(301, `https://peated.com${req.url}`);

  // helpful headers:
  res.set("Strict-Transport-Security", `max-age=${60 * 60 * 24 * 365 * 100}`);

  // /clean-urls/ -> /clean-urls
  if (req.path.endsWith("/") && req.path.length > 1) {
    const query = req.url.slice(req.path.length);
    const safepath = req.path.slice(0, -1).replace(/\/+/g, "/");
    res.redirect(301, safepath + query);
    return;
  }
  next();
});

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// Remix fingerprints its assets so we can cache forever.
if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  app.use(
    "/build",
    express.static("public/build", { immutable: true, maxAge: "1y" }),
  );
}

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("public", { maxAge: "1h" }));

app.use(morgan("tiny"));

app.all("*", async (req, res, next) => {
  const session = await getSession(req);
  const user = await getUser(session);
  const accessToken = await getAccessToken(session);

  Sentry.setUser(
    user
      ? {
          id: `${user?.id}`,
          username: user?.username,
          email: user?.email,
          ip_address: req.ip,
        }
      : {
          ip_address: req.ip,
        },
  );

  req.user = user || null;
  req.accessToken = accessToken || null;
  req.api = new ApiClient({
    server: config.API_SERVER,
    accessToken,
  });

  if (accessToken && !user) {
    return logout(req);
  }

  next();
});

app.all("*", remixHandler);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`✅ app ready: http://localhost:${port}`);
});
