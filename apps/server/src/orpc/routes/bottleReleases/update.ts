import { db } from "@peated/server/db";
import { bottleReleases, bottles, changes } from "@peated/server/db/schema";
import { upsertBottleAlias } from "@peated/server/lib/db";
import { formatReleaseName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { ConflictError } from "@peated/server/orpc/errors";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  BottleReleaseInputSchema,
  BottleReleaseSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleReleaseSerializer } from "@peated/server/serializers/bottleRelease";
import { pushJob } from "@peated/server/worker/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = BottleReleaseInputSchema.partial().extend({
  release: z.coerce.number(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottle-releases/{release}",
    summary: "Update bottle release",
    description:
      "Update bottle release information including edition, vintage, and cask details. Requires moderator privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "updateBottleRelease",
    }),
  })
  .input(InputSchema)
  .output(BottleReleaseSchema)
  .handler(async function ({ input, context, errors }) {
    const user = context.user;

    const updatedRelease = await db.transaction(async (tx) => {
      // Get the existing release with a lock
      const [release] = await tx
        .select()
        .from(bottleReleases)
        .where(eq(bottleReleases.id, input.release))
        .for("update");

      if (!release) {
        throw errors.NOT_FOUND({
          message: "Release not found.",
        });
      }

      // Get the associated bottle
      const [bottle] = await tx
        .select()
        .from(bottles)
        .where(eq(bottles.id, release.bottleId));

      if (!bottle) {
        throw errors.NOT_FOUND({
          message: "Bottle not found.",
        });
      }

      // Validate statedAge against bottle's statedAge
      if (
        bottle.statedAge &&
        input.statedAge &&
        bottle.statedAge !== input.statedAge
      ) {
        throw errors.BAD_REQUEST({
          message: "Release statedAge must match bottle's statedAge.",
        });
      }

      // Format the new name based on updated fields
      const name = formatReleaseName({
        name: bottle.name,
        edition: input.edition ?? release.edition,
        abv: input.abv ?? release.abv,
        statedAge: bottle.statedAge
          ? null
          : (input.statedAge ?? release.statedAge),
        releaseYear: input.releaseYear ?? release.releaseYear,
        vintageYear: input.vintageYear ?? release.vintageYear,
        singleCask: input.singleCask ?? release.singleCask,
        caskStrength: input.caskStrength ?? release.caskStrength,
        caskFill: input.caskFill ?? release.caskFill,
        caskType: input.caskType ?? release.caskType,
        caskSize: input.caskSize ?? release.caskSize,
      });

      const fullName = formatReleaseName({
        name: bottle.fullName,
        edition: input.edition ?? release.edition,
        abv: input.abv ?? release.abv,
        statedAge: bottle.statedAge
          ? null
          : (input.statedAge ?? release.statedAge),
        releaseYear: input.releaseYear ?? release.releaseYear,
        vintageYear: input.vintageYear ?? release.vintageYear,
        singleCask: input.singleCask ?? release.singleCask,
        caskStrength: input.caskStrength ?? release.caskStrength,
        caskFill: input.caskFill ?? release.caskFill,
        caskType: input.caskType ?? release.caskType,
        caskSize: input.caskSize ?? release.caskSize,
      });

      // Check for existing release with same attributes
      const newData = {
        edition: input.edition !== undefined ? input.edition : release.edition,
        vintageYear:
          input.vintageYear !== undefined
            ? input.vintageYear
            : release.vintageYear,
        releaseYear:
          input.releaseYear !== undefined
            ? input.releaseYear
            : release.releaseYear,
        statedAge:
          input.statedAge !== undefined ? input.statedAge : release.statedAge,
        abv: input.abv !== undefined ? input.abv : release.abv,
        singleCask:
          input.singleCask !== undefined
            ? input.singleCask
            : release.singleCask,
        caskStrength:
          input.caskStrength !== undefined
            ? input.caskStrength
            : release.caskStrength,
        caskSize:
          input.caskSize !== undefined ? input.caskSize : release.caskSize,
        caskType:
          input.caskType !== undefined ? input.caskType : release.caskType,
        caskFill:
          input.caskFill !== undefined ? input.caskFill : release.caskFill,
      };

      const existingRelease = await tx.query.bottleReleases.findFirst({
        where: and(
          eq(bottleReleases.bottleId, bottle.id),
          // Check edition
          newData.edition !== null
            ? eq(
                sql`LOWER(${bottleReleases.edition})`,
                newData.edition.toLowerCase(),
              )
            : isNull(bottleReleases.edition),
          // Check vintage year
          newData.vintageYear !== null
            ? eq(bottleReleases.vintageYear, newData.vintageYear)
            : isNull(bottleReleases.vintageYear),
          // Check release year
          newData.releaseYear !== null
            ? eq(bottleReleases.releaseYear, newData.releaseYear)
            : isNull(bottleReleases.releaseYear),
          // Check stated age
          newData.statedAge !== null
            ? eq(bottleReleases.statedAge, newData.statedAge)
            : isNull(bottleReleases.statedAge),
          newData.abv !== null
            ? eq(bottleReleases.abv, newData.abv)
            : isNull(bottleReleases.abv),
          newData.singleCask !== null
            ? eq(bottleReleases.singleCask, newData.singleCask)
            : isNull(bottleReleases.singleCask),
          newData.caskStrength !== null
            ? eq(bottleReleases.caskStrength, newData.caskStrength)
            : isNull(bottleReleases.caskStrength),
          newData.caskSize !== null
            ? eq(bottleReleases.caskSize, newData.caskSize)
            : isNull(bottleReleases.caskSize),
          newData.caskType !== null
            ? eq(bottleReleases.caskType, newData.caskType)
            : isNull(bottleReleases.caskType),
          newData.caskFill !== null
            ? eq(bottleReleases.caskFill, newData.caskFill)
            : isNull(bottleReleases.caskFill),
          // Exclude the current release from the check
          sql`${bottleReleases.id} != ${release.id}`,
        ),
      });

      if (existingRelease) {
        throw new ConflictError(
          existingRelease,
          undefined,
          "A release with these attributes already exists.",
        );
      }

      if (
        name.toLowerCase() === bottle.name.toLowerCase() ||
        fullName.toLowerCase() === bottle.fullName.toLowerCase()
      ) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Release name cannot be the same as the bottle name.",
        });
      }

      // Update the release
      const [updatedRelease] = await tx
        .update(bottleReleases)
        .set({
          fullName,
          name,
          edition: input.edition ?? release.edition,
          vintageYear: input.vintageYear ?? release.vintageYear,
          releaseYear: input.releaseYear ?? release.releaseYear,
          abv: input.abv ?? release.abv,
          singleCask: input.singleCask ?? release.singleCask,
          caskStrength: input.caskStrength ?? release.caskStrength,
          statedAge: (bottle.statedAge || input.statedAge) ?? release.statedAge,
          caskSize: input.caskSize ?? release.caskSize,
          caskType: input.caskType ?? release.caskType,
          caskFill: input.caskFill ?? release.caskFill,
          description: input.description ?? release.description,
          imageUrl: input.imageUrl ?? release.imageUrl,
          tastingNotes: input.tastingNotes ?? release.tastingNotes,
          updatedAt: sql`NOW()`,
        })
        .where(eq(bottleReleases.id, release.id))
        .returning();

      if (!updatedRelease) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Failed to update release.",
        });
      }

      const releaseAlias = await upsertBottleAlias(
        tx,
        fullName,
        bottle.id,
        updatedRelease.id,
      );

      if (
        releaseAlias.bottleId !== bottle.id ||
        (releaseAlias.releaseId ?? null) !== updatedRelease.id
      ) {
        throw errors.CONFLICT({
          message: "Release alias already belongs to a different bottle.",
        });
      }

      // Create change record with both old and new values
      await tx.insert(changes).values({
        objectType: "bottle_release",
        objectId: updatedRelease.id,
        createdById: user.id,
        displayName: updatedRelease.fullName,
        type: "update",
        data: {
          old: {
            ...release,
          },
          new: {
            ...updatedRelease,
          },
          changes: Object.entries(input).reduce(
            (acc, [key, value]) => {
              if (value !== undefined) {
                acc[key] = value;
              }
              return acc;
            },
            {} as Record<string, any>,
          ),
        },
      });

      return updatedRelease;
    });

    if (!updatedRelease) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update release.",
      });
    }

    try {
      await pushJob("OnBottleAliasChange", { name: updatedRelease.fullName });
    } catch (err) {
      logError(err, {
        release: {
          id: updatedRelease.id,
        },
        alias: {
          name: updatedRelease.fullName,
        },
      });
    }

    try {
      await pushJob("OnBottleReleaseChange", { releaseId: updatedRelease.id });
    } catch (err) {
      logError(err, {
        release: {
          id: updatedRelease.id,
        },
      });
    }

    return await serialize(
      BottleReleaseSerializer,
      updatedRelease,
      context.user,
    );
  });
