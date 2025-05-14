import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { bottleReleases, bottles, changes } from "@peated/server/db/schema";
import { formatReleaseName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { ConflictError } from "@peated/server/orpc/errors";
import { requireAuth } from "@peated/server/orpc/middleware";
import {
  BottleReleaseInputSchema,
  BottleReleaseSchema,
} from "@peated/server/schemas/bottleReleases";
import { serialize } from "@peated/server/serializers";
import { BottleReleaseSerializer } from "@peated/server/serializers/bottleRelease";
import { pushJob } from "@peated/server/worker/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .route({ method: "POST", path: "/bottle-releases" })
  .input(
    BottleReleaseInputSchema.extend({
      bottleId: z.coerce.number(),
    }),
  )
  .output(BottleReleaseSchema)
  .handler(async function ({ input, context }) {
    // Verify the bottle exists
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottleId));

    if (!bottle) {
      throw new ORPCError("NOT_FOUND", {
        message: "Bottle not found.",
      });
    }

    // Validate statedAge against bottle's statedAge
    if (
      bottle.statedAge &&
      input.statedAge &&
      bottle.statedAge !== input.statedAge
    ) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Release statedAge must match bottle's statedAge.",
      });
    }

    const name = formatReleaseName({
      name: bottle.name,
      edition: input.edition,
      abv: input.abv,
      statedAge: bottle.statedAge ? null : input.statedAge,
      releaseYear: input.releaseYear,
      vintageYear: input.vintageYear,
    });

    const fullName = formatReleaseName({
      name: bottle.fullName,
      edition: input.edition,
      abv: input.abv,
      statedAge: bottle.statedAge ? null : input.statedAge,
      releaseYear: input.releaseYear,
      vintageYear: input.vintageYear,
    });

    // Check for existing release with same attributes
    // TODO: should use SELECT FOR UPDATE to avoid race condition
    const existingRelease = await db.query.bottleReleases.findFirst({
      where: and(
        eq(bottleReleases.bottleId, input.bottleId),
        input.edition
          ? eq(
              sql`LOWER(${bottleReleases.edition})`,
              input.edition.toLowerCase(),
            )
          : isNull(bottleReleases.edition),
        input.vintageYear
          ? eq(bottleReleases.vintageYear, input.vintageYear)
          : isNull(bottleReleases.vintageYear),
        input.releaseYear
          ? eq(bottleReleases.releaseYear, input.releaseYear)
          : isNull(bottleReleases.releaseYear),
        input.statedAge
          ? eq(bottleReleases.statedAge, input.statedAge)
          : isNull(bottleReleases.statedAge),
        input.abv
          ? eq(bottleReleases.abv, input.abv)
          : isNull(bottleReleases.abv),
      ),
    });

    if (existingRelease) {
      throw new ConflictError(
        existingRelease,
        undefined,
        "A release with these attributes already exists.",
      );
    }

    if (name === bottle.name || fullName === bottle.fullName) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Release name cannot be the same as the bottle name.",
      });
    }

    const release = await db.transaction(async (tx) => {
      // Create the release
      const [release] = await tx
        .insert(bottleReleases)
        .values({
          bottleId: input.bottleId,
          fullName,
          name,
          edition: input.edition,
          vintageYear: input.vintageYear,
          releaseYear: input.releaseYear,
          abv: input.abv,
          singleCask: input.singleCask,
          caskStrength: input.caskStrength,
          statedAge: bottle.statedAge || input.statedAge,
          caskSize: input.caskSize,
          caskType: input.caskType,
          caskFill: input.caskFill,
          description: input.description,
          imageUrl: input.imageUrl,
          tastingNotes: input.tastingNotes,
          createdById: context.user.id,
        })
        .returning();

      await Promise.all([
        // Create change record
        tx.insert(changes).values({
          objectType: "bottle_release",
          objectId: release.id,
          createdById: context.user.id,
          displayName: release.fullName,
          type: "add",
          data: {
            ...release,
          },
        }),

        // Increment the numReleases counter on the bottle
        tx
          .update(bottles)
          .set({
            numReleases: sql`${bottles.numReleases} + 1`,
          })
          .where(eq(bottles.id, input.bottleId)),
      ]);

      return release;
    });

    if (!release) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create release.",
      });
    }

    try {
      await pushJob("OnBottleReleaseChange", { releaseId: release.id });
    } catch (err) {
      logError(err, {
        release: {
          id: release.id,
        },
      });
    }

    return await serialize(BottleReleaseSerializer, release, context.user);
  });
