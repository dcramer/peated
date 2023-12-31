import { QueryErrorResetBoundary } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import EmptyActivity from "./emptyActivity";
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
        {children}
      </ErrorBoundary>
    )}
  </QueryErrorResetBoundary>
);

const ErrorView = ({ error, resetErrorBoundary }: any) => {
  // const isOnline = useOnlineStatus();

  // if (!isOnline) {
  //   return (
  //     <EmptyActivity>
  //       You'll need to connect to the internet to load this content.
  //     </EmptyActivity>
  //   );
  // }
  return (
    <EmptyActivity>
      <div>
        {error ? error.message || error.toString() : "Internal server error"}
      </div>
      <button title="Retry" onClick={resetErrorBoundary} />
    </EmptyActivity>
  );
};
