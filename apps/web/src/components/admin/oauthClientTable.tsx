import type { OAuthClient } from "@peated/server/types";
import { AdminCode, AdminStatus } from "./adminContent.stylex";
import { AdminTable } from "./adminTable.stylex";

export default function OAuthClientTable({
  clients,
}: {
  clients: OAuthClient[];
}) {
  return (
    <AdminTable
      columns={[
        {
          name: "client",
          value: (client) => (
            <span>
              {client.name} · <AdminCode>{client.clientId}</AdminCode>
            </span>
          ),
        },
        {
          name: "redirects",
          value: (client) => client.redirectUris.length.toLocaleString("en-US"),
        },
        {
          align: "right",
          name: "status",
          value: (client) => (
            <AdminStatus tone={client.active ? "success" : "neutral"}>
              {client.active ? "Active" : "Inactive"}
            </AdminStatus>
          ),
        },
      ]}
      items={clients}
      primaryKey={(client) => client.clientId}
      url={(client) => `/admin/oauth-clients/${client.clientId}`}
    />
  );
}
