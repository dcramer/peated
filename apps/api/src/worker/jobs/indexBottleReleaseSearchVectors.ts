import { db } from "@peated/server/db";
import { bottleReleases, entities } from "@peated/server/db/schema";
import { buildBottleReleaseSearchVector } from "@peated/server/lib/search";
import { eq } from "drizzle-orm";

export default async ({ releaseId }: { releaseId: number }) => {
  const release = await db.query.bottleReleases.findFirst({
    where: (bottleReleases, { eq }) => eq(bottleReleases.id, releaseId),
    with: {
      bottle: true,
    },
  });
  if (!release) {
    throw new Error(`Unknown release: ${releaseId}`);
  }

  const { bottle } = release;

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, bottle.brandId));

  const searchVector =
    buildBottleReleaseSearchVector(bottle, release, brand!) || null;

  console.log(`Updating searchVector for Bottle ${bottle.id}`);

  await db
    .update(bottleReleases)
    .set({
      searchVector,
    })
    .where(eq(bottleReleases.id, release.id));
};
