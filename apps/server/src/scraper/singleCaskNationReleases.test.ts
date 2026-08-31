import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { loadSingleCaskNationReleases } from "./singleCaskNationReleases";

test("loads complete releases only from Single Cask Nation listings", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSiteOrExisting({
    type: "singlecasknation",
  });
  const otherSite = await fixtures.ExternalSiteOrExisting({
    type: "totalwine",
  });
  await fixtures.StorePrice({
    bottleId: null,
    externalSiteId: site.id,
    externalProductId: "complete-release",
    sourceBottleIdentity: BottleExtractedDetailsSchema.parse({
      expression: "Complete release",
      release_year: 2025,
      release_month: 11,
    }),
  });
  await fixtures.StorePrice({
    bottleId: null,
    externalSiteId: site.id,
    externalProductId: "missing-month",
    sourceBottleIdentity: BottleExtractedDetailsSchema.parse({
      expression: "Missing month",
      release_year: 2025,
    }),
  });
  await fixtures.StorePrice({
    bottleId: null,
    externalSiteId: otherSite.id,
    externalProductId: "complete-release",
    sourceBottleIdentity: BottleExtractedDetailsSchema.parse({
      expression: "Other source",
      release_year: 2024,
      release_month: 10,
    }),
  });

  await expect(
    loadSingleCaskNationReleases([
      "complete-release",
      "missing-month",
      "unknown",
    ]),
  ).resolves.toEqual(
    new Map([["complete-release", { releaseYear: 2025, releaseMonth: 11 }]]),
  );
});
