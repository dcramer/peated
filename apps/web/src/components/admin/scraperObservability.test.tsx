import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ExternalSiteRunStatus from "./externalSiteRunStatus";
import ExternalSiteRunTelemetry from "./externalSiteRunTelemetry";
import ScraperAdapterStatus from "./scraperAdapterStatus";
import ScraperCatalogCoverage from "./scraperCatalogCoverage";
import {
  ReviewPublishingAction,
  ReviewPublishingState,
} from "./scraperPublicationSettings";
import ScraperReadiness from "./scraperReadiness";
import { getScraperRunAvailability } from "./scraperRunAvailability";
import {
  getScheduleChoice,
  getScheduleInterval,
} from "./scraperScheduleSettings.stylex";

const timestamp = "2026-08-18T12:00:00.000Z";

const site = {
  id: 1,
  imageUrl: null,
  type: "whiskyadvocate",
  name: "Whisky Advocate",
  lastRunAt: null,
  nextRunAt: null,
  runEvery: 1_440,
  externalReviews: { total: 12, matched: 10, unmatched: 2 },
  priceListings: { total: 0, matched: 0, unmatched: 0 },
  latestRun: null,
  lastSucceededAt: null,
  runtime: {
    registered: true,
    targetKeys: ["whiskyadvocate"],
    targets: [
      {
        key: "whiskyadvocate",
        enabled: false,
        blockedUntil: null,
        coolingDown: false,
        minimumSpacingMs: 2_000,
        requestsPerWindow: 300,
        windowMs: 3_600_000,
        origins: [
          {
            origin: "https://whiskyadvocate.com",
            robotsMode: "enforce",
            robotsStatus: "unknown",
            robotsFetchedAt: null,
            robotsExpiresAt: null,
          },
        ],
      },
    ],
  },
  reviewPublication: {
    externalSiteId: 1,
    approved: false,
    approvedAt: null,
    updatedAt: timestamp,
  },
} satisfies Outputs["externalSites"]["healthDetails"];

const run = {
  id: 42,
  status: "queued",
  trigger: "scheduled",
  requestedById: null,
  attemptCount: 3,
  requestLimit: 40,
  sliceRequestCount: 0,
  requestCount: 20,
  retryCount: 3,
  rateLimitCount: 2,
  emittedItemCount: 15,
  itemCount: null,
  error: null,
  nextAttemptAt: "2099-08-18T12:30:00.000Z",
  startedAt: timestamp,
  completedAt: null,
  createdAt: timestamp,
} satisfies Outputs["externalSites"]["runs"]["results"][number];

describe("scraper observability", () => {
  it("explains why a disabled scraper cannot run", () => {
    expect(getScraperRunAvailability(site)).toEqual({
      label: "Source paused",
      reason: "Requests to whiskyadvocate are paused.",
    });
  });

  it("allows a synchronized enabled manual-only scraper", () => {
    const manualOnlySite = {
      ...site,
      runEvery: null,
      runtime: {
        ...site.runtime,
        targets: site.runtime.targets.map((target) => ({
          ...target,
          enabled: true,
        })),
      },
    };

    expect(getScraperRunAvailability(manualOnlySite)).toBeNull();

    const html = renderToStaticMarkup(
      <ExternalSiteRunStatus site={manualOnlySite} />,
    );
    expect(html).toContain("Never recorded");
    expect(html).not.toContain("Disabled");
  });

  it("shows runtime and robots without owning review publishing", () => {
    const html = renderToStaticMarkup(<ScraperReadiness site={site} />);

    expect(html).toContain("Connection");
    expect(html).toContain("Disabled");
    expect(html).toContain("Sites");
    expect(html).toContain("Not checked");
    expect(html).not.toContain("Review publishing");
  });

  it("shows review publishing with matched coverage", () => {
    const html = renderToStaticMarkup(<ReviewPublishingState site={site} />);

    expect(html).toContain("Not public");
    expect(html).toContain("10 of 12 matched");
  });

  it("offers publishing without using review counts as permission", () => {
    const html = renderToStaticMarkup(
      <ReviewPublishingAction
        approved={false}
        disabled={false}
        loading={false}
        onToggle={() => undefined}
      />,
    );

    expect(html).toContain("Publish reviews");
    expect(html).not.toContain("disabled");
  });

  it("shows a stable custom-adapter state", () => {
    const html = renderToStaticMarkup(<ScraperAdapterStatus />);

    expect(html).toContain("Scraper");
    expect(html).toContain("Managed in code");
    expect(html).toContain("cannot be edited here");
  });

  it("maps manual, preset, and custom schedules", () => {
    expect(getScheduleChoice(null)).toBe("manual");
    expect(getScheduleChoice(1_440)).toBe("daily");
    expect(getScheduleChoice(10_080)).toBe("weekly");
    expect(getScheduleChoice(90)).toBe("custom");
    expect(getScheduleInterval("manual", 90)).toBeNull();
    expect(getScheduleInterval("daily", 90)).toBe(1_440);
    expect(getScheduleInterval("weekly", 90)).toBe(10_080);
    expect(getScheduleInterval("custom", 90)).toBe(90);
  });

  it("shows responsible-request and deferral telemetry", () => {
    const html = renderToStaticMarkup(<ExternalSiteRunTelemetry run={run} />);

    expect(html).toContain("20 / 40 requests");
    expect(html).toContain("3 retries");
    expect(html).toContain("2 rate limits");
    expect(html).toContain("15 items emitted");
    expect(html).toContain("continues");
  });

  it("shows aggregate Bottle and item coverage", () => {
    const html = renderToStaticMarkup(
      <ScraperCatalogCoverage
        coverage={{
          bottles: {
            total: 100,
            withDescription: 50,
            withImage: 75,
            withReviews: 25,
            withPriceListings: 80,
          },
          externalReviews: { total: 40, matched: 30, unmatched: 10 },
          priceListings: { total: 200, matched: 180, unmatched: 20 },
        }}
      />,
    );

    expect(html).toContain("50% described");
    expect(html).toContain("30 matched");
    expect(html).toContain("180 matched");
  });
});
