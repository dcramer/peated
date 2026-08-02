import type { OAuthClient } from "@peated/server/types";
import Link from "@peated/web/components/link";

export default function OAuthClientTable({
  clients,
}: {
  clients: OAuthClient[];
}) {
  return (
    <table className="min-w-full">
      <thead className="text-muted hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
        <tr>
          <th scope="col" className="px-3 py-2.5 text-left">
            Client
          </th>
          <th scope="col" className="px-3 py-2.5 text-left">
            Redirects
          </th>
          <th scope="col" className="px-3 py-2.5 text-right">
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {clients.map((client) => (
          <tr
            key={client.clientId}
            className="border-b border-slate-800 text-sm"
          >
            <td className="max-w-0 px-3 py-3 align-top">
              <Link
                href={`/admin/oauth-clients/${client.clientId}`}
                className="font-medium hover:underline"
              >
                {client.name}
              </Link>
              <div className="text-muted mt-1 break-all font-mono text-xs">
                {client.clientId}
              </div>
            </td>
            <td className="px-3 py-3 align-top">
              <span className="sm:hidden">Redirects: </span>
              {client.redirectUris.length}
            </td>
            <td className="px-3 py-3 text-right align-top">
              {client.active ? "Active" : "Inactive"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
