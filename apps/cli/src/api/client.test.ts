import { describe, expect, test, vi } from "vitest";
import type { PeatedApiError } from "./client";
import { requestPeatedApi } from "./client";

describe("requestPeatedApi", () => {
  test("sends authenticated JSON to a v1 API path", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ id: 123, name: "Example" }),
    );

    await expect(
      requestPeatedApi({
        accessToken: "secret-token",
        apiServer: "https://api.peated.com",
        method: "patch",
        path: "/bottles/123",
        body: { name: "Example" },
        fetch,
      }),
    ).resolves.toEqual({ id: 123, name: "Example" });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBeInstanceOf(URL);
    if (!(url instanceof URL)) throw new Error("Expected a URL request");
    expect(url.href).toBe("https://api.peated.com/v1/bottles/123");
    expect(init).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ name: "Example" }),
    });
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer secret-token");
    expect(headers.get("content-type")).toBe("application/json");
  });

  test("keeps API error responses available without putting them in the message", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ error: "invalid update" }, { status: 400 }),
    );

    const request = requestPeatedApi({
      accessToken: "secret-token",
      apiServer: "https://api.peated.com",
      method: "PATCH",
      path: "/bottles/123",
      fetch,
    });

    await expect(request).rejects.toMatchObject({
      status: 400,
      body: { error: "invalid update" },
      message: "Peated API PATCH /bottles/123 failed with HTTP 400.",
    } satisfies Partial<PeatedApiError>);
  });

  test("rejects paths that could send credentials to another origin", async () => {
    for (const path of ["//evil.example/bottles", "/../oauth/token"]) {
      await expect(
        requestPeatedApi({
          accessToken: "secret-token",
          apiServer: "https://api.peated.com",
          method: "GET",
          path,
        }),
      ).rejects.toThrow("Invalid Peated API path");
    }
  });
});
