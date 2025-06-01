import { createFileRoute } from "@tanstack/react-router";
import { ErrorPage404 } from "../components/errorPage";

export const Route = createFileRoute("/not-found")({
  component: NotFound,
});

function NotFound() {
  return <ErrorPage404 />;
}
