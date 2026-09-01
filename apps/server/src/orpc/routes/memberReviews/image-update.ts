import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { memberReviews } from "@peated/server/db/schema";
import { humanizeBytes } from "@peated/server/lib/strings";
import { compressAndResizeImage, storeFile } from "@peated/server/lib/uploads";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import { MemberReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { MemberReviewSerializer } from "@peated/server/serializers/memberReview";
import { and, eq, sql } from "drizzle-orm";
import { Readable } from "node:stream";
import { z } from "zod";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/bottles/{bottle}/member-review/image",
    summary: "Update my member review image",
    operationId: "updateMemberReviewImage",
  })
  .input(
    z.object({
      bottle: z.coerce.number().int().positive(),
      file: z.instanceof(Blob),
    }),
  )
  .output(MemberReviewSchema)
  .handler(async ({ input, context, errors }) => {
    const review = await db.query.memberReviews.findFirst({
      where: and(
        eq(memberReviews.bottleId, input.bottle),
        eq(memberReviews.createdById, context.user.id),
      ),
    });
    if (!review) {
      throw errors.NOT_FOUND({ message: "Review not found." });
    }
    if (input.file.size > MAX_FILESIZE) {
      throw errors.PAYLOAD_TOO_LARGE({
        message: `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`,
      });
    }

    const imageUrl = await storeFile({
      data: {
        file: Readable.from(Buffer.from(await input.file.arrayBuffer())),
      },
      namespace: "member-reviews",
      urlPrefix: "/uploads",
      onProcess: (...args) => compressAndResizeImage(...args, undefined, 1024),
    });
    const [updated] = await db
      .update(memberReviews)
      .set({ imageUrl, updatedAt: sql`NOW()` })
      .where(eq(memberReviews.id, review.id))
      .returning();
    if (!updated) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Unable to update review.",
      });
    }

    return await serialize(MemberReviewSerializer, updated, context.user);
  });
