import { TRPCError } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { authedProcedure } from "..";
import { db } from "../../db";
import { bottleReleases, bottles, changes } from "../../db/schema";
import { formatReleaseName } from "../../lib/format";
import { BottleReleaseInputSchema } from "../../schemas/bottleReleases";
import { serialize } from "../../serializers";
import { BottleReleaseSerializer } from "../../serializers/bottleRelease";
import { ConflictError } from "../errors";

export default authedProcedure
  .input(
    BottleReleaseInputSchema.extend({
      bottleId: z.number(),
    }),
  )
  .mutation(async function ({ input, ctx }) {
    // Verify the bottle exists
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottleId));

    if (!bottle) {
      throw new TRPCError({
        message: "Bottle not found.",
        code: "NOT_FOUND",
      });
    }

    // Validate statedAge against bottle's statedAge
    if (
      bottle.statedAge &&
      input.statedAge &&
      bottle.statedAge !== input.statedAge
    ) {
      throw new TRPCError({
        message: "Release statedAge must match bottle's statedAge.",
        code: "BAD_REQUEST",
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
      throw new TRPCError({
        message: "Release name cannot be the same as the bottle name.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    let release;
    await db.transaction(async (tx) => {
      // Create the release
      [release] = await tx
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
          createdById: ctx.user.id,
        })
        .returning();

      // Create change record
      await tx.insert(changes).values({
        objectType: "bottle_release",
        objectId: release.id,
        createdById: ctx.user.id,
        displayName: release.fullName,
        type: "add",
        data: {
          ...release,
        },
      });

      // Increment the numReleases counter on the bottle
      await tx
        .update(bottles)
        .set({
          numReleases: sql`${bottles.numReleases} + 1`,
        })
        .where(eq(bottles.id, input.bottleId));
    });

    if (!release) {
      throw new TRPCError({
        message: "Failed to create release.",
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return await serialize(BottleReleaseSerializer, release, ctx.user);
  });
