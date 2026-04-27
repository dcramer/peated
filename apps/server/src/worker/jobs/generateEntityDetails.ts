import config from "@peated/server/config";
import {
  BOT_USER_AGENT,
  DEFAULT_CREATED_BY_ID,
} from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import { changes, entities } from "@peated/server/db/schema";
import { getStructuredResponse } from "@peated/server/lib/openai";
import { EntityTypeEnum } from "@peated/server/schemas";
import { startSpan } from "@sentry/node";
import { eq } from "drizzle-orm";
import { z } from "zod";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

type InputEntity = Partial<Entity> & {
  country: { name: string } | null;
  region: { name: string } | null;
};

function generatePrompt(entity: InputEntity) {
  const infoLines = [];
  if (entity.country && entity.region) {
    infoLines.push(`Location: ${entity.region.name}, ${entity.country.name}`);
  } else if (entity.country) {
    infoLines.push(`Location: ${entity.country.name}`);
  }
  if (entity.yearEstablished) {
    infoLines.push(`Year Established: ${entity.yearEstablished}`);
  }
  if (entity.website) {
    infoLines.push(`Website: ${entity.website}`);
  }
  if (entity.type) {
    infoLines.push(`Entity Types: ${entity.type.join(", ")}`);
  }

  const sections = [
    `Generate structured details for this whisky producer or brand:\n\n${entity.name}`,
    infoLines.length ? `Known context:\n- ${infoLines.join("\n- ")}` : null,
    [
      "'description' should be two short paragraphs separated by newlines.",
      "Focus on history, origin, and what the producer or brand is broadly known for today.",
      "Do not call it an entity.",
      `Mention former names only if a previous name for ${entity.name} is well established.`,
    ].join(" "),
    [
      "'yearEstablished' should be the founding year only when it is confidently known; otherwise return null.",
    ].join(" "),
    [
      "'website' should be the official HTTPS website only when it is confidently known; otherwise return null.",
    ].join(" "),
    [
      "'type' should include every strongly supported value from: brand, distiller, bottler.",
      "If none can be determined confidently, return an empty array.",
    ].join(" "),
  ];

  return sections.filter(Boolean).join("\n\n");
}

export const OpenAIEntityDetailsSchema = z.object({
  description: z.string().nullable().default(null),
  yearEstablished: z
    .preprocess(
      (val) => (typeof val === "string" && val ? parseInt(val, 10) : val),
      z.number().nullable(),
    )
    .default(null),
  website: z.string().trim().nullable().default(null),
  type: z.array(z.string()).default([]),
});

export const OpenAIEntityDetailsValidationSchema = z.object({
  description: z.string().nullable().default(null),
  yearEstablished: z
    .preprocess(
      (val) => (typeof val === "string" && val ? parseInt(val, 10) : val),
      z.number().nullable(),
    )
    .default(null),
  website: z.string().trim().nullable().default(null),
  type: z.array(EntityTypeEnum).default([]),
});

export type GeneratedEntityDetails = z.infer<typeof OpenAIEntityDetailsSchema>;

export async function getGeneratedEntityDetails(
  entity: InputEntity,
): Promise<GeneratedEntityDetails | null> {
  return await startSpan(
    {
      op: "ai.pipeline",
      name: "getGeneratedEntityDetails",
    },
    async (span) => {
      return await getStructuredResponse(
        "getGeneratedEntityDetails",
        generatePrompt(entity),
        OpenAIEntityDetailsSchema,
        OpenAIEntityDetailsValidationSchema,
        undefined,
        {
          entity: {
            id: entity.id,
            name: entity.name,
          },
        },
      );
    },
  );
}

export default async ({
  entityId,
  force = false,
}: {
  entityId: number;
  force?: boolean;
}) => {
  if (!config.OPENAI_API_KEY) {
    return;
  }

  const entity = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityId),
    with: {
      country: true,
      region: true,
    },
  });
  if (!entity) {
    throw new Error(`Unknown entity: ${entityId}`);
  }

  const generateDesc =
    (!entity.descriptionSrc || entity.descriptionSrc === "generated") &&
    (!entity.description || force);

  // test if we need to run at all
  if (!generateDesc && entity.yearEstablished && entity.website) {
    return;
  }

  const result = await getGeneratedEntityDetails(entity);

  if (!result) {
    throw new Error(`Failed to generate details for entity: ${entityId}`);
  }
  const data: Record<string, any> = {};
  if (
    generateDesc &&
    result.description &&
    result.description !== entity.description
  ) {
    data.description = result.description;
    data.descriptionSrc = "generated";
  }

  if (!entity.yearEstablished && result.yearEstablished) {
    data.yearEstablished = result.yearEstablished;
  }

  if (!entity.website && result.website) data.website = result.website;

  if (Object.keys(data).length === 0) return;

  if (data.website) {
    try {
      await fetch(data.website, {
        headers: {
          "User-Agent": BOT_USER_AGENT,
        },
      });
    } catch (err) {
      console.error(
        `Discarded website (${data.website}) as possible hallucination`,
        err,
      );
      // dont allow LLMs to hallucinate fake URLs
      data.website = null;
    }
  }

  await db.transaction(async (tx) => {
    await tx.update(entities).set(data).where(eq(entities.id, entity.id));

    await tx.insert(changes).values({
      objectType: "entity",
      objectId: entity.id,
      displayName: entity.name,
      createdById: DEFAULT_CREATED_BY_ID,
      type: "update",
      data: {
        ...data,
      },
    });
  });
};
