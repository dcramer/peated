import * as Sentry from "@sentry/remix";

Sentry.init({
  dsn: config.SENTRY_DSN,
  release: config.VERSION,
  tracesSampleRate: 1.0,
  spotlight: config.ENV === "development",
  // tracePropagationTargets: ["localhost", "peated.com", config.API_SERVER],
});

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
import { type AppLoadContext } from "@remix-run/server-runtime";

import { wrapExpressCreateRequestHandler } from "@sentry/remix";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import compression from "compression";
import type { Request } from "express";
import express from "express";
import morgan from "morgan";
import path from "path";
import { clearQueryClient } from "./app/hooks/useSingletonQueryClient";

Sentry.setTag("service", "@peated/web");

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
app.use(
  "/build",
  express.static("public/build", { immutable: true, maxAge: "1y" }),
);

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

  if (user || accessToken) {
    res.set("Cache-Control", "private");
  }

  if (accessToken && !user) {
    return logout(req);
  }

  clearQueryClient();

  next();
});

function getLoadContext(req: Request): AppLoadContext {
  const trpc = createTRPCProxyClient<AppRouter>({
    links: [
      sentryLink(),
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

const MODE = process.env.NODE_ENV;
const BUILD_DIR = path.join(process.cwd(), "build");

const createSentryRequestHandler =
  wrapExpressCreateRequestHandler(createRequestHandler);

app.all(
  "*",
  MODE === "production"
    ? createSentryRequestHandler({ build: require(BUILD_DIR), getLoadContext })
    : (...args) => {
        purgeRequireCache();
        const requestHandler = createSentryRequestHandler({
          build: require(BUILD_DIR),
          mode: MODE,
          getLoadContext,
        });
        return requestHandler(...args);
      },
);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  // require the built app so we're ready when the first request comes in
  require(BUILD_DIR);
  console.log(`✅ app ready: http://localhost:${port}`);
});

// const metricsPort = process.env.METRICS_PORT || 3001;

// metricsApp.listen(metricsPort, () => {
//   console.log(`✅ metrics ready: http://localhost:${metricsPort}/metrics`);
// });

function purgeRequireCache() {
  // purge require cache on requests for "server side HMR" this won't let
  // you have in-memory objects between requests in development,
  // alternatively you can set up nodemon/pm2-dev to restart the server on
  // file changes, we prefer the DX of this though, so we've included it
  // for you by default
  for (const key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete require.cache[key];
    }
  }
}
