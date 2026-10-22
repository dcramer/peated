import { db } from "@peated/server/db";
import { changes, entities } from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  getPronunciationAudioUrl,
  storePronunciationAudio,
} from "@peated/server/lib/entityPronunciationAudio";
import { readFile } from "@peated/server/lib/uploads";
import { and, eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import { generateEntityPronunciationAudio } from "./generateEntityPronunciationAudio";

const IPA = "ɡlɛn ˈɡɪəri";
const NEW_IPA = "ɡlɛn ˈɡiːri";

// Cloud Text-to-Speech is the only outside boundary; storage and the
// database are real.
function textToSpeech(audio = Buffer.from("mp3-audio")) {
  return vi.fn(async (_input: { name: string; ipa: string }) => audio);
}

async function run(entityId: number, synthesize = textToSpeech()) {
  await generateEntityPronunciationAudio(
    { entityId },
    { enabled: true, synthesize },
  );
  return synthesize;
}

async function readEntity(entityId: number) {
  const [entity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityId));
  return entity;
}

function readAudio(audioUrl: string) {
  return readFile({ filename: audioUrl.slice("/uploads/".length) });
}

test("saves audio made from the IPA", async ({ fixtures }) => {
  const entity = await fixtures.Entity({
    name: "Glen Garioch",
    pronunciationIpa: IPA,
  });

  const synthesize = await run(entity.id);

  expect(synthesize).toHaveBeenCalledExactlyOnceWith({
    name: "Glen Garioch",
    ipa: IPA,
  });
  const audioUrl = getPronunciationAudioUrl(entity.id, IPA);
  expect(audioUrl).toMatch(
    new RegExp(
      `^/uploads/entity-pronunciations/${entity.id}-[0-9a-f]{16}\\.mp3$`,
    ),
  );
  expect((await readEntity(entity.id))?.pronunciationAudioUrl).toBe(audioUrl);
  expect((await readAudio(audioUrl)).toString()).toBe("mp3-audio");

  const systemActor = await getPeatedSystemActor();
  const [change] = await db
    .select()
    .from(changes)
    .where(
      and(
        eq(changes.objectId, entity.id),
        eq(changes.objectType, "entity"),
        eq(changes.actorId, systemActor.id),
      ),
    );
  expect(change).toMatchObject({
    type: "update",
    data: { pronunciationAudioUrl: audioUrl },
  });
});

test("does not synthesize again for the same IPA", async ({ fixtures }) => {
  const entity = await fixtures.Entity({ pronunciationIpa: IPA });
  await run(entity.id);

  const synthesize = await run(entity.id);

  expect(synthesize).not.toHaveBeenCalled();
  expect((await readEntity(entity.id))?.pronunciationAudioUrl).toBe(
    getPronunciationAudioUrl(entity.id, IPA),
  );
});

test("replaces audio and removes the old file when the IPA changes", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ pronunciationIpa: IPA });
  await run(entity.id, textToSpeech(Buffer.from("old-audio")));
  const oldUrl = getPronunciationAudioUrl(entity.id, IPA);
  await db
    .update(entities)
    .set({ pronunciationIpa: NEW_IPA })
    .where(eq(entities.id, entity.id));

  await run(entity.id, textToSpeech(Buffer.from("new-audio")));

  const newUrl = getPronunciationAudioUrl(entity.id, NEW_IPA);
  expect(newUrl).not.toBe(oldUrl);
  expect((await readEntity(entity.id))?.pronunciationAudioUrl).toBe(newUrl);
  expect((await readAudio(newUrl)).toString()).toBe("new-audio");
  await expect(readAudio(oldUrl)).rejects.toThrow();
});

test("removes audio when the IPA is cleared", async ({ fixtures }) => {
  const entity = await fixtures.Entity({ pronunciationIpa: IPA });
  await run(entity.id);
  const oldUrl = getPronunciationAudioUrl(entity.id, IPA);
  await db
    .update(entities)
    .set({ pronunciationIpa: null })
    .where(eq(entities.id, entity.id));

  const synthesize = await run(entity.id);

  expect(synthesize).not.toHaveBeenCalled();
  expect((await readEntity(entity.id))?.pronunciationAudioUrl).toBeNull();
  await expect(readAudio(oldUrl)).rejects.toThrow();
});

test("keeps the saved audio when synthesis fails", async ({ fixtures }) => {
  const entity = await fixtures.Entity({ pronunciationIpa: IPA });
  await run(entity.id);
  const oldUrl = getPronunciationAudioUrl(entity.id, IPA);
  await db
    .update(entities)
    .set({ pronunciationIpa: NEW_IPA })
    .where(eq(entities.id, entity.id));

  const synthesize = vi.fn(async () => {
    throw new Error("Text-to-Speech unavailable");
  });
  await expect(run(entity.id, synthesize)).rejects.toThrow(
    "Text-to-Speech unavailable",
  );

  expect((await readEntity(entity.id))?.pronunciationAudioUrl).toBe(oldUrl);
  expect((await readAudio(oldUrl)).toString()).toBe("mp3-audio");
});

test("saves a file left by an earlier attempt without losing it", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({ pronunciationIpa: IPA });
  const audioUrl = getPronunciationAudioUrl(entity.id, IPA);
  // An earlier attempt stored the file but stopped before saving the URL.
  await storePronunciationAudio(audioUrl, Buffer.from("earlier-audio"));

  await run(entity.id);

  expect((await readEntity(entity.id))?.pronunciationAudioUrl).toBe(audioUrl);
  expect((await readAudio(audioUrl)).toString()).toBe("mp3-audio");
});

test("does nothing without Google Cloud credentials", async ({ fixtures }) => {
  const entity = await fixtures.Entity({ pronunciationIpa: IPA });
  const synthesize = textToSpeech();

  await generateEntityPronunciationAudio(
    { entityId: entity.id },
    { enabled: false, synthesize },
  );

  expect(synthesize).not.toHaveBeenCalled();
  expect((await readEntity(entity.id))?.pronunciationAudioUrl).toBeNull();
});

test("skips an Entity that no longer exists", async () => {
  const synthesize = await run(2_147_483_647);

  expect(synthesize).not.toHaveBeenCalled();
});
