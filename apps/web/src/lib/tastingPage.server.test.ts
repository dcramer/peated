import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTastingPageLoader } from "./tastingPage.server";

const details = vi.fn();
const requestHeaders = vi.fn();
const getTastingPage = createTastingPageLoader(details, requestHeaders);

const tasting = {
  id: 123,
  bottle: { name: "16-year-old", brand: { name: "Lagavulin" } },
};
const canonical = "/tastings/123-lagavulin-16-year-old";

describe("tasting page routes", () => {
  beforeEach(() => {
    details.mockReset().mockResolvedValue(tasting);
    requestHeaders.mockReset().mockResolvedValue(
      new Headers({
        "x-peated-request-path": canonical,
      }),
    );
  });

  it("loads canonical slugs by their numeric ID", async () => {
    await expect(getTastingPage("123-lagavulin-16-year-old")).resolves.toBe(
      tasting,
    );
    expect(details).toHaveBeenCalledWith(123);
  });

  it.each(["123", "123-old-name"])(
    "permanently redirects %s while preserving edit routes and query parameters",
    async (id) => {
      requestHeaders.mockResolvedValue(
        new Headers({
          "x-peated-request-path": `/tastings/${id}/edit?source=legacy&tag=one&tag=two`,
        }),
      );
      await expect(getTastingPage(id)).rejects.toMatchObject({
        digest: `NEXT_REDIRECT;replace;${canonical}/edit?source=legacy&tag=one&tag=two;308;`,
      });
    },
  );

  it.each(["0", "1.5", "1e2", "123-", "not-an-id", "9007199254740992-name"])(
    "rejects malformed ID %s before loading",
    async (id) => {
      await expect(getTastingPage(id)).rejects.toMatchObject({
        digest: "NEXT_HTTP_ERROR_FALLBACK;404",
      });
      expect(details).not.toHaveBeenCalled();
    },
  );

  it("does not disclose slugs for missing or inaccessible tastings", async () => {
    details.mockRejectedValue(new ORPCError("NOT_FOUND", { defined: true }));
    await expect(getTastingPage("123-old-name")).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    expect(requestHeaders).not.toHaveBeenCalled();
  });

  it("passes unexpected API failures to the route handler", async () => {
    const error = new Error("API unavailable");
    details.mockRejectedValue(error);
    await expect(getTastingPage("123-old-name")).rejects.toBe(error);
  });
});
