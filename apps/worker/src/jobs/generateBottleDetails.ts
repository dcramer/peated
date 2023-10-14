import { DEFAULT_CREATED_BY_ID, DEFAULT_TAGS } from "@peated/shared/constants";
import { db } from "@peated/shared/db";
import { bottles, changes } from "@peated/shared/db/schema";
import { arraysEqual, objectsShallowEqual } from "@peated/shared/lib/equals";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import config from "~/config";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

const MODEL = "gpt-3.5-turbo";

function generatePrompt(bottleName: string) {
  return `
Pretend to be an expert in whiskey distillation.

Given the whiskey below, create a valid JSON object.

An example of the output we desire:
{"description": "a description about the whiskey, with no more than 100 words",
 "tastingNotes": {
  "nose": "tasting notes about the nose",
  "palate": "tasting notes about the palate",
  "finish": "tasting notes about the finish",
 },
 "suggestedTags": ["one", "two", "three", "four", "five"],
 "confidence": "a floating point number ranging from 0.0 to 1.0 describing your confidence in accuracy of this information"}

The description should focus on what is unique about this whiskey. It should not include the tasting notes.

The tasting notes should be concise, and focus on the smell and taste.

The confidence rating should be 0 if you do believe this is not a real entity.
The confidence rating should be 1 if you are absolutely certain this information is factual.

The suggested tags should be five items that reflect the flavor of this whiskey the best, and should come from the following list:

${DEFAULT_TAGS.join("\n")}

If the whiskey is made in Scotland, it is always spelled "whisky".

The whiskey:
${bottleName}
`;
}

type Response = {
  description: string;
  tastingNotes: {
    nose: string;
    palate: string;
    finish: string;
  };
  suggestedTags: string[];
  confidence: number;
};

async function generateBottleDetails(
  bottleName: string,
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
        content: generatePrompt(bottleName),
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

export default async function ({ bottleId }: { bottleId: number }) {
  const bottle = await db.query.bottles.findFirst({
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
  });
  if (!bottle) throw new Error("Unknown bottle");
  const result = await generateBottleDetails(bottle.fullName);

  if (!result) return;

  const data: Record<string, any> = {};
  if (result.description && result.description !== bottle.description)
    data.description = result.description;

  if (
    result.tastingNotes &&
    !objectsShallowEqual(result.tastingNotes, bottle.tastingNotes)
  )
    data.tastingNotes = result.tastingNotes;

  if (
    result.suggestedTags.length &&
    !arraysEqual(result.suggestedTags, bottle.suggestedTags)
  )
    data.suggestedTags = result.suggestedTags;

  if (Object.keys(data).length === 0) return;

  await db.transaction(async (tx) => {
    await db.update(bottles).set(data).where(eq(bottles.id, bottle.id));

    await tx.insert(changes).values({
      objectType: "bottle",
      objectId: bottle.id,
      displayName: bottle.fullName,
      createdById: DEFAULT_CREATED_BY_ID,
      type: "update",
      data: JSON.stringify({
        ...data,
      }),
    });
  });
}
