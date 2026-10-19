import { faker } from "@faker-js/faker";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { tastingDrafts } from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("DELETE /tasting-drafts/{draft}", () => {
  test("requires auth", async ({ fixtures }) => {
    const draft = await fixtures.TastingDraft();
    const error = await waitError(() =>
      routerClient.tastingDrafts.delete({ draft: draft.id }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("deletes my draft and its photo", async ({ defaults, fixtures }) => {
    const draftId = faker.string.uuid();
    const upload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
    });
    await routerClient.tastingDrafts.upsert(
      {
        draft: draftId,
        tastedAt: new Date().toISOString(),
        pendingImageId: upload.id,
      },
      { context: { user: defaults.user } },
    );
    const [saved] = await db
      .select()
      .from(tastingDrafts)
      .where(eq(tastingDrafts.id, draftId));
    const storedFile = path.join(
      config.UPLOAD_PATH,
      saved.imageUrl!.replace(/^\/uploads\//, ""),
    );
    expect(existsSync(storedFile)).toBe(true);

    expect(
      await routerClient.tastingDrafts.delete(
        { draft: draftId },
        { context: { user: defaults.user } },
      ),
    ).toEqual({});

    expect(
      await db
        .select()
        .from(tastingDrafts)
        .where(eq(tastingDrafts.id, draftId)),
    ).toEqual([]);
    expect(existsSync(storedFile)).toBe(false);
  });

  test("cannot delete another member's draft", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await fixtures.TastingDraft();

    const error = await waitError(() =>
      routerClient.tastingDrafts.delete(
        { draft: draft.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Draft not found.]`);
    expect(
      await db
        .select()
        .from(tastingDrafts)
        .where(eq(tastingDrafts.id, draft.id)),
    ).toHaveLength(1);
  });
});
