import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

import {
  getCanonicalRouteRedirectPath,
  getReleaseFamilyRouteRedirectPath,
} from "./tombstoneRedirect";

describe("tombstone redirects", () => {
  beforeEach(() => {
    mocks.headers.mockReset();
    mocks.headers.mockResolvedValue(new Headers());
  });

  it("preserves a compatible Bottle suffix and query parameters", async () => {
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-peated-request-path":
          "/bottles/12/tastings?source=legacy&tag=one&tag=two",
      }),
    );

    await expect(
      getCanonicalRouteRedirectPath({
        canonicalId: 34,
        collectionPath: "/bottles",
        currentId: 12,
      }),
    ).resolves.toBe("/bottles/34/tastings?source=legacy&tag=one&tag=two");
  });

  it("rejects a malformed proxy-owned request path", async () => {
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-peated-request-path": "https://untrusted.invalid/bottles/12",
      }),
    );

    await expect(
      getCanonicalRouteRedirectPath({
        canonicalId: 34,
        collectionPath: "/bottles",
        currentId: 12,
      }),
    ).rejects.toThrow("Invalid proxy-owned request path");
  });

  it("drops Bottle suffixes while preserving query for a release family", async () => {
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-peated-request-path":
          "/bottles/12/tastings?source=legacy&tag=one&tag=two",
      }),
    );

    await expect(getReleaseFamilyRouteRedirectPath(56)).resolves.toBe(
      "/bottles/56/releases?source=legacy&tag=one&tag=two",
    );
  });

  it("returns a stable root path without request headers", async () => {
    await expect(
      getCanonicalRouteRedirectPath({
        canonicalId: 34,
        collectionPath: "/bottles",
        currentId: 12,
      }),
    ).resolves.toBe("/bottles/34/");
    await expect(getReleaseFamilyRouteRedirectPath(56)).resolves.toBe(
      "/bottles/56/releases",
    );
  });
});
