import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ExternalSiteRunStatus from "./externalSiteRunStatus";
import ExternalSiteRunTelemetry from "./externalSiteRunTelemetry";
import ScraperCatalogCoverage from "./scraperCatalogCoverage";
import ScraperReadiness from "./scraperReadiness";
import { getScraperRunAvailability } from "./scraperRunAvailability";

const timestamp = "2026-08-18T12:00:00.000Z";

const site = {
  id: 1,
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
  reviewPolicy: {
    externalSiteId: 1,
    publicationMode: "disabled",
    allowLlmProcessing: false,
    allowScoreDisplay: false,
    allowSummaryDisplay: false,
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
      label: "Scraper disabled",
      reason: "Scraper target whiskyadvocate is disabled.",
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

  it("shows runtime, robots, and review-policy readiness", () => {
    const html = renderToStaticMarkup(<ScraperReadiness site={site} />);

    expect(html).toContain("Runtime readiness");
    expect(html).toContain("Disabled");
    expect(html).toContain("Robots: Unknown");
    expect(html).toContain("Publication: disabled");
  });

  it("shows responsible-request and deferral telemetry", () => {
    const html = renderToStaticMarkup(<ExternalSiteRunTelemetry run={run} />);

    expect(html).toContain("20 / 40 requests");
    expect(html).toContain("3 retries");
    expect(html).toContain("2 rate limits");
    expect(html).toContain("15 items emitted");
    expect(html).toContain("Continues");
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
