import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  scrapeOrigins,
  scrapeTargets,
} from "@peated/server/db/schema";

const targetValues = {
  key: "test-target",
  minimumSpacingMs: 2_000,
  requestsPerWindow: 300,
  windowMs: 3_600_000,
  timeoutMs: 30_000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxRetries: 2,
};

test("target state enforces policy, counters, and paired leases", async () => {
  await expect(
    db.insert(scrapeTargets).values({
      ...targetValues,
      requestsPerWindow: 0,
    }),
  ).rejects.toThrow(/scrape_target_policy_check/);

  await expect(
    db.insert(scrapeTargets).values({
      ...targetValues,
      leaseToken: "orphaned-token",
    }),
  ).rejects.toThrow(/scrape_target_lease_pair_check/);
});

test("origin state requires exact origins and reviewed robots bypasses", async () => {
  await db.insert(scrapeTargets).values(targetValues);

  await expect(
    db.insert(scrapeOrigins).values({
      origin: "https://example.com/path",
      targetKey: targetValues.key,
      robotsMode: "enforce",
    }),
  ).rejects.toThrow(/scrape_origin_value_check/);

  await expect(
    db.insert(scrapeOrigins).values({
      origin: "https://example.com",
      targetKey: targetValues.key,
      robotsMode: "not_applicable",
    }),
  ).rejects.toThrow(/scrape_origin_robots_rationale_check/);
});

test("run state enforces bounded counters and paired execution claims", async () => {
  const [site] = await db
    .insert(externalSites)
    .values({ type: "finedrams", name: "Fine Drams" })
    .returning();
  if (!site) throw new Error("Expected fixture site.");

  await expect(
    db.insert(externalSiteRuns).values({
      externalSiteId: site.id,
      trigger: "manual",
      requestLimit: 2,
      sliceRequestCount: 3,
    }),
  ).rejects.toThrow(/external_site_run_request_budget_check/);

  await expect(
    db.insert(externalSiteRuns).values({
      externalSiteId: site.id,
      trigger: "manual",
      executionToken: "orphaned-token",
    }),
  ).rejects.toThrow(/external_site_run_execution_pair_check/);
});
