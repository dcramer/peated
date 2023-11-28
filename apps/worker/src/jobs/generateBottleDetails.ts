import {
  CATEGORY_LIST,
  DEFAULT_CREATED_BY_ID,
  DEFAULT_TAGS,
} from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import { bottles, changes } from "@peated/server/db/schema";
import { arraysEqual, objectsShallowEqual } from "@peated/server/lib/equals";
import { logError } from "@peated/server/lib/log";
import { CategoryEnum } from "@peated/server/schemas";
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

'description' should focus on what is unique about this whiskey. It should not include the tasting notes. It should be less than 200 words, and structured as paragraphs with prose.

'tastingNotes' should be concise, and focus on the smell and taste. If you cannot fill in all three of 'nose', 'palate', and 'finish', you should not fill in any of them.

'statedAge' should be the number of years the whiskey has been aged in barrels, if applicable.

'confidence' should be 0 if you do believe this is not a real entity, 1 if you are absolutely certain this information is factual, or inbetween 0 and 1 indicating your confidence level. It should always be set.

'category' should be one of the following:

- ${CATEGORY_LIST.join("\n- ")}

'suggestedTags' should be up to five items that reflect the flavor of this whiskey the best. Values MUST be from the following list:

- ${DEFAULT_TAGS.join("\n- ")}

If there are any issues, or you are not confident in the accuracy, please also put that information in 'aiNotes'. Do not fill in any field you are not very confident in.
`;
}

// XXX: enums dont work with GPT currently (it ignores them)
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
  category: z.string().nullable().optional(),
  statedAge: z.number().nullable().optional(),
  suggestedTags: z.array(z.string()).optional(),
  confidence: z.number().default(0).optional(),
  aiNotes: z.string().nullable().optional(),
});

// we dont send enums to openai as they dont get used
const OpenAIBottleDetailsValidationSchema = OpenAIBottleDetailsSchema.extend({
  category: CategoryEnum.nullable().optional(),
  // TODO: ChatGPT is ignoring this shit, so lets validate later and throw away if invalid
  // suggestedTags: z.array(DefaultTagEnum).optional(),
});

type Response = z.infer<typeof OpenAIBottleDetailsSchema>;

async function generateBottleDetails(bottle: Bottle): Promise<Response | null> {
  if (!config.OPENAI_API_KEY) return null;

  const result = await getStructuredResponse(
    generatePrompt(bottle.fullName),
    OpenAIBottleDetailsSchema,
    OpenAIBottleDetailsValidationSchema,
    undefined,
    {
      bottle: {
        id: bottle.id,
        fullName: bottle.fullName,
      },
    },
  );

  if (!result || !result.confidence || result.confidence < 0.75)
    // idk
    return null;
  return result;
}

export default async function ({ bottleId }: { bottleId: number }) {
  const bottle = await db.query.bottles.findFirst({
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
  });
  if (!bottle) {
    logError(`Unknown bottle: ${bottleId}`);
    return;
  }
  const result = await generateBottleDetails(bottle);

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
    result.suggestedTags?.length &&
    !arraysEqual(result.suggestedTags, bottle.suggestedTags)
  ) {
    const firstInvalidTag = result.suggestedTags.find(
      (t) => !DefaultTagEnum.safeParse(t).success,
    );
    if (!firstInvalidTag) {
      data.suggestedTags = result.suggestedTags;
    } else {
      logError(`Invalid value for suggestedTags: ${firstInvalidTag}`, {
        bottle: {
          id: bottle.id,
          fullName: bottle.fullName,
        },
      });
    }
  }

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
      data: {
        ...data,
      },
    });
  });
}
