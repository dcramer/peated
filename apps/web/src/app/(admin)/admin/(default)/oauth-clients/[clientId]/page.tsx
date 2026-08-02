"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import DefinitionList from "@peated/web/components/definitionList";
import PageHeader from "@peated/web/components/pageHeader";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";

export default function Page({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const orpc = useORPC();
  const { data: client, refetch } = useSuspenseQuery(
    orpc.admin.oauthClients.details.queryOptions({ input: { clientId } }),
  );
  const update = useMutation(orpc.admin.oauthClients.update.mutationOptions());

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          { name: "Admin", href: "/admin" },
          { name: "OAuth Clients", href: "/admin/oauth-clients" },
          {
            name: client.name,
            href: `/admin/oauth-clients/${client.clientId}`,
            current: true,
          },
        ]}
      />
      <PageHeader
        title={client.name}
        metadata={
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                await update.mutateAsync({
                  clientId: client.clientId,
                  active: !client.active,
                });
                await refetch();
              }}
              loading={update.isPending}
              color={client.active ? "danger" : "primary"}
            >
              {client.active ? "Deactivate" : "Activate"}
            </Button>
            <Button href={`/admin/oauth-clients/${client.clientId}/edit`}>
              Edit Client
            </Button>
          </div>
        }
      />
      <DefinitionList>
        <DefinitionList.Term>Client ID</DefinitionList.Term>
        <DefinitionList.Details>
          <code className="break-all">{client.clientId}</code>
        </DefinitionList.Details>
        <DefinitionList.Term>Status</DefinitionList.Term>
        <DefinitionList.Details>
          {client.active ? "Active" : "Inactive"}
        </DefinitionList.Details>
        <DefinitionList.Term>Redirect URIs</DefinitionList.Term>
        <DefinitionList.Details>
          <ul className="space-y-1">
            {client.redirectUris.map((uri) => (
              <li key={uri}>
                <code className="break-all">{uri}</code>
              </li>
            ))}
          </ul>
        </DefinitionList.Details>
      </DefinitionList>
    </div>
  );
}
