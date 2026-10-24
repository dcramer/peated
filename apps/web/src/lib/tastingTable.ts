import type { Outputs } from "@peated/server/orpc/router";
import type { TastingTableItem } from "@peated/web/components/tastingTable.stylex";
import { getBottleIdentityProps } from "@peated/web/lib/bottleListItem";
import { getTastingUrl } from "@peated/web/lib/urls";

type Tasting = Outputs["tastings"]["list"]["results"][number];

/**
 * Maps tasting list results to TastingTable rows. A tasting photo covers the
 * thumbnail; catalog art stays complete. Notes collapse to one line of text.
 */
export function getTastingTableItems(
  tastings: readonly Tasting[],
): TastingTableItem[] {
  return tastings.map((tasting) => {
    const { abv, name } = getBottleIdentityProps(tasting.bottle);
    const note = tasting.notes?.trim().replace(/\s+/g, " ");
    return {
      abv: abv ?? null,
      href: getTastingUrl(tasting),
      id: String(tasting.id),
      imageFit: tasting.imageUrl ? "cover" : "contain",
      imageUrl: tasting.imageUrl ?? tasting.bottle.imageUrl,
      name,
      note: note || undefined,
      ratingBand: tasting.ratingBand,
      tastedAt: tasting.tastedAt,
    };
  });
}
