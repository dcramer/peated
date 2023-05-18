import { ErrorBoundary, FallbackRender } from "@sentry/react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ReactNode, Suspense } from "react";
import Spinner from "./spinner";

export default ({
  children,
  fallback,
  loading,
}: {
  children: React.ReactNode;
  fallback?: FallbackRender;
  loading?: ReactNode;
}) => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <ErrorBoundary onReset={reset} fallback={fallback || ErrorView}>
        <Suspense fallback={loading || <Spinner />}>{children}</Suspense>
      </ErrorBoundary>
    )}
  </QueryErrorResetBoundary>
);

const ErrorView = ({ error, resetErrorBoundary }: any) => {
  return (
    <div>
      <div>{error.message}</div>
      <button title="Retry" onClick={resetErrorBoundary} />
    </div>
  );
};
