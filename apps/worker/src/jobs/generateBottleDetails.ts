import { DEFAULT_CREATED_BY_ID, DEFAULT_TAGS } from "@peated/shared/constants";
import { db } from "@peated/shared/db";
import { bottles, changes } from "@peated/shared/db/schema";
import { arraysEqual, objectsShallowEqual } from "@peated/shared/lib/equals";
import { CategoryEnum } from "@peated/shared/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";
import config from "~/config";
import { getStructuredResponse } from "~/lib/openai";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

function generatePrompt(bottleName: string) {
  return `
Pretend to be an expert in whiskey distillation. Tell me about the following whiskey:

${bottleName}

If the whiskey is made in Scotland, it is always spelled "whisky".

The description should focus on what is unique about this whiskey. It should not include the tasting notes. It should be less than 200 words.

The tastingNotes should be concise, and focus on the smell and taste.

The statedAge should be the number of years the whiskey has been aged in barrels, if applicable.

The confidence rating should be 0 if you do believe this is not a real entity.
The confidence rating should be 1 if you are absolutely certain this information is factual.

The suggestedTags should be up to five items that reflect the flavor of this whiskey the best. Any value in suggestedTags MUST be already present in the values of the json schema.

If there are any issues, are you are not confident in the accuracy, please also put that information in aiNotes. Do not fill in any field you are not very confient in.

`;
}

const DefaultTagEnum = z.enum(DEFAULT_TAGS);

const OpenAIBottleDetailsSchema = z.object({
  description: z.string().nullable().optional(),
  tastingNotes: z
    .object({
      nose: z.string(),
      palate: z.string(),
      finish: z.string(),
    })
    .nullable()
    .optional(),
  category: CategoryEnum.nullable().optional(),
  statedAge: z.number().nullable().optional(),
  suggestedTags: z.array(DefaultTagEnum).optional(),
  confidence: z.number().default(0).optional(),
  aiNotes: z.string().nullable().optional(),
});

type Response = z.infer<typeof OpenAIBottleDetailsSchema>;

async function generateBottleDetails(
  bottleName: string,
): Promise<Response | null> {
  if (!config.OPENAI_API_KEY) return null;

  const result = await getStructuredResponse(
    generatePrompt(bottleName),
    OpenAIBottleDetailsSchema,
  );

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
    (!bottle.tastingNotes ||
      !objectsShallowEqual(result.tastingNotes, bottle.tastingNotes))
  )
    data.tastingNotes = result.tastingNotes;

  if (
    result.suggestedTags.length &&
    !arraysEqual(result.suggestedTags, bottle.suggestedTags)
  )
    data.suggestedTags = result.suggestedTags;

  if (result.category && result.category !== bottle.category)
    data.category = result.category;

  if (result.statedAge && result.statedAge !== bottle.statedAge)
    data.statedAge = result.statedAge;

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
