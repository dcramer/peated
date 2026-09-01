import type { Outputs } from "@peated/server/orpc/router";

import { BottleRatings, type BottleTableRow } from "@peated/web/components";
import { toBottleCatalogItem } from "@peated/web/lib/bottleCatalogItem";

type Bottle = Outputs["bottles"]["list"]["results"][number];

export function toBottleTableRow(bottle: Bottle): BottleTableRow {
  const item = toBottleCatalogItem(bottle);

  return {
    brand: item.brand,
    brandHref: item.brandHref,
    hasTasted: item.hasTasted,
    href: item.href,
    id: item.id,
    imageUrl: item.imageUrl,
    isLibrary: item.isLibrary,
    metadata: item.metadata,
    name: item.name,
    relatedReleases: item.relatedReleases,
    values: [
      <BottleRatings
        counts={bottle.tastingBandCounts}
        high={bottle.maxScore}
        key={`${bottle.id}-rating`}
        low={bottle.minScore}
        median={bottle.medianScore}
        scoreCount={bottle.scoreCount}
      />,
    ],
  };
}
