import { db } from "@peated/server/db";
import { bottles, wrongPhotoMatches } from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import {
  copyPendingImageToWrongPhotoMatch,
  PendingUploadError,
} from "@peated/server/lib/pendingUploads";
import { deleteUploadByUrl } from "@peated/server/lib/uploads";
import { verifyWrongPhotoMatchToken } from "@peated/server/lib/wrongPhotoMatchToken";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

async function findExisting(userId: number, pendingImageId: string) {
  return await db.query.wrongPhotoMatches.findFirst({
    columns: { id: true, imageUrl: true },
    where: and(
      eq(wrongPhotoMatches.createdById, userId),
      eq(wrongPhotoMatches.pendingUploadId, pendingImageId),
    ),
  });
}

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/wrong-photo-matches",
    summary: "Report wrong photo match",
    description:
      "Record that the Bottle matched from your label photo is not your bottle. Peated keeps the label facts it read and, for 30 days, a copy of the photo so admins can improve matching. Reporting the same photo again returns the existing record.",
    operationId: "createWrongPhotoMatch",
  })
  .input(
    z.object({
      token: z
        .string()
        .trim()
        .min(1)
        .describe("`wrongMatchToken` from the photo identification result"),
      traceId: z
        .string()
        .regex(/^[0-9a-f]{32}$/)
        .nullish()
        .describe("Sentry trace ID of the photo identification request"),
    }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context, errors }) => {
    let payload: Awaited<ReturnType<typeof verifyWrongPhotoMatchToken>>;
    try {
      payload = await verifyWrongPhotoMatchToken(input.token);
    } catch (err) {
      throw errors.BAD_REQUEST({
        message: "This photo match can no longer be reported.",
        cause: err,
      });
    }
    if (payload.userId !== context.user.id) {
      throw errors.BAD_REQUEST({
        message: "This photo match can no longer be reported.",
      });
    }

    const existing = await findExisting(
      context.user.id,
      payload.pendingImageId,
    );
    if (existing) return { id: existing.id };

    let imageUrl: string;
    try {
      imageUrl = await copyPendingImageToWrongPhotoMatch({
        id: payload.pendingImageId,
        userId: context.user.id,
      });
    } catch (err) {
      if (err instanceof PendingUploadError) {
        throw errors.BAD_REQUEST({
          message: "This photo match can no longer be reported.",
          cause: err,
        });
      }
      throw err;
    }

    // The matched Bottle may have been merged or deleted since the photo was
    // read; keep the report without it.
    const wrongBottle = await db.query.bottles.findFirst({
      columns: { id: true },
      where: eq(bottles.id, payload.bottleId),
    });

    const [created] = await db
      .insert(wrongPhotoMatches)
      .values({
        createdById: context.user.id,
        pendingUploadId: payload.pendingImageId,
        imageUrl,
        imageEvidence: payload.imageEvidence,
        wrongBottleId: wrongBottle?.id ?? null,
        traceId: input.traceId ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: wrongPhotoMatches.id });
    if (created) return { id: created.id };

    // A repeated request won the race; return its record. Copies of one photo
    // share a path, so delete this copy only if the saved record uses another.
    const raced = await findExisting(context.user.id, payload.pendingImageId);
    if (!raced) {
      throw new Error("Wrong photo match conflict without a saved record.");
    }
    if (raced.imageUrl !== imageUrl) {
      try {
        await deleteUploadByUrl(imageUrl);
      } catch (err) {
        logError(err);
      }
    }
    return { id: raced.id };
  });
