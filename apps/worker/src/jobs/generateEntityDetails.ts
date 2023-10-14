import { DEFAULT_CREATED_BY_ID } from "@peated/shared/constants";
import { db } from "@peated/shared/db";
import { changes, entities } from "@peated/shared/db/schema";
import { arraysEqual } from "@peated/shared/lib/equals";
import { CountryEnum, EntityTypeEnum } from "@peated/shared/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

import config from "~/config";
import { getStructuredResponse } from "~/lib/openai";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

function generatePrompt(entityName: string) {
  return `
Pretend to be an expert in whiskey distillation. Tell me about the following entity:

${entityName}
  
If the entity is located in Scotland, spell wihskey as "whisky".

Describe the entity as a distiller, bottler, or brand, whichever one it primarily is. Do not describe it as a "entity".

The description should focus on the history & origin, and what makes it different from competitors. It should be less than 200 words, and structured as paragraphs with prose.

The yearEstablished should be the year in which the entity was established.

The country should be where the entity is located, if known.
The region should be the region of the country where the entity is located, if known. Examples of regions might be "Speyside" or "Islay".

The type should describe if the entity is a distiller, a bottler or brand. It can be all three, but it must be at least one. If you are unsure lower your confidence rating. If the entity is a distiller and not a brand, identify an example brand and put it in the aiNotes field.

The confidence rating should be 0 if you do believe this is not a real entity, 1 if you are absolutely certain this information is factual, or inbetween 0 and 1 indicating your confidence level. It should always be set. 

If there are any issues, are you are not confident in the accuracy, please also put that information in aiNotes. Do not fill in any field you are not very confient in.
`;
}

const OpenAIBottleDetailsSchema = z.object({
  description: z.string().nullable().optional(),
  yearEstablished: z.number().nullable().optional(),
  country: CountryEnum.nullable().optional(),
  region: z.string().nullable().optional(),
  confidence: z.number().default(0).optional(),
  type: z.array(EntityTypeEnum).optional(),
  aiNotes: z.string().nullable().optional(),
});

type Response = z.infer<typeof OpenAIBottleDetailsSchema>;

async function generateEntityDetails(
  entityName: string,
): Promise<Response | null> {
  if (!config.OPENAI_API_KEY) return null;

  const result = await getStructuredResponse(
    generatePrompt(entityName),
    OpenAIBottleDetailsSchema,
  );

  if (result.confidence < 0.75)
    // idk
    return null;

  return result;
}

export default async ({ entityId }: { entityId: number }) => {
  const entity = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityId),
  });
  if (!entity) throw new Error("Unknown entity");
  const result = await generateEntityDetails(entity.name);

  if (!result) return;

  const data: Record<string, any> = {};
  if (result.description && result.description !== entity.description)
    data.description = result.description;

  if (
    result.yearEstablished &&
    result.yearEstablished !== entity.yearEstablished
  )
    data.yearEstablished = result.yearEstablished;

  if (
    result.type.length &&
    !arraysEqual(result.type.sort(), entity.type.sort())
  )
    data.type = result.type;

  if (result.country && result.country !== entity.country)
    data.country = result.country;

  if (result.region && result.region !== entity.region)
    data.region = result.region;

  if (Object.keys(data).length === 0) return;

  await db.transaction(async (tx) => {
    await db.update(entities).set(data).where(eq(entities.id, entity.id));

    await tx.insert(changes).values({
      objectType: "entity",
      objectId: entity.id,
      displayName: entity.name,
      createdById: DEFAULT_CREATED_BY_ID,
      type: "update",
      data: JSON.stringify({
        ...data,
      }),
    });
  });
};
