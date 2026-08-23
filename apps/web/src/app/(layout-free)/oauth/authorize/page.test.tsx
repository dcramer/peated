import { createS256CodeChallenge } from "@peated/server/lib/oauth";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createOAuthAuthorizationPage,
  type OAuthAuthorizationPageServices,
} from "./page";

const loadClientDetails =
  vi.fn<OAuthAuthorizationPageServices["loadClientDetails"]>();
const loadSessionUser =
  vi.fn<OAuthAuthorizationPageServices["loadSessionUser"]>();
const redirectToLogin =
  vi.fn<OAuthAuthorizationPageServices["redirectToLogin"]>();
const Page = createOAuthAuthorizationPage({
  loadClientDetails,
  loadSessionUser,
  redirectToLogin,
  renderForm: () => <div>Authorize actions</div>,
  renderLayout: (children) => <main>{children}</main>,
});

const verifier = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

function searchParams(overrides: Record<string, string> = {}) {
  return Promise.resolve({
    response_type: "code",
    client_id: "peated-cli",
    redirect_uri: "http://127.0.0.1:45678/callback",
    state: "opaque-state",
    code_challenge: createS256CodeChallenge(verifier),
    code_challenge_method: "S256",
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  loadClientDetails.mockResolvedValue({
    clientId: "peated-cli",
    name: "Peated CLI",
  });
});

describe("OAuth authorization page", () => {
  test("preserves a valid request through login", async () => {
    loadSessionUser.mockResolvedValue(null);
    redirectToLogin.mockReturnValue(<div>Login redirect</div>);

    await Page({ searchParams: searchParams() });

    expect(redirectToLogin).toHaveBeenCalledWith({
      pathname: "/oauth/authorize",
      searchParams: expect.any(URLSearchParams),
    });
    const forwarded = redirectToLogin.mock.calls[0][0].searchParams;
    expect(forwarded.get("state")).toBe("opaque-state");
    expect(forwarded.get("redirect_uri")).toBe(
      "http://127.0.0.1:45678/callback",
    );
  });

  test("renders locally when client or redirect validation fails", async () => {
    loadClientDetails.mockRejectedValue(new Error("Bad request"));

    const html = renderToStaticMarkup(
      await Page({
        searchParams: searchParams({
          redirect_uri: "https://evil.example/callback",
        }),
      }),
    );

    expect(html).toContain("Invalid authorization request");
    expect(redirectToLogin).not.toHaveBeenCalled();
    expect(html).not.toContain("evil.example");
  });

  test("shows the validated client and signed-in user", async () => {
    loadSessionUser.mockResolvedValue({ username: "fizz.buzz" });

    const html = renderToStaticMarkup(
      await Page({ searchParams: searchParams() }),
    );
    expect(html).toContain("Authorize Peated CLI?");
    expect(html).toContain("@fizz.buzz");
    expect(html).toContain("Authorize actions");
  });
});
