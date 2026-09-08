import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCountryNotFoundResolver } from "./notFound.server";

const logInfo = vi.fn();
const notFound = vi.fn(() => {
  throw Object.assign(new Error("Not found"), {
    digest: "NEXT_HTTP_ERROR_FALLBACK;404",
  });
});
const resolveCountryOrNotFound = createCountryNotFoundResolver({
  logInfo,
  notFound,
});

describe("resolveCountryOrNotFound", () => {
  beforeEach(() => {
    logInfo.mockReset();
    notFound.mockClear();
  });

  it("returns successful country requests without logging", async () => {
    await expect(
      resolveCountryOrNotFound(Promise.resolve("Scotland"), "path"),
    ).resolves.toBe("Scotland");
    expect(logInfo).not.toHaveBeenCalled();
  });

  it.each([
    new ORPCError("NOT_FOUND", { defined: true }),
    new ORPCError("BAD_REQUEST", {
      defined: true,
      message: "Invalid country.",
    }),
  ])("logs expected invalid countries and returns a 404", async (error) => {
    await expect(
      resolveCountryOrNotFound(Promise.reject(error), "query"),
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect(logInfo).toHaveBeenCalledWith("Country did not match the catalog", {
      extra: { "peated.catalog.country.source": "query" },
    });
  });

  it("passes unexpected client errors to the route handler", async () => {
    const error = new ORPCError("BAD_REQUEST", {
      defined: true,
      message: "Invalid region.",
    });

    await expect(
      resolveCountryOrNotFound(Promise.reject(error), "path"),
    ).rejects.toBe(error);
    expect(logInfo).not.toHaveBeenCalled();
  });
});
