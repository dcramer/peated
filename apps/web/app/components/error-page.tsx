import { isRouteErrorResponse, useRouteError } from "@remix-run/react";

import Button from "~/components/button";
import config from "~/config";
import { useOnlineStatus } from "~/hooks/useOnlineStatus";
import { ApiError, ApiUnauthorized, ApiUnavailable } from "~/lib/api";

export default function ErrorPage() {
  const error = useRouteError();
  const isOnline = useOnlineStatus();

  let title = "Error";
  let subtitle = "Sorry, an unexpected error has occurred.";
  if (error instanceof ApiUnavailable) {
    title = isOnline ? "Server Unreachable" : "Connection Offline";
    subtitle = isOnline
      ? "It looks like Peated's API is unreachable right now. Please try again shortly."
      : "It looks like your network is offline.";
  } else if (error instanceof ApiUnauthorized) {
    title = "Identify Yourself";
    subtitle =
      "To get to where you're going we need you to tell us who you are. We don't just let anyone in here.";
  } else if (error instanceof ApiError && error.statusCode === 404) {
    title = "Not Found";
    subtitle = "We couldn't find the page you were looking for.";
  } else if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Not Found";
      subtitle = "We couldn't find the page you were looking for.";
    } else if (error.status === 401) {
      title = "Identify Yourself";
      subtitle =
        "To get to where you're going we need you to tell us who you are. We don't just let anyone in here.";
    }
  }

  return (
    <main className="mx-auto flex h-screen max-w-xl items-center justify-center p-4 lg:p-8">
      <div className="h-full flex-auto">
        <main className="self-justify-center inline self-center p-3">
          <div className="text-center">
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              {title}
            </h1>
            <div className="mt-6 leading-7 text-white">{subtitle}</div>

            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button to="/" color="primary">
                Go back home
              </Button>
              <Button to={config.GITHUB_REPO}>Open a GitHub issue</Button>
            </div>
          </div>

          <div className="mt-12">
            {error.remoteStack && (
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
        </main>
      </div>
    </main>
  );
}
