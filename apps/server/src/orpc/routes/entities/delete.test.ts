import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  getPronunciationAudioUrl,
  storePronunciationAudio,
} from "@peated/server/lib/entityPronunciationAudio";
import waitError from "@peated/server/lib/test/waitError";
import { readFile } from "@peated/server/lib/uploads";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /entities/:entity", () => {
  test("deletes entity", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity();

    const data = await routerClient.entities.delete(
      { entity: entity.id },
      { context: { user } },
    );
    expect(data).toEqual({});

    const [newEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entity.id));
    expect(newEntity).toBeUndefined();
  });

  test("removes the Entity's pronunciation audio", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const entity = await fixtures.Entity({ pronunciationIpa: "ɡlɛn" });
    const audioUrl = getPronunciationAudioUrl(entity.id, "ɡlɛn");
    await storePronunciationAudio(audioUrl, Buffer.from("audio"));
    await db
      .update(entities)
      .set({ pronunciationAudioUrl: audioUrl })
      .where(eq(entities.id, entity.id));

    await routerClient.entities.delete(
      { entity: entity.id },
      { context: { user } },
    );

    await expect(
      readFile({ filename: audioUrl.slice("/uploads/".length) }),
    ).rejects.toThrow();
  });

  test("cannot delete without admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActor(user);
    const entity = await fixtures.Entity({ createdByActorId: actor.id });

    const err = await waitError(() =>
      routerClient.entities.delete(
        { entity: entity.id },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
