import { DEFAULT_CREATED_BY_ID } from "@peated/shared/constants";
import { db } from "@peated/shared/db";
import { changes, entities, type EntityType } from "@peated/shared/db/schema";
import { arraysEqual } from "@peated/shared/lib/equals";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

import config from "~/config";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

const UNKNOWN_ENTITY_MARKER = "UNKNOWN_ENTITY_MARKER";

const MODEL = "gpt-4";

function generatePrompt(entityName: string) {
  return `
Pretend to be an expert in whiskey distillation.

Given the entity below, create a valid JSON object.

An example of the output we desire:
{"description": "a description about the entity, with no more than 200 words",
 "type": ["bottler", "distiller", "brand"],
 "yearEstablished": "a number indicating the year established, or null if unknown",
 "confidence": "a floating point number ranging from 0 to 1 describing your confidence in accuracy of this information"}

Describe the entity as a distiller, bottler, or brand, whichever one it primarily is. Do not describe it as a "entity".

The description should focus on the history & origin, and what makes it different from competitors

The type should describe if the entity is a distiller, a bottler or brand. It can be all three, but it must be at least one. If you are unsure lower your confidence rating.

The confidence rating should be 0 if you do believe this is not a real entity.
The confidence rating should be 1 if you are absolutely certain this information is factual.

If the entity is located in Scotland, spell wihskey as "whisky".

The entity:
${entityName}
`;
}

type Response = {
  description: string;
  yearEstablished: number;
  confidence: number;
  type: EntityType[];
};

async function generateEntityDescription(
  entityName: string,
): Promise<Response | null> {
  if (!config.OPENAI_API_KEY) return null;

  const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: generatePrompt(entityName),
      },
    ],
    temperature: 0,
  });

  const message = completion.choices[0].message.content;
  if (!message) return null;

  let result: Response;
  try {
    result = JSON.parse(message);
  } catch (err) {
    console.error(err);
    return null;
  }
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
  const result = await generateEntityDescription(entity.name);

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
