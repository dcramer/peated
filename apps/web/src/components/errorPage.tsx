"use client";

import { type AppRouter } from "@peated/server/trpc/router";
import Button from "@peated/web/components/button";
import config from "@peated/web/config";
import { ApiError, ApiUnauthorized, ApiUnavailable } from "@peated/web/lib/api";
import { type TRPCClientError } from "@trpc/client";
import { type ComponentProps, type ReactNode } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { isTRPCClientError } from "../lib/trpc";

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

export default function ErrorPage({
  title,
  subtitle,
  error,
  onTryAgain,
}: {
  title?: ReactNode | string;
  subtitle?: ReactNode | string;
  error?: Error | ApiError | TRPCClientError<AppRouter>;
  onTryAgain?: () => void;
}) {
  const isOnline = useOnlineStatus();

  // i hate all of this
  if (error && (!title || !subtitle)) {
    if (error instanceof ApiUnavailable) {
      title = title ?? isOnline ? "Server Unreachable" : "Connection Offline";
      subtitle =
        subtitle ?? isOnline
          ? "It looks like Peated's API is unreachable right now. Please try again shortly."
          : "It looks like your network is offline.";
    } else if (error instanceof ApiUnauthorized) {
      title = title ?? "Identify Yourself";
      subtitle =
        subtitle ??
        "To get to where you're going we need you to tell us who you are. We don't just let anyone in here.";
    } else if (
      (error instanceof ApiError && error.statusCode === 404) ||
      (isTRPCClientError(error) && error.data?.httpStatus === 404) ||
      error.message === "NOT_FOUND"
    ) {
      title = title ?? "Not Found";
      subtitle = subtitle ?? "We couldn't find the page you were looking for.";
    } else if (
      (error instanceof ApiError && error.statusCode === 401) ||
      (isTRPCClientError(error) && error.data?.httpStatus === 401) ||
      error.message === "UNAUTHORIZED"
    ) {
      title = title ?? "Identify Yourself";
      subtitle =
        subtitle ??
        "To get to where you're going we need you to tell us who you are. We don't just let anyone in here.";
    } else if (
      isTRPCClientError(error) &&
      error.message === "Failed to fetch"
    ) {
      title = title ?? isOnline ? "Server Unreachable" : "Connection Offline";
      subtitle =
        subtitle ?? isOnline
          ? "It looks like Peated's API is unreachable right now. Please try again shortly."
          : "It looks like your network is offline.";
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
              {subtitle ? !title && DEFAULT_SUBTITLE : null}
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

          {error && (
            <div className="mt-12">
              {error instanceof ApiError && (
                <div className="prose mx-auto mb-4">
                  <h3 className="text-white">Remote Stack</h3>
                  <pre className="max-h-full overflow-y-auto whitespace-pre-wrap break-all text-left">
                    {error.remoteStack}
                  </pre>
                </div>
              )}
              {error.stack && (
                <div className="prose mx-auto mb-4">
                  <h3 className="text-white">Local Stack</h3>
                  <pre className="max-h-full overflow-y-auto whitespace-pre-wrap break-all text-left">
                    {error.stack}
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
