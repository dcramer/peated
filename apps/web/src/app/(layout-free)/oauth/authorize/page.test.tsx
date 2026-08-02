import { createS256CodeChallenge } from "@peated/server/lib/oauth";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizationDetails: vi.fn(),
  getSession: vi.fn(),
  redirectToAuth: vi.fn(),
}));

vi.mock("@peated/web/lib/orpc/client.server", () => ({
  createAnonymousServerClient: async () => ({
    client: {
      oauth: { authorizationDetails: mocks.authorizationDetails },
    },
  }),
}));
vi.mock("@peated/web/lib/session.server", () => ({
  getSession: mocks.getSession,
}));
vi.mock("@peated/web/lib/auth", () => ({
  redirectToAuth: mocks.redirectToAuth,
}));
vi.mock("./authorizationForm", () => ({
  default: () => <div>Authorize actions</div>,
}));
vi.mock("@peated/web/components/layoutSplash", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

import Page from "./page";

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
  mocks.authorizationDetails.mockResolvedValue({
    clientId: "peated-cli",
    name: "Peated CLI",
  });
});

describe("OAuth authorization page", () => {
  test("preserves a valid request through login", async () => {
    mocks.getSession.mockResolvedValue({ user: null });
    mocks.redirectToAuth.mockReturnValue(<div>Login redirect</div>);

    await Page({ searchParams: searchParams() });

    expect(mocks.redirectToAuth).toHaveBeenCalledWith({
      pathname: "/oauth/authorize",
      searchParams: expect.any(URLSearchParams),
    });
    const forwarded = mocks.redirectToAuth.mock.calls[0][0]
      .searchParams as URLSearchParams;
    expect(forwarded.get("state")).toBe("opaque-state");
    expect(forwarded.get("redirect_uri")).toBe(
      "http://127.0.0.1:45678/callback",
    );
  });

  test("renders locally when client or redirect validation fails", async () => {
    mocks.authorizationDetails.mockRejectedValue(new Error("Bad request"));

    const html = renderToStaticMarkup(
      await Page({
        searchParams: searchParams({
          redirect_uri: "https://evil.example/callback",
        }),
      }),
    );

    expect(html).toContain("Invalid authorization request");
    expect(mocks.redirectToAuth).not.toHaveBeenCalled();
    expect(html).not.toContain("evil.example");
  });

  test("shows the validated client and signed-in user", async () => {
    mocks.getSession.mockResolvedValue({
      user: { username: "fizz.buzz" },
    });

    const html = renderToStaticMarkup(
      await Page({ searchParams: searchParams() }),
    );
    expect(html).toContain("Authorize Peated CLI?");
    expect(html).toContain("@fizz.buzz");
    expect(html).toContain("Authorize actions");
  });
});
