"use client";

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
    <div>
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
      <div className="flex items-center justify-end">
        <Button color="primary" href="/admin/oauth-clients/add">
          Register Client
        </Button>
      </div>
      {data.results.length ? (
        <OAuthClientTable clients={data.results} />
      ) : (
        <EmptyActivity>No OAuth clients are registered yet.</EmptyActivity>
      )}
    </div>
  );
}
