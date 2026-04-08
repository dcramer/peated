import { call } from "@orpc/server";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  externalSites,
  reviews,
} from "@peated/server/db/schema";
import { findBottleTarget, findEntity } from "@peated/server/lib/bottleFinder";
import { mapRows, upsertBottleAlias } from "@peated/server/lib/db";
import { normalizeBottle } from "@peated/server/lib/normalize";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  BottleInputSchema,
  ReviewInputSchema,
  ReviewSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import { eq, sql } from "drizzle-orm";
import bottleCreate from "../bottles/create";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/reviews",
    summary: "Create review",
    description:
      "Create a new review from external site data with automatic bottle matching and alias creation. Requires admin privileges",
    operationId: "createReview",
  })
  .input(ReviewInputSchema)
  .output(ReviewSchema)
  .handler(async function ({ input, context, errors }) {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
    });

    if (!site) {
      throw errors.NOT_FOUND({
        message: "Site not found.",
      });
    }

    const rawName = input.name;
    const { name: normalizedName } = normalizeBottle({ name: rawName });

    const rawMatchedTarget = await findBottleTarget(rawName);
    const matchedTarget =
      rawMatchedTarget ??
      (rawName === normalizedName
        ? null
        : await findBottleTarget(normalizedName));
    let bottleId = matchedTarget?.bottleId ?? null;
    let releaseId = matchedTarget?.releaseId ?? null;
    const reviewName =
      rawMatchedTarget?.releaseId != null && rawName !== normalizedName
        ? rawName
        : normalizedName;

    if (!bottleId) {
      const entity = await findEntity(normalizedName);
      if (entity) {
        const result = await call(
          bottleCreate,
          BottleInputSchema.parse({
            name: normalizedName,
            edition: null,
            brand: entity.id,
            category: input.category,
          }),
          { context },
        );
        bottleId = result.id;
      }
    }

    const review = await db.transaction(async (tx) => {
      const { rows } = await tx.execute(
        sql`INSERT INTO ${reviews} (bottle_id, release_id, external_site_id, name, issue, rating, url)
            VALUES (${bottleId}, ${releaseId}, ${site.id}, ${reviewName}, ${input.issue}, ${input.rating}, ${input.url})
            ON CONFLICT (external_site_id, LOWER(name), issue)
            DO UPDATE
            SET bottle_id = COALESCE(excluded.bottle_id, ${reviews.bottleId}),
                release_id = COALESCE(excluded.release_id, ${reviews.releaseId}),
                rating = excluded.rating,
                url = excluded.url,
                updated_at = NOW()
            RETURNING *`,
      );

      const [review] = mapRows(rows, reviews);

      if (bottleId) {
        await upsertBottleAlias(tx, reviewName, bottleId, releaseId);
      } else {
        await tx
          .insert(bottleAliases)
          .values({
            name: reviewName,
          })
          .onConflictDoNothing();
      }
      return review;
    });

    await db
      .update(externalSites)
      .set({ lastRunAt: sql`NOW()` })
      .where(eq(externalSites.id, site.id));

    return await serialize(ReviewSerializer, review, context.user);
  });
