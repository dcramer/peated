import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getPronunciationAudioUrl } from "@peated/server/lib/entityPronunciationAudio";
import waitError from "@peated/server/lib/test/waitError";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("POST /admin/catalog/rebuild-pronunciation-audio", () => {
  test("queues Entities whose audio is missing or out of date", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const missing = await fixtures.Entity({ pronunciationIpa: "ɡlɛn" });
    const current = await fixtures.Entity({ pronunciationIpa: "ɡlɛn" });
    const stale = await fixtures.Entity({
      pronunciationIpa: "ɡlɛn",
      pronunciationAudioUrl: "/uploads/placeholder.mp3",
    });
    const cleared = await fixtures.Entity({
      pronunciationIpa: null,
      pronunciationAudioUrl: "/uploads/entity-pronunciations/old.mp3",
    });
    await fixtures.Entity({ pronunciationIpa: null });
    // Only `current` already has audio for its IPA and voice.
    await db
      .update(entities)
      .set({
        pronunciationAudioUrl: getPronunciationAudioUrl(current.id, "ɡlɛn"),
      })
      .where(eq(entities.id, current.id));
    pushJob.mockClear();

    const result = await routerClient.admin.rebuildPronunciationAudio(
      {},
      { context: { user: admin } },
    );

    expect(result).toEqual({ queued: 3, nextAfterId: null });
    expect(pushJob.mock.calls).toEqual([
      [
        "GenerateEntityPronunciationAudio",
        { entityId: missing.id },
        { delay: 0 },
      ],
      [
        "GenerateEntityPronunciationAudio",
        { entityId: stale.id },
        { delay: 0 },
      ],
      [
        "GenerateEntityPronunciationAudio",
        { entityId: cleared.id },
        { delay: 0 },
      ],
    ]);
  });

  test("pages by Entity ID", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const first = await fixtures.Entity({ pronunciationIpa: "ɡlɛn" });
    const second = await fixtures.Entity({ pronunciationIpa: "ɡlɛn" });
    pushJob.mockClear();

    const page = await routerClient.admin.rebuildPronunciationAudio(
      { limit: 1 },
      { context: { user: admin } },
    );
    expect(page).toEqual({ queued: 1, nextAfterId: first.id });

    const last = await routerClient.admin.rebuildPronunciationAudio(
      { afterId: page.nextAfterId!, limit: 1 },
      { context: { user: admin } },
    );
    expect(last).toEqual({ queued: 1, nextAfterId: null });
    expect(pushJob.mock.calls.map((args) => args[1])).toEqual([
      { entityId: first.id },
      { entityId: second.id },
    ]);
  });

  test("requires administrator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    await fixtures.Entity({ pronunciationIpa: "ɡlɛn" });
    pushJob.mockClear();

    const err = await waitError(
      routerClient.admin.rebuildPronunciationAudio({}, { context: { user } }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(pushJob).not.toHaveBeenCalled();
  });
});
