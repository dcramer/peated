import { SCRAPE_RULES_VERSION } from "@peated/server/schemas";
import { describe, expect, it } from "vitest";
import {
  getSetupAfterLatestVersion,
  needsScrapeRulesUpdate,
} from "./scraperParsingStatus";

const failedSetup = {
  runId: 1,
  status: "failed" as const,
  error: "AI could not finish setup.",
  createdAt: "2026-08-29T23:19:00.000Z",
  completedAt: "2026-08-29T23:20:00.000Z",
};

describe("getSetupAfterLatestVersion", () => {
  it("ignores a failed setup when a newer version exists", () => {
    expect(
      getSetupAfterLatestVersion({
        setup: failedSetup,
        revisions: [{ createdAt: "2026-08-30T00:12:00.000Z" }],
      }),
    ).toBeNull();
  });

  it("keeps a failed setup that tried to repair the latest version", () => {
    expect(
      getSetupAfterLatestVersion({
        setup: failedSetup,
        revisions: [{ createdAt: "2026-08-29T23:00:00.000Z" }],
      }),
    ).toEqual(failedSetup);
  });

  it("keeps the setup when no version exists", () => {
    expect(
      getSetupAfterLatestVersion({ setup: failedSetup, revisions: [] }),
    ).toEqual(failedSetup);
  });
});

describe("needsScrapeRulesUpdate", () => {
  it("finds a latest version that predates the current rule format", () => {
    expect(
      needsScrapeRulesUpdate({
        revisions: [{ rulesVersion: SCRAPE_RULES_VERSION - 1 }],
      }),
    ).toBe(true);
  });

  it("accepts the current rule format and an empty history", () => {
    expect(
      needsScrapeRulesUpdate({
        revisions: [{ rulesVersion: SCRAPE_RULES_VERSION }],
      }),
    ).toBe(false);
    expect(needsScrapeRulesUpdate({ revisions: [] })).toBe(false);
  });
});
