import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ReactNode, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import Spinner from "./spinner";

export default ({
  children = <Spinner />,
  fallback = <ErrorView />,
  loading,
}: {
  children: ReactNode;
  fallback?: any;
  loading?: ReactNode;
}) => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <ErrorBoundary onReset={reset} fallback={fallback}>
        <Suspense fallback={loading}>{children}</Suspense>
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
