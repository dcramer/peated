import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCanonicalPublicRouteRedirectPath,
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

  it("keeps a canonical primary-kind Entity route", async () => {
    loadHeaders.mockResolvedValue(
      new Headers({
        "x-peated-request-path": "/distillers/12/tastings?sort=-created",
      }),
    );

    await expect(
      getCanonicalPublicRouteRedirectPath(
        {
          canonicalId: 12,
          canonicalPath: "/distillers/12",
          currentId: 12,
          currentPathPrefixes: ["/distillers/12", "/entities/12"],
        },
        loadHeaders,
      ),
    ).resolves.toBeNull();
  });

  it("moves a wrong-kind Entity route to the primary kind", async () => {
    loadHeaders.mockResolvedValue(
      new Headers({
        "x-peated-request-path": "/brands/12/bottles?sort=-tastings",
      }),
    );

    await expect(
      getCanonicalPublicRouteRedirectPath(
        {
          canonicalId: 12,
          canonicalPath: "/distillers/12",
          currentId: 12,
          currentPathPrefixes: ["/brands/12", "/entities/12"],
        },
        loadHeaders,
      ),
    ).resolves.toBe("/distillers/12/bottles?sort=-tastings");
  });

  it("moves wrong-kind tombstone routes with their suffix", async () => {
    loadHeaders.mockResolvedValue(
      new Headers({
        "x-peated-request-path": "/brands/12/tastings?sort=-created",
      }),
    );

    await expect(
      getCanonicalPublicRouteRedirectPath(
        {
          canonicalId: 34,
          canonicalPath: "/distillers/34",
          currentId: 12,
          currentPathPrefixes: ["/brands/12", "/entities/12"],
        },
        loadHeaders,
      ),
    ).resolves.toBe("/distillers/34/tastings?sort=-created");
  });

  it("moves an Entity ID route to its primary kind", async () => {
    loadHeaders.mockResolvedValue(
      new Headers({ "x-peated-request-path": "/E0012" }),
    );

    await expect(
      getCanonicalPublicRouteRedirectPath(
        {
          canonicalId: 12,
          canonicalPath: "/companies/12",
          currentId: 12,
          currentPathPrefixes: ["/companies/12", "/entities/12"],
        },
        loadHeaders,
      ),
    ).resolves.toBe("/companies/12/");
  });
});
