import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import type { LibraryItem } from "@peated/web/components/libraryList.stylex";
import type { RowMenuGroup } from "@peated/web/components/rowMenu.stylex";
import { toBottleListItem } from "@peated/web/lib/bottleListItem";

export type LibraryEntry =
  Outputs["collections"]["bottles"]["list"]["results"][number];

/**
 * Maps one Library entry to a LibraryList or LibraryTable row. The member's
 * own photo covers the thumbnail; catalog art stays complete. The in-Library
 * and tasted marks describe the viewer, not the member, so rows leave them out.
 */
export function getLibraryItem(
  entry: LibraryEntry,
  actions?: readonly RowMenuGroup[],
): LibraryItem {
  const identity = toBottleListItem(entry.bottle);
  return {
    ...identity,
    actions,
    // The table gives ABV its own column, so it stays out of this line.
    facts: [
      entry.bottle.category ? formatCategoryName(entry.bottle.category) : null,
      ...(identity.provenance ?? []).map(({ name }) => name),
      ...(identity.metadata ?? []).filter((fact) => fact !== identity.abv),
    ]
      .filter(Boolean)
      .join(" · "),
    hasTasted: false,
    id: String(entry.id),
    // Library thumbnail rule: personal photos fill the frame; catalog art stays complete.
    imageFit: entry.imageUrl ? "cover" : "contain",
    imageUrl: entry.imageUrl ?? entry.bottle.imageUrl,
    isLibrary: false,
    status: entry.status ? capitalize(entry.status) : undefined,
  };
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
