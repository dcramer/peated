"use client";

import ErrorPage from "../components/errorPage";

export default function ErrorHandler({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPage error={error} onTryAgain={reset} />;
}
