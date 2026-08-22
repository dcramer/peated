import { EXTERNAL_SITE_DEFINITIONS } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  externalSites,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { syncExternalSites } from "./externalSites";

test("syncs code-owned external-site definitions", async () => {
  const nextRunAt = new Date("2026-08-14T12:00:00Z");
  const [existing] = await db
    .insert(externalSites)
    .values({
      type: "totalwine",
      name: "Old name",
      runEvery: 60,
      nextRunAt,
    })
    .returning();

  await syncExternalSites();

  const sites = await db.select().from(externalSites);
  expect(sites).toHaveLength(Object.keys(EXTERNAL_SITE_DEFINITIONS).length);

  const [totalWine] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, "totalwine"));
  expect(totalWine).toMatchObject({
    id: existing?.id,
    name: EXTERNAL_SITE_DEFINITIONS.totalwine.name,
    runEvery: EXTERNAL_SITE_DEFINITIONS.totalwine.runEvery,
    nextRunAt,
  });

  const [fineDrams] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, "finedrams"));
  expect(fineDrams).toMatchObject(EXTERNAL_SITE_DEFINITIONS.finedrams);

  const policies = await db.select().from(externalReviewSourcePolicies);
  expect(policies).toHaveLength(9);
  expect(policies).toEqual(
    expect.arrayContaining(
      [
        "bourbonculture",
        "dramface",
        "fredminnick",
        "whiskeyreviewer",
        "whiskyadvocate",
        "whiskyfun",
        "whiskynotes",
        "whiskysaga",
        "wordsofwhisky",
      ].map((type) =>
        expect.objectContaining({
          externalSiteId: sites.find((site) => site.type === type)?.id,
          publicationMode: "disabled",
          allowLlmProcessing: false,
          allowScoreDisplay: false,
          allowSummaryDisplay: false,
        }),
      ),
    ),
  );
});
