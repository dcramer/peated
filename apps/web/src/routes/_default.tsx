import { Outlet, createFileRoute } from "@tanstack/react-router";
import DefaultLayout from "../layouts/defaultLayout";

export const Route = createFileRoute("/_default")({
  component: Layout,
});

function Layout() {
  return (
    <DefaultLayout>
      <Outlet />
    </DefaultLayout>
  );
}
