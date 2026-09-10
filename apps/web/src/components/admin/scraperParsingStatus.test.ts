import { SCRAPE_RULES_VERSION } from "@peated/server/schemas";
import { describe, expect, it } from "vitest";
import {
  canSuggestScrapeRules,
  getSetupAfterLatestVersion,
  getSetupDescription,
  getSetupSteps,
  needsScrapeRulesUpdate,
} from "./scraperParsingStatus";

const failedSetup = {
  runId: 1,
  status: "failed" as const,
  error: "AI could not finish setup.",
  createdAt: "2026-08-29T23:19:00.000Z",
  completedAt: "2026-08-29T23:20:00.000Z",
};

describe("canSuggestScrapeRules", () => {
  const revision = {
    id: 2,
    createdAt: "2026-09-01T12:00:00Z",
    rulesVersion: SCRAPE_RULES_VERSION,
    previewStatus: "passed" as const,
  };
  const source = { setup: null, activeRevisionId: 1, revisions: [revision] };

  it.each(["pending", "passed"] as const)(
    "allows rebuilding a %s inactive proposal",
    (previewStatus) => {
      expect(
        canSuggestScrapeRules({
          ...source,
          revisions: [{ ...revision, previewStatus }],
        }),
      ).toBe(true);
    },
  );

  it.each(["queued", "running"] as const)(
    "blocks rebuilding while setup is %s, even if a newer proposal exists",
    (status) => {
      expect(
        canSuggestScrapeRules({ ...source, setup: { ...failedSetup, status } }),
      ).toBe(false);
    },
  );

  it("protects healthy active current rules but allows failed or older rules", () => {
    const active = { ...source, activeRevisionId: revision.id };
    expect(canSuggestScrapeRules(active)).toBe(false);
    expect(
      canSuggestScrapeRules({
        ...active,
        revisions: [{ ...revision, previewStatus: "failed" }],
      }),
    ).toBe(true);
    expect(
      canSuggestScrapeRules({
        ...active,
        revisions: [{ ...revision, rulesVersion: SCRAPE_RULES_VERSION - 1 }],
      }),
    ).toBe(true);
  });
});

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

describe("scraper setup guidance", () => {
  const revision = {
    id: 1,
    createdAt: "2026-09-01T12:00:00Z",
    rulesVersion: SCRAPE_RULES_VERSION,
    previewStatus: "passed" as const,
  };
  const source = {
    setup: null,
    enabled: false,
    activeRevisionId: null,
    revisions: [revision],
  };

  it("moves tested setup directly to activation without a separate preview stage", () => {
    expect(getSetupSteps(source)).toMatchObject([
      { name: "Build and test", status: "Complete" },
      { name: "Collection", status: "Waiting" },
    ]);
    expect(getSetupDescription(source)).toBe(
      "The tested version is ready to activate.",
    );
  });

  it("requires testing manually saved rules", () => {
    const untested = {
      ...source,
      revisions: [{ ...revision, previewStatus: "pending" as const }],
    };
    expect(getSetupSteps(untested)[0].status).toBe("Needs test");
    expect(getSetupDescription(untested)).toBe(
      "Test the saved rules before activating them.",
    );
  });

  it("shows failed active rules as stopped without treating them as an admin pause", () => {
    const broken = {
      ...source,
      enabled: true,
      activeRevisionId: revision.id,
      revisions: [{ ...revision, previewStatus: "failed" as const }],
    };
    expect(getSetupSteps(broken)).toMatchObject([
      { status: "Needs attention" },
      { status: "Stopped" },
    ]);
    expect(getSetupSteps({ ...broken, enabled: false })[1].status).toBe(
      "Paused",
    );
  });
});
