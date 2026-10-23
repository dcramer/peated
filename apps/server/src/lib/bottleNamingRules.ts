import type { AnyTransaction } from "@peated/server/db";
import { bottleGroups, bottles } from "@peated/server/db/schema";
import { and, asc, eq, ne, sql } from "drizzle-orm";

// Whisky Identity Model, "Bottle Name, Edition, And Cask Number": these checks
// reject names and editions that break the naming rule. They compare stored
// fields only; the classifier and catalog editors own what the label means.

const CASK_MARKER_PREFIX =
  /^(?:casks?|barrels?)?\s*(?:no\.?|number|ref\.?)?\s*#?\s*/iu;

function normalizeCaskText(value: string) {
  return value.replace(CASK_MARKER_PREFIX, "").trim().toLocaleLowerCase();
}

/** Returns an error message when `edition` repeats the stored `caskNumber`. */
export function getEditionCaskNumberProblem({
  edition,
  caskNumber,
}: {
  edition?: string | null;
  caskNumber?: string | null;
}): string | null {
  if (!edition || !caskNumber) return null;

  const cask = normalizeCaskText(caskNumber);
  const repeatsCask = edition
    .split(" - ")
    .some((segment) => normalizeCaskText(segment) === cask);

  return repeatsCask
    ? `Edition "${edition}" repeats cask number ${caskNumber}. Keep the cask number in caskNumber and leave it out of edition.`
    : null;
}

type BottleTitleIdentity = {
  brandId: number;
  seriesId: number | null;
  /** Brand plus the shared Bottle name, without the edition. */
  titleFullName: string;
  edition: string | null;
  vintageYear: number | null;
  statedAge: number | null;
};

type SameTitleDifference = "vintage" | "age";

/** Returns which known fact differs between two Bottles with the same title. */
function getSameTitleDifference(
  left: Pick<BottleTitleIdentity, "vintageYear" | "statedAge">,
  right: Pick<BottleTitleIdentity, "vintageYear" | "statedAge">,
): SameTitleDifference | null {
  if (
    left.vintageYear !== null &&
    right.vintageYear !== null &&
    left.vintageYear !== right.vintageYear
  ) {
    return "vintage";
  }
  if (
    left.statedAge !== null &&
    right.statedAge !== null &&
    left.statedAge !== right.statedAge
  ) {
    return "age";
  }
  return null;
}

/**
 * Returns an error message when a Bottle in another group has the same title
 * and edition but a different vintage or age. Nothing people see tells those
 * Bottles apart, so each name must carry its vintage or age. Members of one
 * group share a name by design, so `excludeGroupId` leaves the edited
 * Bottle's group out.
 */
export async function getSameTitleProblem(
  tx: AnyTransaction,
  identity: BottleTitleIdentity,
  excludeGroupId: number | null = null,
): Promise<string | null> {
  if (identity.vintageYear === null && identity.statedAge === null) {
    return null;
  }

  const rows = await tx
    .select({
      id: bottles.id,
      vintageYear: bottles.vintageYear,
      statedAge: bottles.statedAge,
    })
    .from(bottles)
    .innerJoin(bottleGroups, eq(bottleGroups.id, bottles.groupId))
    .where(
      and(
        excludeGroupId === null
          ? undefined
          : ne(bottles.groupId, excludeGroupId),
        eq(bottleGroups.brandId, identity.brandId),
        sql`${bottleGroups.seriesId} IS NOT DISTINCT FROM ${identity.seriesId}`,
        eq(
          sql`LOWER(${bottleGroups.fullName})`,
          identity.titleFullName.toLocaleLowerCase(),
        ),
        sql`${bottles.edition} IS NOT DISTINCT FROM ${identity.edition}`,
      ),
    )
    .orderBy(asc(bottles.id));

  for (const row of rows) {
    const difference = getSameTitleDifference(identity, row);
    if (difference) {
      return `Bottle ${row.id} is also named "${identity.titleFullName}" with a different ${difference}. Add each Bottle's ${difference} to its name.`;
    }
  }
  return null;
}
