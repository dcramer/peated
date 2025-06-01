"use client";

import { ORPCError, isDefinedError } from "@orpc/client";
import Button from "@peated/web/components/button";
import config from "@peated/web/config";
import type { ComponentProps, ReactNode } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

const DEFAULT_TITLE = "Error";
const DEFAULT_SUBTITLE = "Sorry, an unexpected error has occurred.";

export function ErrorPage404({
  title = "Not Found",
  subtitle = "We couldn't find the page you were looking for.",
  ...props
}: ComponentProps<typeof ErrorPage>) {
  return <ErrorPage title={title} subtitle={subtitle} {...props} />;
}

export function ErrorPageForbidden({
  title = "Forbidden",
  subtitle = "Looks like you don't have permission to access this page.",
  ...props
}: ComponentProps<typeof ErrorPage>) {
  return <ErrorPage title={title} subtitle={subtitle} {...props} />;
}

function getTypedError<T>(
  error: T
): Error | Extract<T, ORPCError<any, any>> | undefined {
  if (error instanceof Error) return error;
  if (isDefinedError(error)) return error;
  return undefined;
}

export default function ErrorPage({
  title,
  subtitle,
  error,
  onTryAgain,
}: {
  title?: ReactNode | string;
  subtitle?: ReactNode | string;
  error?: unknown;
  onTryAgain?: () => void;
}) {
  const isOnline = useOnlineStatus();
  // XXX: there must be a better way to do this
  const typedError = getTypedError(error);

  // i hate all of this
  if (typedError && (!title || !subtitle)) {
    if (typedError.message === "Failed to fetch") {
      title = (title ?? isOnline) ? "Server Unreachable" : "Connection Offline";
      subtitle =
        (subtitle ?? isOnline)
          ? "It looks like Peated's API is unreachable right now. Please try again shortly."
          : "It looks like your network is offline.";
    } else if (
      (typedError instanceof ORPCError && typedError.status === 404) ||
      (typedError as any).message === "NOT_FOUND"
    ) {
      title = title ?? "Not Found";
      subtitle = subtitle ?? "We couldn't find the page you were looking for.";
    } else if (
      (typedError instanceof ORPCError && typedError.status === 401) ||
      (typedError as any).message === "UNAUTHORIZED"
    ) {
      title = title ?? "Identify Yourself";
      subtitle =
        subtitle ??
        "To get to where you're going we need you to tell us who you are. We don't just let anyone in here.";
    }
  }

  return (
    <main className="mx-auto flex h-screen max-w-xl items-center justify-center p-4 lg:p-8">
      <div className="h-full flex-auto">
        <main className="self-justify-center inline self-center p-3">
          <div className="text-center">
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              {title || DEFAULT_TITLE}
            </h1>
            <div className="mt-6 leading-7 text-white">
              {subtitle ? subtitle : !title && DEFAULT_SUBTITLE}
            </div>

            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button href="/" color="primary">
                Go back home
              </Button>
              <Button href={config.GITHUB_REPO}>Open a GitHub issue</Button>
              {onTryAgain && (
                <Button onClick={() => onTryAgain()}>Try again</Button>
              )}
            </div>
          </div>

          {typedError && (
            <div className="mt-12">
              {"stack" in typedError && typedError.stack && (
                <div className="prose prose-invert mx-auto mb-4">
                  <h3 className="text-white">Local Stack</h3>
                  <pre className="max-h-full overflow-y-auto whitespace-pre-wrap break-all text-left">
                    {typedError.stack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </main>
  );
}
