"use client";

import {
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import OAuthClientTable from "@peated/web/components/admin/oauthClientTable";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.admin.oauthClients.list.queryOptions({ input: {} }),
  );

  return (
    <AdminPage>
      <Breadcrumbs
        pages={[
          { name: "Admin", href: "/admin" },
          {
            name: "OAuth Clients",
            href: "/admin/oauth-clients",
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        actions={
          <Button color="primary" href="/admin/oauth-clients/add">
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
