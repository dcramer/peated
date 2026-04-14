import type { ReleaseIdentityInput } from "@peated/bottle-classifier/releaseIdentity";
import { type AnyDatabase } from "@peated/server/db";
import { bottleReleases } from "@peated/server/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

function getBottleReleaseIdentityWhere({
  bottleId,
  release,
  excludeReleaseId,
}: {
  bottleId: number;
  release: ReleaseIdentityInput;
  excludeReleaseId?: number;
}) {
  return and(
    eq(bottleReleases.bottleId, bottleId),
    release.edition !== null
      ? eq(sql`LOWER(${bottleReleases.edition})`, release.edition.toLowerCase())
      : isNull(bottleReleases.edition),
    release.vintageYear !== null
      ? eq(bottleReleases.vintageYear, release.vintageYear)
      : isNull(bottleReleases.vintageYear),
    release.releaseYear !== null
      ? eq(bottleReleases.releaseYear, release.releaseYear)
      : isNull(bottleReleases.releaseYear),
    release.statedAge !== null
      ? eq(bottleReleases.statedAge, release.statedAge)
      : isNull(bottleReleases.statedAge),
    release.abv !== null
      ? eq(bottleReleases.abv, release.abv)
      : isNull(bottleReleases.abv),
    release.singleCask !== null
      ? eq(bottleReleases.singleCask, release.singleCask)
      : isNull(bottleReleases.singleCask),
    release.caskStrength !== null
      ? eq(bottleReleases.caskStrength, release.caskStrength)
      : isNull(bottleReleases.caskStrength),
    release.caskSize !== null
      ? eq(bottleReleases.caskSize, release.caskSize)
      : isNull(bottleReleases.caskSize),
    release.caskType !== null
      ? eq(bottleReleases.caskType, release.caskType)
      : isNull(bottleReleases.caskType),
    release.caskFill !== null
      ? eq(bottleReleases.caskFill, release.caskFill)
      : isNull(bottleReleases.caskFill),
    excludeReleaseId !== undefined
      ? sql`${bottleReleases.id} != ${excludeReleaseId}`
      : undefined,
  );
}

export async function findExistingBottleReleaseByIdentity(
  tx: AnyDatabase,
  {
    bottleId,
    release,
    excludeReleaseId,
  }: {
    bottleId: number;
    release: ReleaseIdentityInput;
    excludeReleaseId?: number;
  },
) {
  return tx.query.bottleReleases.findFirst({
    where: getBottleReleaseIdentityWhere({
      bottleId,
      release,
      excludeReleaseId,
    }),
  });
}
