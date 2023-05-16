import { ErrorBoundary } from "@sentry/react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import Spinner from "./spinner";

export default ({ children }: { children: React.ReactNode }) => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <ErrorBoundary onReset={reset} fallback={ErrorView}>
        <Suspense fallback={<Spinner />}>{children}</Suspense>
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
