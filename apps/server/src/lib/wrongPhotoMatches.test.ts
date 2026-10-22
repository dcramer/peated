import config from "@peated/server/config";
import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { wrongPhotoMatches } from "@peated/server/db/schema";
import {
  copyPendingImageToWrongPhotoMatch,
  createPendingImageUpload,
} from "@peated/server/lib/pendingUploads";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import {
  cleanupWrongPhotoMatchPhotos,
  WRONG_PHOTO_MATCH_PHOTO_TTL_MS,
} from "@peated/server/lib/wrongPhotoMatches";
import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const DAY_MS = 1000 * 60 * 60 * 24;

async function reportWithPhoto(
  fixtures: typeof Fixtures,
  user: User,
  createdAt: Date,
) {
  const upload = await createPendingImageUpload({
    file: await fixtures.SampleSquareImage(),
    createdById: user.id,
    purpose: "photo_tasting_entry",
  });
  const imageUrl = await copyPendingImageToWrongPhotoMatch({
    id: upload.id,
    userId: user.id,
  });
  const match = await fixtures.WrongPhotoMatch({
    createdById: user.id,
    pendingUploadId: upload.id,
    imageUrl,
    createdAt,
  });
  return { match, file: path.join(config.UPLOAD_PATH, imageUrl.slice(9)) };
}

describe("cleanupWrongPhotoMatchPhotos", () => {
  test("deletes photos after 30 days and keeps the record", async ({
    defaults,
    fixtures,
  }) => {
    const now = new Date();
    const old = await reportWithPhoto(
      fixtures,
      defaults.user,
      new Date(now.getTime() - WRONG_PHOTO_MATCH_PHOTO_TTL_MS - DAY_MS),
    );
    const recent = await reportWithPhoto(
      fixtures,
      defaults.user,
      new Date(now.getTime() - WRONG_PHOTO_MATCH_PHOTO_TTL_MS + DAY_MS),
    );
    expect(existsSync(old.file)).toBe(true);

    expect(await cleanupWrongPhotoMatchPhotos({ now })).toEqual({
      deleted: 1,
    });

    expect(existsSync(old.file)).toBe(false);
    expect(
      await db.query.wrongPhotoMatches.findFirst({
        where: eq(wrongPhotoMatches.id, old.match.id),
      }),
    ).toMatchObject({
      imageUrl: null,
      imageEvidence: old.match.imageEvidence,
      wrongBottleId: old.match.wrongBottleId,
    });
    expect(existsSync(recent.file)).toBe(true);
    expect(
      await db.query.wrongPhotoMatches.findFirst({
        where: eq(wrongPhotoMatches.id, recent.match.id),
      }),
    ).toMatchObject({ imageUrl: recent.match.imageUrl });

    // A second run finds nothing left to delete.
    expect(await cleanupWrongPhotoMatchPhotos({ now })).toEqual({
      deleted: 0,
    });
  });
});
