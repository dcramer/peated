import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";

import {
  RatingMeasure,
  type BottleComparisonRow,
} from "@peated/web/components/designSystem/components";

type Bottle = Outputs["bottles"]["list"]["results"][number];

const releaseDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

function formatAbv(abv: number) {
  return abv.toFixed(1).replace(/\.0$/, "");
}

function formatBottleMetadata(bottle: Bottle) {
  const origins = [
    ...new Set(
      bottle.distillers
        .map((distiller) => distiller.region?.name ?? distiller.country?.name)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const origin =
    origins.length === 1
      ? origins[0]
      : bottle.category
        ? formatCategoryName(bottle.category)
        : null;

  return [
    origin,
    bottle.statedAge !== null
      ? `${bottle.statedAge} years`
      : bottle.noAgeStatement
        ? "NAS"
        : null,
    bottle.abv !== null ? `${formatAbv(bottle.abv)}% ABV` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function formatReleaseMetadata(bottle: Bottle) {
  const release = bottle.releaseDate
    ? `Released ${releaseDateFormatter.format(
        new Date(`${bottle.releaseDate}T00:00:00Z`),
      )}`
    : bottle.releaseYear
      ? `Released ${bottle.releaseYear}`
      : null;

  return [release, formatBottleMetadata(bottle)]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

export function toBottleTableRow(
  bottle: Bottle,
  metadata = formatBottleMetadata(bottle),
): BottleComparisonRow {
  return {
    href: `/bottles/${bottle.id}`,
    id: bottle.peatedId,
    metadata,
    name: formatBottleDisplayName(bottle),
    values: [
      <RatingMeasure
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

export function toReleaseTableRow(bottle: Bottle): BottleComparisonRow {
  return toBottleTableRow(bottle, formatReleaseMetadata(bottle));
}
