import config from "@peated/server/config";
import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { pendingUploads, wrongPhotoMatches } from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import { signWrongPhotoMatchToken } from "@peated/server/lib/wrongPhotoMatchToken";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const TRACE_ID = "55bb2bc6ccd4469db54e89b1d32368e6";

function buildImageEvidence(sourceImageId: string) {
  return {
    sourceImageId,
    extractors: [
      {
        kind: "vision" as const,
        confidence: 0.9,
        textSpans: [{ text: "The Macallan 12", confidence: 0.9 }],
        observations: [],
      },
    ],
    fieldCandidates: {
      brand: { value: "The Macallan", confidence: 0.9 },
      statedAge: { value: 12, confidence: 0.9 },
    },
    photoSuitability: {
      isSingleBottlePhoto: true,
      labelReadable: true,
      suitableAsTastingImage: true,
      suitableAsBottleImage: true,
    },
    conflicts: [],
  };
}

async function matchPhoto(fixtures: typeof Fixtures, user: User) {
  const bottle = await fixtures.Bottle();
  const upload = await createPendingImageUpload({
    file: await fixtures.SampleSquareImage(),
    createdById: user.id,
    purpose: "photo_tasting_entry",
  });
  const imageEvidence = buildImageEvidence(upload.id);
  const token = await signWrongPhotoMatchToken({
    type: "wrong_photo_match",
    userId: user.id,
    pendingImageId: upload.id,
    bottleId: bottle.id,
    imageEvidence,
  });
  return { bottle, upload, imageEvidence, token };
}

describe("POST /wrong-photo-matches", () => {
  test("requires auth", async ({ defaults, fixtures }) => {
    const { token } = await matchPhoto(fixtures, defaults.user);
    const error = await waitError(() =>
      routerClient.wrongPhotoMatches.create({ token }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("keeps the photo, label facts, and matched bottle", async ({
    defaults,
    fixtures,
  }) => {
    const { bottle, upload, imageEvidence, token } = await matchPhoto(
      fixtures,
      defaults.user,
    );

    const result = await routerClient.wrongPhotoMatches.create(
      { token, traceId: TRACE_ID },
      { context: { user: defaults.user } },
    );

    const saved = await db.query.wrongPhotoMatches.findFirst({
      where: eq(wrongPhotoMatches.id, result.id),
    });
    expect(saved).toMatchObject({
      createdById: defaults.user.id,
      pendingUploadId: upload.id,
      imageEvidence,
      wrongBottleId: bottle.id,
      correctBottleId: null,
      traceId: TRACE_ID,
    });
    // The copy outlives the pending photo, which expires after 48 hours.
    expect(saved!.imageUrl).toMatch(/^\/uploads\/wrong-photo-matches\//);
    expect(
      existsSync(
        path.join(
          config.UPLOAD_PATH,
          saved!.imageUrl!.replace(/^\/uploads\//, ""),
        ),
      ),
    ).toBe(true);
  });

  test("returns the same record when the photo is reported again", async ({
    defaults,
    fixtures,
  }) => {
    const { token } = await matchPhoto(fixtures, defaults.user);

    const first = await routerClient.wrongPhotoMatches.create(
      { token },
      { context: { user: defaults.user } },
    );
    const second = await routerClient.wrongPhotoMatches.create(
      { token },
      { context: { user: defaults.user } },
    );

    expect(second).toEqual(first);
    expect(
      await db
        .select()
        .from(wrongPhotoMatches)
        .where(eq(wrongPhotoMatches.createdById, defaults.user.id)),
    ).toHaveLength(1);
  });

  test("keeps the photo when two reports for one photo race", async ({
    defaults,
    fixtures,
  }) => {
    const { token } = await matchPhoto(fixtures, defaults.user);

    const [first, second] = await Promise.all([
      routerClient.wrongPhotoMatches.create(
        { token },
        { context: { user: defaults.user } },
      ),
      routerClient.wrongPhotoMatches.create(
        { token },
        { context: { user: defaults.user } },
      ),
    ]);

    expect(second).toEqual(first);
    const saved = await db.query.wrongPhotoMatches.findFirst({
      where: eq(wrongPhotoMatches.id, first.id),
    });
    // Both copies land on one path; the loser must not delete the winner's.
    expect(
      existsSync(
        path.join(
          config.UPLOAD_PATH,
          saved!.imageUrl!.replace(/^\/uploads\//, ""),
        ),
      ),
    ).toBe(true);
  });

  test("rejects another member's match", async ({ defaults, fixtures }) => {
    const other = await fixtures.User();
    const { token } = await matchPhoto(fixtures, other);

    const error = await waitError(() =>
      routerClient.wrongPhotoMatches.create(
        { token },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: This photo match can no longer be reported.]`,
    );
  });

  test("rejects a token Peated did not sign", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.wrongPhotoMatches.create(
        { token: "not-a-token" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: This photo match can no longer be reported.]`,
    );
  });

  test("rejects an expired photo", async ({ defaults, fixtures }) => {
    const { upload, token } = await matchPhoto(fixtures, defaults.user);
    await db
      .update(pendingUploads)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(pendingUploads.id, upload.id));

    const error = await waitError(() =>
      routerClient.wrongPhotoMatches.create(
        { token },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: This photo match can no longer be reported.]`,
    );
    expect(
      await db
        .select()
        .from(wrongPhotoMatches)
        .where(eq(wrongPhotoMatches.createdById, defaults.user.id)),
    ).toHaveLength(0);
  });
});
