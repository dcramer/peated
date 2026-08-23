import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCanonicalRouteRedirectPath,
  getReleaseFamilyRouteRedirectPath,
  type LoadRequestHeaders,
} from "./tombstoneRedirect";

const loadHeaders = vi.fn<LoadRequestHeaders>();

describe("tombstone redirects", () => {
  beforeEach(() => {
    loadHeaders.mockReset();
    loadHeaders.mockResolvedValue(new Headers());
  });

  it("preserves a compatible Bottle suffix and query parameters", async () => {
    loadHeaders.mockResolvedValue(
      new Headers({
        "x-peated-request-path":
          "/bottles/12/tastings?source=legacy&tag=one&tag=two",
      }),
    );

    await expect(
      getCanonicalRouteRedirectPath(
        {
          canonicalId: 34,
          collectionPath: "/bottles",
          currentId: 12,
        },
        loadHeaders,
      ),
    ).resolves.toBe("/bottles/34/tastings?source=legacy&tag=one&tag=two");
  });

  it("rejects a malformed proxy-owned request path", async () => {
    loadHeaders.mockResolvedValue(
      new Headers({
        "x-peated-request-path": "https://untrusted.invalid/bottles/12",
      }),
    );

    await expect(
      getCanonicalRouteRedirectPath(
        {
          canonicalId: 34,
          collectionPath: "/bottles",
          currentId: 12,
        },
        loadHeaders,
      ),
    ).rejects.toThrow("Invalid proxy-owned request path");
  });

  it("drops Bottle suffixes while preserving query for a release family", async () => {
    loadHeaders.mockResolvedValue(
      new Headers({
        "x-peated-request-path":
          "/bottles/12/tastings?source=legacy&tag=one&tag=two",
      }),
    );

    await expect(
      getReleaseFamilyRouteRedirectPath(56, loadHeaders),
    ).resolves.toBe("/bottles/56/releases?source=legacy&tag=one&tag=two");
  });

  it("returns a stable root path without request headers", async () => {
    await expect(
      getCanonicalRouteRedirectPath(
        {
          canonicalId: 34,
          collectionPath: "/bottles",
          currentId: 12,
        },
        loadHeaders,
      ),
    ).resolves.toBe("/bottles/34/");
    await expect(
      getReleaseFamilyRouteRedirectPath(56, loadHeaders),
    ).resolves.toBe("/bottles/56/releases");
  });
});
