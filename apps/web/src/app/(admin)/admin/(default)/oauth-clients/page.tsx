"use client";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import OAuthClientTable from "@peated/web/components/admin/oauthClientTable";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.admin.oauthClients.list.queryOptions({ input: {} }),
  );

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          {
            label: "OAuth Clients",
            href: "/admin/oauth-clients",
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        actions={
          <Button variant="default" href="/admin/oauth-clients/add">
            Register Client
          </Button>
        }
        title="OAuth clients"
      />
      {data.results.length ? (
        <OAuthClientTable clients={data.results} />
      ) : (
        <EmptyActivity>No OAuth clients are registered yet.</EmptyActivity>
      )}
    </AdminPage>
  );
}
