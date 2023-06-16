import { QueryErrorResetBoundary } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import Spinner from "./spinner";

export default ({
  children = <Spinner />,
  fallback = ErrorView,
  loading,
}: {
  children: ReactNode;
  fallback?: any;
  loading?: ReactNode;
}) => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <ErrorBoundary onReset={reset} fallbackRender={fallback}>
        <Suspense fallback={loading}>{children}</Suspense>
      </ErrorBoundary>
    )}
  </QueryErrorResetBoundary>
);

const ErrorView = ({ error, resetErrorBoundary }: any) => {
  return (
    <div>
      <div>{error ? error.message || error.toString() : "Unknown Error"}</div>
      <button title="Retry" onClick={resetErrorBoundary} />
    </div>
  );
};
