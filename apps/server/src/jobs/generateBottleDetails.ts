import config from "@peated/server/config";
import {
  CATEGORY_LIST,
  DEFAULT_CREATED_BY_ID,
  FLAVOR_PROFILES,
} from "@peated/server/constants";
import { db } from "@peated/server/db";
import type { Bottle } from "@peated/server/db/schema";
import { bottles, changes } from "@peated/server/db/schema";
import { arraysEqual, objectsShallowEqual } from "@peated/server/lib/equals";
import { notesForProfile } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { getStructuredResponse } from "@peated/server/lib/openai";
import { CategoryEnum, FlavorProfileEnum } from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

if (!config.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not configured.");
}

function generatePrompt(bottle: Bottle, tagList: string[]) {
  const infoLines = [];
  if (bottle.category) {
    infoLines.push(`Category: ${bottle.category}`);
  }
  if (bottle.statedAge) {
    infoLines.push(`Stated Age: ${bottle.statedAge}`);
  }
  if (bottle.flavorProfile) {
    infoLines.push(`Flavor Profile: ${bottle.flavorProfile}`);
  }
  return `
Describe the following bottle of whisky:

${bottle.fullName}

${
  infoLines.length
    ? `\nOther information we already know about this bottle:\n- ${infoLines.join(
        "\n- ",
      )}\n`
    : ""
}
If the whiskey is made in Scotland, it is always spelled "whisky".

'description' should be a well written description of the spirit, with enough information to inform a novice whisky drinker. It should be three paragraphs in length and include newlines. Do not repeat the spirit name in the description more than once.

'tastingNotes' should be concise, and focus on the smell and taste. If you cannot fill in all three of 'nose', 'palate', and 'finish', you should not fill in any of them.

'flavorProfile' should be one of the following:

- ${FLAVOR_PROFILES.map((f) => `**${f}**: ${notesForProfile(f)}`).join("\n- ")}

'category' should be one of the following:

- ${CATEGORY_LIST.join("\n- ")}

'suggestedTags' should be up to five items that reflect the flavor of this spirit the best. Values MUST be from the following list:

- ${tagList.join("\n- ")}
`;
}

const OpenAIBottleDetailsSchema = z.object({
  description: z.string().nullish(),
  tastingNotes: z
    .object({
      nose: z.string(),
      palate: z.string(),
      finish: z.string(),
    })
    .nullish(),
  category: z.string().nullish(),
  suggestedTags: z.array(z.string()).optional(),
  flavorProfile: z.string().nullish(),
});

// we dont send enums to openai as they dont get used
const OpenAIBottleDetailsValidationSchema = OpenAIBottleDetailsSchema.extend({
  category: CategoryEnum.nullish(),
  flavorProfile: FlavorProfileEnum.nullish(),
  // TODO: ChatGPT is ignoring this shit, so lets validate later and throw away if invalid
  // suggestedTags: z.array(DefaultTagEnum).optional(),
});

type Response = z.infer<typeof OpenAIBottleDetailsSchema>;

async function generateBottleDetails(
  bottle: Bottle,
  tagList: string[],
): Promise<Response | null> {
  if (!config.OPENAI_API_KEY)
    throw new Error("OPENAI_API_KEY is not configured");

  const result = await getStructuredResponse(
    generatePrompt(bottle, tagList),
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

  const tagList = (await db.query.tags.findMany()).map((r) => r.name);
  const result = await generateBottleDetails(bottle, tagList);

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
    if (!result.suggestedTags.find((t) => !tagList.includes(t))) {
      data.suggestedTags = result.suggestedTags;
    } else {
      logError(`Invalid value for suggestedTags`, {
        tag: {
          values: result.suggestedTags.filter((t) => !tagList.includes(t)),
        },
        bottle: {
          id: bottle.id,
          fullName: bottle.fullName,
        },
      });
    }
  }

  if (
    !bottle.category &&
    result.category &&
    result.category !== bottle.category
  )
    data.category = result.category;

  if (
    !bottle.flavorProfile &&
    result.flavorProfile &&
    result.flavorProfile !== bottle.flavorProfile
  )
    data.flavorProfile = result.flavorProfile;

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
