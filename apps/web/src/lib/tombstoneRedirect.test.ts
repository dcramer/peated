import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCanonicalPublicRouteRedirectPath,
  type LoadRequestHeaders,
} from "./tombstoneRedirect";

const loadHeaders = vi.fn<LoadRequestHeaders>();

describe("tombstone redirects", () => {
  beforeEach(() => {
    loadHeaders.mockReset();
    loadHeaders.mockResolvedValue(new Headers());
  });

  it("preserves a Bottle suffix and query parameters", async () => {
    loadHeaders.mockResolvedValue(
      new Headers({
        "x-peated-request-path":
          "/bottles/12/tastings?source=legacy&tag=one&tag=two",
      }),
    );

    await expect(
      getCanonicalPublicRouteRedirectPath(
        {
          canonicalId: 34,
          canonicalPath: "/bottles/34-lagavulin-16-year-old",
          currentId: 12,
          currentPathPrefixes: ["/bottles/12"],
        },
        loadHeaders,
      ),
    ).resolves.toBe(
      "/bottles/34-lagavulin-16-year-old/tastings?source=legacy&tag=one&tag=two",
    );
  });

  it("replaces a stale Bottle slug while preserving its nested route", async () => {
    loadHeaders.mockResolvedValue(
      new Headers({
        "x-peated-request-path": "/bottles/12-old-name/prices?currency=USD",
      }),
    );

    await expect(
      getCanonicalPublicRouteRedirectPath(
        {
          canonicalId: 12,
          canonicalPath: "/bottles/12-current-name",
          currentId: 12,
          currentPathPrefixes: ["/bottles/12"],
        },
        loadHeaders,
      ),
    ).resolves.toBe("/bottles/12-current-name/prices?currency=USD");
  });

  it("rejects a malformed proxy-owned request path", async () => {
    loadHeaders.mockResolvedValue(
      new Headers({
        "x-peated-request-path": "https://untrusted.invalid/bottles/12",
      }),
    );

    await expect(
      getCanonicalPublicRouteRedirectPath(
        {
          canonicalId: 34,
          canonicalPath: "/bottles/34-lagavulin-16-year-old",
          currentId: 12,
          currentPathPrefixes: ["/bottles/12"],
        },
        loadHeaders,
      ),
    ).rejects.toThrow("Invalid proxy-owned request path");
  });

  it("returns a stable root path without request headers", async () => {
    await expect(
      getCanonicalPublicRouteRedirectPath(
        {
          canonicalId: 34,
          canonicalPath: "/bottles/34-lagavulin-16-year-old",
          currentId: 12,
          currentPathPrefixes: ["/bottles/12"],
        },
        loadHeaders,
      ),
    ).resolves.toBe("/bottles/34-lagavulin-16-year-old");
  });
});
