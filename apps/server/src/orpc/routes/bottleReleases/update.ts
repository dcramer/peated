import { db } from "@peated/server/db";
import { bottleReleases, bottles, changes } from "@peated/server/db/schema";
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
import { and, eq, isNull, sql } from "drizzle-orm";
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
      const nextEdition = hasInputField(input, "edition")
        ? (input.edition ?? null)
        : release.edition;
      const nextStatedAge = hasInputField(input, "statedAge")
        ? (input.statedAge ?? null)
        : release.statedAge;
      const nextAbv = hasInputField(input, "abv")
        ? (input.abv ?? null)
        : release.abv;
      const nextReleaseYear = hasInputField(input, "releaseYear")
        ? (input.releaseYear ?? null)
        : release.releaseYear;
      const nextVintageYear = hasInputField(input, "vintageYear")
        ? (input.vintageYear ?? null)
        : release.vintageYear;
      const nextSingleCask = hasInputField(input, "singleCask")
        ? (input.singleCask ?? null)
        : release.singleCask;
      const nextCaskStrength = hasInputField(input, "caskStrength")
        ? (input.caskStrength ?? null)
        : release.caskStrength;
      const nextCaskFill = hasInputField(input, "caskFill")
        ? (input.caskFill ?? null)
        : release.caskFill;
      const nextCaskType = hasInputField(input, "caskType")
        ? (input.caskType ?? null)
        : release.caskType;
      const nextCaskSize = hasInputField(input, "caskSize")
        ? (input.caskSize ?? null)
        : release.caskSize;
      const nextDescription = hasInputField(input, "description")
        ? (input.description ?? null)
        : release.description;
      const nextImageUrl = hasInputField(input, "imageUrl")
        ? (input.imageUrl ?? null)
        : release.imageUrl;
      const nextTastingNotes = hasInputField(input, "tastingNotes")
        ? (input.tastingNotes ?? null)
        : release.tastingNotes;

      const resolvedReleaseIdentity = getResolvedReleaseIdentity({
        bottle,
        release: {
          edition: nextEdition,
          statedAge: nextStatedAge,
          abv: nextAbv,
          releaseYear: nextReleaseYear,
          vintageYear: nextVintageYear,
          singleCask: nextSingleCask,
          caskStrength: nextCaskStrength,
          caskFill: nextCaskFill,
          caskType: nextCaskType,
          caskSize: nextCaskSize,
        },
      });

      // Always derive the name from the resolved bottle/release identity so a
      // parent bottle age does not get duplicated into the release suffix.
      const { name, fullName } = formatCanonicalReleaseName({
        bottleName: bottle.name,
        bottleFullName: bottle.fullName,
        bottleStatedAge: bottle.statedAge,
        release: resolvedReleaseIdentity,
      });

      const existingRelease = await tx.query.bottleReleases.findFirst({
        where: and(
          eq(bottleReleases.bottleId, bottle.id),
          // Check edition
          resolvedReleaseIdentity.edition !== null
            ? eq(
                sql`LOWER(${bottleReleases.edition})`,
                resolvedReleaseIdentity.edition.toLowerCase(),
              )
            : isNull(bottleReleases.edition),
          // Check vintage year
          resolvedReleaseIdentity.vintageYear !== null
            ? eq(
                bottleReleases.vintageYear,
                resolvedReleaseIdentity.vintageYear,
              )
            : isNull(bottleReleases.vintageYear),
          // Check release year
          resolvedReleaseIdentity.releaseYear !== null
            ? eq(
                bottleReleases.releaseYear,
                resolvedReleaseIdentity.releaseYear,
              )
            : isNull(bottleReleases.releaseYear),
          // Check stated age
          resolvedReleaseIdentity.statedAge !== null
            ? eq(bottleReleases.statedAge, resolvedReleaseIdentity.statedAge)
            : isNull(bottleReleases.statedAge),
          resolvedReleaseIdentity.abv !== null
            ? eq(bottleReleases.abv, resolvedReleaseIdentity.abv)
            : isNull(bottleReleases.abv),
          resolvedReleaseIdentity.singleCask !== null
            ? eq(bottleReleases.singleCask, resolvedReleaseIdentity.singleCask)
            : isNull(bottleReleases.singleCask),
          resolvedReleaseIdentity.caskStrength !== null
            ? eq(
                bottleReleases.caskStrength,
                resolvedReleaseIdentity.caskStrength,
              )
            : isNull(bottleReleases.caskStrength),
          resolvedReleaseIdentity.caskSize !== null
            ? eq(bottleReleases.caskSize, resolvedReleaseIdentity.caskSize)
            : isNull(bottleReleases.caskSize),
          resolvedReleaseIdentity.caskType !== null
            ? eq(bottleReleases.caskType, resolvedReleaseIdentity.caskType)
            : isNull(bottleReleases.caskType),
          resolvedReleaseIdentity.caskFill !== null
            ? eq(bottleReleases.caskFill, resolvedReleaseIdentity.caskFill)
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
          description: nextDescription,
          imageUrl: nextImageUrl,
          tastingNotes: nextTastingNotes,
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
