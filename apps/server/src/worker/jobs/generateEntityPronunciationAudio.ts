import { db } from "@peated/server/db";
import { changes, entities } from "@peated/server/db/schema";
import { getPeatedSystemActorForDatabase } from "@peated/server/lib/actors";
import {
  deleteOwnedPronunciationAudio,
  getExpectedPronunciationAudioUrl,
  isPronunciationAudioEnabled,
  storePronunciationAudio,
  synthesizePronunciationAudio,
} from "@peated/server/lib/entityPronunciationAudio";
import { logWarn } from "@peated/server/lib/log";
import type { JobPayload } from "@peated/server/worker/types";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const GenerateEntityPronunciationAudioJobArgsSchema = z
  .object({
    entityId: z.number().int().positive(),
  })
  .strict();

type GenerateEntityPronunciationAudioServices = {
  enabled: boolean;
  synthesize: (input: { name: string; ipa: string }) => Promise<Buffer>;
};

// Each attempt synthesizes at most once, which bounds Text-to-Speech calls
// when the IPA keeps changing.
const MAX_ATTEMPTS = 3;

const defaultServices: GenerateEntityPronunciationAudioServices = {
  enabled: isPronunciationAudioEnabled(),
  synthesize: synthesizePronunciationAudio,
};

/**
 * Makes `pronunciationAudioUrl` match the Entity's current IPA: new audio for
 * new IPA, no audio without IPA, and no work when the file already matches.
 */
export async function generateEntityPronunciationAudio(
  input: JobPayload,
  services: GenerateEntityPronunciationAudioServices = defaultServices,
) {
  const { entityId } =
    GenerateEntityPronunciationAudioJobArgsSchema.parse(input);

  if (!services.enabled) return;

  // A unique job that is already running blocks a new one for the same
  // Entity, so an IPA edit made mid-run is picked up here: start over with
  // the current IPA until the saved audio matches it.
  for (let attempt = 0; ; attempt++) {
    const entity = await db.query.entities.findFirst({
      columns: {
        id: true,
        name: true,
        pronunciationIpa: true,
        pronunciationAudioUrl: true,
      },
      where: eq(entities.id, entityId),
    });
    if (!entity) return;

    const ipa = entity.pronunciationIpa;
    const audioUrl = getExpectedPronunciationAudioUrl(entity);
    if (audioUrl === entity.pronunciationAudioUrl) return;

    if (attempt === MAX_ATTEMPTS) {
      logWarn("Pronunciation audio kept changing; the backfill will retry", {
        extra: { entityId },
      });
      return;
    }

    if (ipa && audioUrl) {
      const audio = await services.synthesize({ name: entity.name, ipa });
      await storePronunciationAudio(audioUrl, audio);
    }

    const replacedUrl = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          name: entities.name,
          pronunciationIpa: entities.pronunciationIpa,
          pronunciationAudioUrl: entities.pronunciationAudioUrl,
        })
        .from(entities)
        .where(eq(entities.id, entityId))
        .for("update");
      if (!current) return null;
      // The IPA changed while this attempt ran. The file written above stays
      // reusable for this Entity and IPA; the next attempt uses the new IPA.
      if (current.pronunciationIpa !== ipa) return null;
      if (current.pronunciationAudioUrl === audioUrl) return null;

      await tx
        .update(entities)
        .set({ pronunciationAudioUrl: audioUrl })
        .where(eq(entities.id, entityId));

      const actor = await getPeatedSystemActorForDatabase(tx);
      await tx.insert(changes).values({
        objectType: "entity",
        objectId: entityId,
        displayName: current.name,
        actorId: actor.id,
        type: "update",
        data: { pronunciationAudioUrl: audioUrl },
      });
      return current.pronunciationAudioUrl;
    });

    await deleteOwnedPronunciationAudio(replacedUrl);
    // The next pass returns once the saved URL matches the current IPA, or
    // starts over for an edit made after this save.
  }
}

export default async function generateEntityPronunciationAudioJob(
  input: JobPayload,
) {
  return await generateEntityPronunciationAudio(input);
}
