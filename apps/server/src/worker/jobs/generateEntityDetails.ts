import config from "@peated/server/config";
import { COUNTRY_LIST, DEFAULT_CREATED_BY_ID } from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Entity } from "@peated/server/db/schema";
import { changes, entities } from "@peated/server/db/schema";
import { arraysEqual } from "@peated/server/lib/equals";
import { getStructuredResponse } from "@peated/server/lib/openai";
import { CountryEnum, EntityTypeEnum } from "@peated/server/schemas";
import { startSpan } from "@sentry/node";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { pushJob } from "../client";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

type InputEntity = Partial<Entity> & { country: { name: string } | null };

function generatePrompt(entity: InputEntity) {
  const infoLines = [];
  if (entity.country && entity.region) {
    infoLines.push(`Location: ${entity.region}, ${entity.country.name}`);
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

  return `
Tell me about the following whiskey brand:

${entity.name}
${
  infoLines.length
    ? `\nOther information we already know about this entity:\n- ${infoLines.join(
        "\n- ",
      )}\n`
    : ""
}
If the entity is located in Scotland, spell whiskey as "whisky".

Describe the entity as a distiller, bottler, or brand, whichever one it primarily is. Do not describe it as a "entity".

'description' should include two paragraphs formatted using markdown: the first should focus on its history & origin, the second should describe its unique approach, what styles it produces, and any interesting related facts. The description should be at least 100 words, and no more than 200.

'yearEstablished' should be the year in which the entity was established.

'website' should be the URL to the official website, if one exists. Include the HTTPS protocol in the website value.

'country' should be where the entity is located, if known. Country should be one of the following values:

- ${COUNTRY_LIST.join("\n- ")}

'region' should be the region of the country where the entity is located, if known. Examples of regions might be "Speyside" or "Islay".

The 'type' field must contain every value which is accurate for this entity, describing if the entity operates as brand, a distiller, and/or a bottler.
If the entity is a distiller, include 'distiller' in the 'type' field.
If the entity is a brand, include 'brand' in the 'type' field.
If the entity is a bottler, include 'bottler' in the 'type' field'.
Its valid to include all three values in 'type' if they are accurate, but at least one must be included.
`;
}

export const OpenAIEntityDetailsSchema = z.object({
  description: z.string().nullable().optional(),
  yearEstablished: z.number().nullable().optional(),
  website: z.string().url().nullable().optional(),
  country: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  type: z.array(z.string()).optional(),
});

const OpenAIEntityDetailsValidationSchema = OpenAIEntityDetailsSchema.extend({
  country: CountryEnum.nullable().optional(),
  type: z.array(EntityTypeEnum).optional(),
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

export default async ({ entityId }: { entityId: number }) => {
  if (!config.OPENAI_API_KEY) {
    return;
  }

  const entity = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityId),
    with: {
      country: true,
    },
  });
  if (!entity) {
    throw new Error(`Unknown entity: ${entityId}`);
  }

  const generateDesc =
    !entity.descriptionSrc || entity.descriptionSrc === "generated";

  // test if we need to run at all
  if (
    !generateDesc &&
    entity.yearEstablished &&
    entity.website &&
    entity.country &&
    entity.region
  ) {
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

  if (!entity.yearEstablished && result.yearEstablished)
    data.yearEstablished = result.yearEstablished;

  if (!entity.website && result.website) data.website = result.website;

  if (
    result.type?.length &&
    !arraysEqual(result.type.sort(), entity.type.sort())
  )
    data.type = result.type;

  if (!entity.country && result.country) data.country = result.country;

  if (!entity.region && result.region) data.region = result.region;

  if (Object.keys(data).length === 0) return;

  if (data.website) {
    try {
      await fetch(data.website, {
        headers: {
          "User-Agent": "PeatedBot/1.0 (https://peated.com)",
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
    await db.update(entities).set(data).where(eq(entities.id, entity.id));

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

  if (data.address) {
    await pushJob("GeocodeEntityLocation", { entityId });
  }
};
