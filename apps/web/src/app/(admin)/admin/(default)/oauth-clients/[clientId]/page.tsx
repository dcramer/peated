"use client";

import { use } from "react";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminActions,
  AdminBreadcrumbs,
  AdminCode,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminStatus,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminDefinitionList as DefinitionList } from "@peated/web/components/admin/adminUtility.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

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
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "OAuth clients", href: "/admin/oauth-clients" },
          {
            label: client.name,
            href: `/admin/oauth-clients/${client.clientId}`,
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        title={client.name}
        actions={
          <AdminActions>
            <Button
              onClick={async () => {
                await update.mutateAsync({
                  clientId: client.clientId,
                  active: !client.active,
                });
                await refetch();
              }}
              loading={update.isPending}
              variant={client.active ? "danger" : "default"}
            >
              {client.active ? "Deactivate" : "Activate"}
            </Button>
            <Button href={`/admin/oauth-clients/${client.clientId}/edit`}>
              Edit client
            </Button>
          </AdminActions>
        }
      />
      <AdminSection title="Client details">
        <DefinitionList>
          <DefinitionList.Term>Client ID</DefinitionList.Term>
          <DefinitionList.Details>
            <AdminCode>{client.clientId}</AdminCode>
          </DefinitionList.Details>
          <DefinitionList.Term>Status</DefinitionList.Term>
          <DefinitionList.Details>
            <AdminStatus tone={client.active ? "success" : "neutral"}>
              {client.active ? "Active" : "Inactive"}
            </AdminStatus>
          </DefinitionList.Details>
          <DefinitionList.Term>Redirect URIs</DefinitionList.Term>
          <DefinitionList.Details>
            {client.redirectUris.map((uri, index) => (
              <span key={uri}>
                {index ? " · " : null}
                <AdminCode>{uri}</AdminCode>
              </span>
            ))}
          </DefinitionList.Details>
        </DefinitionList>
      </AdminSection>
    </AdminPage>
  );
}
