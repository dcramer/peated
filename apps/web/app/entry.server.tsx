import { PassThrough } from "stream";

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import isbot from "isbot";
import { renderToPipeableStream } from "react-dom/server";

import * as Sentry from "@sentry/remix";
import { createSitemapGenerator } from "remix-sitemap";

const ABORT_DELAY = 5_000;

// XXX: This is in server.ts
// Sentry.init({
//   dsn: config.SENTRY_DSN,
//   release: config.VERSION,
//   debug: config.DEBUG,
//   tracesSampleRate: 1.0,
//   // tracePropagationTargets: ["localhost", "api.peated.app", "peated.app"],
// });

// TODO: cache this via Redis
// https://github.com/fedeya/remix-sitemap#caching
const { isSitemapUrl, sitemap } = createSitemapGenerator({
  siteUrl: "https://peated.com",
  headers: {
    "Cache-Control": "public, max-age=3600",
  },
  // generateRobotsTxt: true,
});

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  if (isSitemapUrl(request)) return await sitemap(request, remixContext as any);

  const callbackName = isbot(request.headers.get("user-agent"))
    ? "onAllReady"
    : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
        abortDelay={ABORT_DELAY}
      />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          console.error(error);
          responseStatusCode = 500;
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

export function handleError(
  error: unknown,
  { request }: LoaderFunctionArgs | ActionFunctionArgs,
): void {
  if (error instanceof Error) {
    Sentry.captureRemixServerException(error, "remix.server", request);
  } else {
    Sentry.captureException(error);
  }
}
