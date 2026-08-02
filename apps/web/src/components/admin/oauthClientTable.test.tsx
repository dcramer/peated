import type { OAuthClient } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import OAuthClientTable from "./oauthClientTable";

const timestamp = "2026-08-02T12:00:00.000Z";

describe("OAuthClientTable", () => {
  test("lists public client ids, redirect counts, and activation state", () => {
    const clients: OAuthClient[] = [
      {
        id: 1,
        clientId: "peated-cli-id",
        name: "Peated CLI",
        redirectUris: ["http://127.0.0.1/callback"],
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 2,
        clientId: "cleanup-tool-id",
        name: "Cleanup Tool",
        redirectUris: ["http://127.0.0.1/callback", "http://[::1]/callback"],
        active: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];

    const html = renderToStaticMarkup(<OAuthClientTable clients={clients} />);
    expect(html).toContain('href="/admin/oauth-clients/peated-cli-id"');
    expect(html).toContain("peated-cli-id");
    expect(html).toContain("Active");
    expect(html).toContain("Inactive");
    expect(html).toContain(">2<");
  });
});
