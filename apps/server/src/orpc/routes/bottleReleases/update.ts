import { db } from "@peated/server/db";
import { bottleReleases, bottles, changes } from "@peated/server/db/schema";
import { findExistingBottleReleaseByIdentity } from "@peated/server/lib/bottleReleaseIdentity";
import {
  formatCanonicalReleaseName,
  getResolvedReleaseIdentity,
} from "@peated/server/lib/bottleSchemaRules";
import { upsertBottleAlias } from "@peated/server/lib/db";
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
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

// PATCH routes need to distinguish between omitted fields and an explicit null
// clear, so we remove zod defaults before making fields optional.
const InputSchema = z.object({
  release: z.coerce.number(),
  edition: BottleReleaseInputSchema.shape.edition.removeDefault().optional(),
  statedAge: BottleReleaseInputSchema.shape.statedAge
    .removeDefault()
    .optional(),
  abv: BottleReleaseInputSchema.shape.abv.removeDefault().optional(),
  caskStrength: BottleReleaseInputSchema.shape.caskStrength
    .removeDefault()
    .optional(),
  singleCask: BottleReleaseInputSchema.shape.singleCask
    .removeDefault()
    .optional(),
  vintageYear: BottleReleaseInputSchema.shape.vintageYear
    .removeDefault()
    .optional(),
  releaseYear: BottleReleaseInputSchema.shape.releaseYear
    .removeDefault()
    .optional(),
  caskType: BottleReleaseInputSchema.shape.caskType.removeDefault().optional(),
  caskSize: BottleReleaseInputSchema.shape.caskSize.removeDefault().optional(),
  caskFill: BottleReleaseInputSchema.shape.caskFill.removeDefault().optional(),
  description: BottleReleaseInputSchema.shape.description
    .removeDefault()
    .optional(),
  tastingNotes: BottleReleaseInputSchema.shape.tastingNotes
    .removeDefault()
    .optional(),
  imageUrl: BottleReleaseInputSchema.shape.imageUrl.removeDefault().optional(),
});

function hasInputField<
  TInput extends Record<string, unknown>,
  TKey extends keyof TInput,
>(input: TInput, key: TKey) {
  return input[key] !== undefined;
}

function getPatchedNullableValue<
  TInput extends Record<string, unknown>,
  TKey extends keyof TInput,
  TValue,
>(input: TInput, key: TKey, currentValue: TValue): TValue {
  return hasInputField(input, key)
    ? ((input[key] ?? null) as TValue)
    : currentValue;
}

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/bottle-releases/{release}",
    summary: "Update bottle bottling",
    description:
      "Update bottling information including edition, vintage, and cask details. Requires moderator privileges",
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
        bottle.statedAge !== null &&
        hasInputField(input, "statedAge") &&
        input.statedAge !== null &&
        input.statedAge !== bottle.statedAge
      ) {
        throw errors.BAD_REQUEST({
          message: "Release statedAge must match bottle's statedAge.",
        });
      }

      // Preserve existing values for omitted fields while still allowing mods
      // to clear nullable release attributes with an explicit null.
      const nextReleaseIdentity = {
        edition: getPatchedNullableValue(input, "edition", release.edition),
        statedAge: getPatchedNullableValue(
          input,
          "statedAge",
          release.statedAge,
        ),
        abv: getPatchedNullableValue(input, "abv", release.abv),
        releaseYear: getPatchedNullableValue(
          input,
          "releaseYear",
          release.releaseYear,
        ),
        vintageYear: getPatchedNullableValue(
          input,
          "vintageYear",
          release.vintageYear,
        ),
        singleCask: getPatchedNullableValue(
          input,
          "singleCask",
          release.singleCask,
        ),
        caskStrength: getPatchedNullableValue(
          input,
          "caskStrength",
          release.caskStrength,
        ),
        caskFill: getPatchedNullableValue(input, "caskFill", release.caskFill),
        caskType: getPatchedNullableValue(input, "caskType", release.caskType),
        caskSize: getPatchedNullableValue(input, "caskSize", release.caskSize),
      };
      const nextReleaseMetadata = {
        description: getPatchedNullableValue(
          input,
          "description",
          release.description,
        ),
        imageUrl: getPatchedNullableValue(input, "imageUrl", release.imageUrl),
        tastingNotes: getPatchedNullableValue(
          input,
          "tastingNotes",
          release.tastingNotes,
        ),
      };

      const resolvedReleaseIdentity = getResolvedReleaseIdentity({
        bottle,
        release: nextReleaseIdentity,
      });

      // Always derive the name from the resolved bottle/release identity so a
      // parent bottle age does not get duplicated into the release suffix.
      const { name, fullName } = formatCanonicalReleaseName({
        bottleName: bottle.name,
        bottleFullName: bottle.fullName,
        bottleStatedAge: bottle.statedAge,
        release: resolvedReleaseIdentity,
      });

      const existingRelease = await findExistingBottleReleaseByIdentity(tx, {
        bottleId: bottle.id,
        release: resolvedReleaseIdentity,
        excludeReleaseId: release.id,
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
          edition: resolvedReleaseIdentity.edition,
          vintageYear: resolvedReleaseIdentity.vintageYear,
          releaseYear: resolvedReleaseIdentity.releaseYear,
          abv: resolvedReleaseIdentity.abv,
          singleCask: resolvedReleaseIdentity.singleCask,
          caskStrength: resolvedReleaseIdentity.caskStrength,
          statedAge: resolvedReleaseIdentity.statedAge,
          caskSize: resolvedReleaseIdentity.caskSize,
          caskType: resolvedReleaseIdentity.caskType,
          caskFill: resolvedReleaseIdentity.caskFill,
          description: nextReleaseMetadata.description,
          imageUrl: nextReleaseMetadata.imageUrl,
          tastingNotes: nextReleaseMetadata.tastingNotes,
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
