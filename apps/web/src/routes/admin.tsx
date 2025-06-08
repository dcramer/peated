import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "../layouts";

export const Route = createFileRoute("/admin")({
  component: AdminLayoutPage,
});

function AdminLayoutPage() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
