import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import OAuthClientForm, {
  OAuthClientFormSchema,
  parseOAuthClientRedirectUris,
} from "./oauthClientForm";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/oauth-clients/add",
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock("./sidebar", () => ({ default: () => <aside>Admin</aside> }));

describe("OAuthClientForm", () => {
  test("parses and validates one registered redirect per line", () => {
    const redirectUris = parseOAuthClientRedirectUris(
      "http://127.0.0.1/callback\n\nhttps://tools.peated.com/callback",
    );

    expect(redirectUris).toEqual([
      "http://127.0.0.1/callback",
      "https://tools.peated.com/callback",
    ]);
    expect(
      OAuthClientFormSchema.safeParse({
        name: "Peated CLI",
        redirectUris: redirectUris.join("\n"),
      }).success,
    ).toBe(true);
    expect(
      OAuthClientFormSchema.safeParse({
        name: "Peated CLI",
        redirectUris: "http://localhost/callback",
      }).success,
    ).toBe(false);
  });

  test("uses the same form for registration and editing", () => {
    const createHtml = renderToStaticMarkup(
      <OAuthClientForm onSubmit={async () => undefined} />,
    );
    expect(createHtml).toContain("Register OAuth Client");
    expect(createHtml).not.toContain("Public identifier");

    const editHtml = renderToStaticMarkup(
      <OAuthClientForm
        title="Edit OAuth Client"
        initialData={{
          clientId: "public-client-id",
          name: "Peated CLI",
          redirectUris: ["http://127.0.0.1/callback"],
        }}
        onSubmit={async () => undefined}
      />,
    );
    expect(editHtml).toContain("Edit OAuth Client");
    expect(editHtml).toContain("public-client-id");
    expect(editHtml).toContain("OAuth clients do not have a secret");
    expect(editHtml).toContain("Redirect URIs");
  });
});
