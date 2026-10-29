import config from "@peated/server/config";
import { db } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import { changes, entities } from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { logError, logWarn } from "@peated/server/lib/log";
import { withSentryConversation } from "@peated/server/lib/openaiClient";
import { getStructuredResponse } from "@peated/server/lib/structuredResponse";
import {
  EntityPronunciationIpaSchema,
  EntityPronunciationSchema,
} from "@peated/server/schemas/entities";
import { pushJob } from "@peated/server/worker/dispatch";
import type { JobPayload } from "@peated/server/worker/types";
import { eq } from "drizzle-orm";
import { z } from "zod";

if (!config.AI_GATEWAY_API_KEY) {
  logWarn("AI_GATEWAY_API_KEY is not configured", {});
}

type InputEntity = Partial<Entity> & {
  country: { name: string } | null;
  region: { name: string } | null;
};

export const GenerateEntityDetailsJobArgsSchema = z
  .object({
    entityId: z.number().int().positive(),
  })
  .strict();

function generatePrompt(entity: InputEntity) {
  const infoLines = [];
  if (entity.country && entity.region) {
    infoLines.push(`Location: ${entity.region.name}, ${entity.country.name}`);
  } else if (entity.country) {
    infoLines.push(`Location: ${entity.country.name}`);
  }
  if (entity.kind) {
    infoLines.push(`Kind: ${entity.kind}`);
  }

  const sections = [
    `Say how people pronounce the name of this whisky producer or brand:\n\n${entity.name}`,
    infoLines.length ? `Known context:\n- ${infoLines.join("\n- ")}` : null,
    [
      `'pronunciation' should say how people say ${entity.name} in plain English respelling: lowercase syllables joined by hyphens, words split by spaces, and the stressed syllable in capitals when it is confidently known, like "glen GEER-ee" for Glen Garioch.`,
      "Use only letters, spaces, hyphens, and apostrophes.",
      "'pronunciationIpa' should give the same pronunciation in the International Phonetic Alphabet without slashes or brackets, like \"ɡlɛn ˈɡɪəri\".",
      "Follow how the producer and local speakers say the name. Return null for either field when the pronunciation is not confidently known.",
    ].join(" "),
  ];

  return sections.filter(Boolean).join("\n\n");
}

export const OpenAIEntityDetailsSchema = z.object({
  pronunciation: z.string().nullable(),
  pronunciationIpa: z.string().nullable(),
});

export type GeneratedEntityDetails = z.infer<typeof OpenAIEntityDetailsSchema>;

export type EntityDetailsModel = (
  conversationId: string,
  prompt: string,
  entity: InputEntity,
) => Promise<GeneratedEntityDetails | null>;

const defaultEntityDetailsModel: EntityDetailsModel = async (
  conversationId,
  prompt,
  entity,
) =>
  await withSentryConversation(
    conversationId,
    async () =>
      await getStructuredResponse({
        pipelineName: "getGeneratedEntityDetails",
        prompt,
        schema: OpenAIEntityDetailsSchema,
        logContext: {
          entity: {
            id: entity.id,
            name: entity.name,
          },
        },
      }),
  );

export async function getGeneratedEntityDetails(
  entity: InputEntity,
  model: EntityDetailsModel = defaultEntityDetailsModel,
): Promise<GeneratedEntityDetails | null> {
  const conversationId = entity.id
    ? `entity_details:${entity.id}`
    : `ai:entity_lookup:${entity.name ?? "draft"}`;

  const result = await model(conversationId, generatePrompt(entity), entity);
  if (!result) return null;

  // Pronunciation rule (Entity schema): drop a generated value that breaks
  // the stored format instead of saving it or failing the other details.
  return {
    ...result,
    pronunciation:
      EntityPronunciationSchema.safeParse(result.pronunciation).data ?? null,
    pronunciationIpa:
      EntityPronunciationIpaSchema.safeParse(result.pronunciationIpa).data ??
      null,
  };
}

type GenerateEntityDetailsServices = {
  aiEnabled: boolean;
  generateDetails: (
    entity: InputEntity,
  ) => Promise<GeneratedEntityDetails | null>;
};

const defaultServices: GenerateEntityDetailsServices = {
  aiEnabled: Boolean(config.AI_GATEWAY_API_KEY),
  generateDetails: getGeneratedEntityDetails,
};

export async function generateEntityDetails(
  input: JobPayload,
  services: GenerateEntityDetailsServices = defaultServices,
) {
  const { entityId } = GenerateEntityDetailsJobArgsSchema.parse(input);

  if (!services.aiEnabled) {
    return;
  }

  const entity = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityId),
    with: {
      country: true,
      region: true,
    },
  });
  if (!entity) return;

  // Sourcing rule (owner: docs/features/entity-about.md): descriptions and
  // founding years come from sourced About pages, never from a model's
  // memory, so this job fills only the pronunciation.
  if (entity.pronunciation && entity.pronunciationIpa) {
    return;
  }

  const result = await services.generateDetails(entity);

  if (!result) {
    throw new Error(`Failed to generate details for entity: ${entityId}`);
  }
  const data: Partial<typeof entities.$inferInsert> = {};

  if (!entity.pronunciation && result.pronunciation) {
    data.pronunciation = result.pronunciation;
  }
  if (!entity.pronunciationIpa && result.pronunciationIpa) {
    data.pronunciationIpa = result.pronunciationIpa;
  }

  if (Object.keys(data).length === 0) return;

  const actor = await getPeatedSystemActor();

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(entities)
      .set(data)
      .where(eq(entities.id, entity.id))
      .returning({ id: entities.id });
    if (!updated) return;

    await tx.insert(changes).values({
      objectType: "entity",
      objectId: entity.id,
      displayName: entity.name,
      actorId: actor.id,
      type: "update",
      data: {
        ...data,
      },
    });
  });

  // Generated IPA skips OnEntityChange, so it queues its own audio. The
  // details are already saved, so a queue failure must not fail this job;
  // the pronunciation audio backfill route repairs a missed job.
  if (data.pronunciationIpa) {
    try {
      await pushJob("GenerateEntityPronunciationAudio", { entityId });
    } catch (err) {
      logError(err, { entity: { id: entityId } });
    }
  }
}

export default async function generateEntityDetailsJob(input: JobPayload) {
  return await generateEntityDetails(input);
}
