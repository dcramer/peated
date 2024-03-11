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
import {
  type AppLoadContext,
  type ServerBuild,
} from "@remix-run/server-runtime";
import * as Sentry from "@sentry/remix";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { ip as ipAddress } from "address";
import chalk from "chalk";
import closeWithGrace from "close-with-grace";
import compression from "compression";
import type { Request } from "express";
import express from "express";
import getPort, { portNumbers } from "get-port";
import morgan from "morgan";

installGlobals();

const MODE = process.env.NODE_ENV ?? "development";

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

function getLoadContext(req: Request, res: any): AppLoadContext {
  const trpc = createTRPCProxyClient<AppRouter>({
    links: [
      sentryLink(Sentry.captureException),
      httpBatchLink({
        url: `${config.API_SERVER}/trpc`,
        async headers() {
          return {
            authorization: res.locals.accessToken
              ? `Bearer ${res.locals.accessToken}`
              : "",
          };
        },
      }),
    ],
  });

  return {
    api: res.locals.api,
    user: res.locals.user,
    accessToken: res.locals.accessToken,
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
  Sentry.wrapExpressCreateRequestHandler(createRequestHandler);

async function getBuild() {
  const build = viteDevServer
    ? await viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : // @ts-ignore this should exist before running the server
      // but it may not exist just yet.
      await import("#build/server/index.js");
  // not sure how to make this happy 🤷‍♂️
  return build as unknown as ServerBuild;
}

const remixHandler = createSentryRequestHandler({
  // @sentry/remix needs to be updated to handle the function signature
  build: await getBuild(),
  getLoadContext,
});

const app = express();

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

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

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

  res.locals.user = user || null;
  res.locals.accessToken = accessToken || null;
  res.locals.api = new ApiClient({
    server: config.API_SERVER,
    accessToken,
  });

  if (accessToken && !user) {
    return logout(req);
  }

  next();
});

app.all("*", remixHandler);

const desiredPort = Number(process.env.PORT || 3000);
const portToUse = await getPort({
  port: portNumbers(desiredPort, desiredPort + 100),
});

const server = app.listen(portToUse, () => {
  const addy = server.address();
  const portUsed =
    desiredPort === portToUse
      ? desiredPort
      : addy && typeof addy === "object"
        ? addy.port
        : 0;

  if (portUsed !== desiredPort) {
    console.warn(
      chalk.yellow(
        `⚠️  Port ${desiredPort} is not available, using ${portUsed} instead.`,
      ),
    );
  }
  console.log(`🚀  We have liftoff!`);
  const localUrl = `http://localhost:${portUsed}`;
  let lanUrl: string | null = null;
  const localIp = ipAddress() ?? "Unknown";
  // Check if the address is a private ip
  // https://en.wikipedia.org/wiki/Private_network#Private_IPv4_address_spaces
  // https://github.com/facebook/create-react-app/blob/d960b9e38c062584ff6cfb1a70e1512509a966e7/packages/react-dev-utils/WebpackDevServerUtils.js#LL48C9-L54C10
  if (/^10[.]|^172[.](1[6-9]|2[0-9]|3[0-1])[.]|^192[.]168[.]/.test(localIp)) {
    lanUrl = `http://${localIp}:${portUsed}`;
  }

  console.log(
    `
${chalk.bold("Local:")}            ${chalk.cyan(localUrl)}
${lanUrl ? `${chalk.bold("On Your Network:")}  ${chalk.cyan(lanUrl)}` : ""}
${chalk.bold("Press Ctrl+C to stop")}
		`.trim(),
  );
});

closeWithGrace(async () => {
  await new Promise((resolve, reject) => {
    server.close((e) => (e ? reject(e) : resolve("ok")));
  });
});
