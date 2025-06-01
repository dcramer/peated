import { createFileRoute } from "@tanstack/react-router";
("use client");

import * as Sentry from "@sentry/react";
import { useEffect } from "react";

export const Route = createFileRoute("/global-error")({
  component: GlobalError,
  errorComponent: GlobalError,
});

function GlobalError({ error }: { error?: Error & { digest?: string } }) {
  useEffect(() => {
    if (error) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
            <p className="text-gray-600">
              An unexpected error occurred. Please try refreshing the page.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
