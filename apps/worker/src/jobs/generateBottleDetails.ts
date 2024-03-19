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
import config from "@peated/worker/config";
import { getStructuredResponse } from "@peated/worker/lib/openai";
import { eq } from "drizzle-orm";
import { z } from "zod";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

function generatePrompt(bottle: Bottle) {
  const infoLines = [];
  if (bottle.category) {
    infoLines.push(`Category: ${bottle.category}`);
  }
  if (bottle.statedAge) {
    infoLines.push(`Stated Age: ${bottle.statedAge}`);
  }

  return `
Describe the following bottle of whisky to an audience:

${bottle.fullName}
${
  infoLines.length
    ? `\nOther information we already know about this bottle:\n- ${infoLines.join(
        "\n- ",
      )}\n`
    : ""
}
If the whiskey is made in Scotland, it is always spelled "whisky".

'description' should be the description to give to the audience

'tastingNotes' should be concise, and focus on the smell and taste. If you cannot fill in all three of 'nose', 'palate', and 'finish', you should not fill in any of them.

'statedAge' should be the number of years the whiskey has been aged in barrels, if applicable.

'category' should be one of the following:

- ${CATEGORY_LIST.join("\n- ")}

'suggestedTags' should be up to five items that reflect the flavor of this whiskey the best. Values MUST be from the following list:

- ${DEFAULT_TAGS.join("\n- ")}
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
});

// we dont send enums to openai as they dont get used
const OpenAIBottleDetailsValidationSchema = OpenAIBottleDetailsSchema.extend({
  category: CategoryEnum.nullable().optional(),
  // TODO: ChatGPT is ignoring this shit, so lets validate later and throw away if invalid
  // suggestedTags: z.array(DefaultTagEnum).optional(),
});

type Response = z.infer<typeof OpenAIBottleDetailsSchema>;

async function generateBottleDetails(bottle: Bottle): Promise<Response | null> {
  if (!config.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY is not configured");

  const result = await getStructuredResponse(
    generatePrompt(bottle),
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

  return result;
}

export default async function ({ bottleId }: { bottleId: number }) {
  const bottle = await db.query.bottles.findFirst({
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
  });
  if (!bottle) {
    throw new Error(`Unknown bottle: ${bottleId}`);
  }
  const result = await generateBottleDetails(bottle);

  if (!result) {
    throw new Error(`Failed to generate details for bottle: ${bottleId}`);
  }

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
    if (
      !result.suggestedTags.find((t) => !DefaultTagEnum.safeParse(t).success)
    ) {
      data.suggestedTags = result.suggestedTags;
    } else {
      logError(`Invalid value for suggestedTags`, {
        tag: {
          values: result.suggestedTags.filter(
            (t) => !DefaultTagEnum.safeParse(t).success,
          ),
        },
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
