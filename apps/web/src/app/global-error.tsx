"use client";

import { ErrorDocument } from "../components/designSystem/product/pageStatePages.stylex";
import RouteErrorPage from "../components/routeErrorPage";
import "../styles/error-document.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorDocument title="Page failure | Peated">
      <RouteErrorPage error={error} reset={reset} />
    </ErrorDocument>
  );
}
